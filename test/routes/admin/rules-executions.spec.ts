jest.mock('pino');
import { ObjectId } from 'mongodb';
import { buildConfig } from '../../../src/config';
import { buildApp, App } from '../../../src/app';
import nock from 'nock';

describe('admin server', () => {
    let app: App;
    let adminServer;
    let eventProcessingServer;

    beforeEach(async () => {
        const config = buildConfig();
        app = await buildApp({
            ...config,
            adminHttp: {
                ...config.adminHttp,
                apiKeys: 'myApiKey myApiKey2'
            },
            mongodb: {
                ...config.mongodb,
                databaseName: `test-${new ObjectId()}`
            }
        });
        adminServer = app.getAdminServer();
        eventProcessingServer = app.getEventProcessingServer();
    });

    afterEach(async () => {
        await app.getDatabase().dropDatabase();
        await app.close();
        nock.cleanAll();
    });

    describe('rules-executions', () => {

        it('should return 401 when invalid token', async () => {
            const response = await adminServer.inject({
                method: 'GET',
                url: '/rules-executions',
                headers: {
                    authorization: 'apiKey invalidApiKey'
                }
            });
            expect(response.statusCode).toBe(401);
        });

        it('should return an empty list of rules executions when no rules have been executed', async () => {
            const response = await adminServer.inject({
                method: 'GET',
                url: '/rules-executions',
                headers: {
                    authorization: 'apiKey myApiKey2'
                }
            });
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            const listResponse = JSON.parse(response.payload);
            expect(listResponse.results.length).toBe(0);
            expect(listResponse.next).toBe(undefined);
            expect(listResponse.prev).toBe(undefined);
        });

        it('should return 400 bad request when filtered by an invalid eventTypeId', async () => {
            const response = await adminServer.inject({
                method: 'GET',
                url: '/rules-executions?eventTypeId=invalid-object-id-here',
                headers: {
                    authorization: 'apiKey myApiKey2'
                }
            });
            expect(response.statusCode).toBe(400);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'querystring/eventTypeId should be a valid ObjectId' }));
        });

        it('should return a list of rules executions filtered by eventTypeId', async () => {
            const eventType1 = await createEventType(adminServer);
            const eventType2 = await createEventType(adminServer);
            const target1 = await createTarget(adminServer, 'http://example.org');
            const target2 = await createTarget(adminServer, 'http://example.com');
            const rule1 = await createRule(adminServer, target1.id, eventType1.id, 'rule 1', { value: 2 });
            await createRule(adminServer, target2.id, eventType2.id, 'rule 2', { value: 2 });

            await processEvent(eventProcessingServer, eventType1.id, { value: 8 });
            await processEvent(eventProcessingServer, eventType2.id, { value: 7 });

            const response = await adminServer.inject({
                method: 'GET',
                url: '/rules-executions?eventTypeId=' + eventType1.id,
                headers: {
                    authorization: 'apiKey myApiKey2'
                }
            });
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            const listResponse = JSON.parse(response.payload);
            expect(listResponse.results.length).toBe(1);
            const ruleExecution1 = listResponse.results[0];
            expect(ruleExecution1.eventTypeId).toBe(eventType1.id);
            expect(ruleExecution1.eventTypeName).toBe(eventType1.name);
            expect(ruleExecution1.ruleId).toBe(rule1.id);
            expect(ruleExecution1.ruleName).toBe(rule1.name);
            expect(ruleExecution1.match).toBe(false);
            expect(ruleExecution1.executedAt).not.toBe(undefined);
            expect(listResponse.next).toBe(undefined);
            expect(listResponse.prev).toBe(undefined);
        });

        it('should return 400 bad request when filtered by an invalid ruleId', async () => {
            const response = await adminServer.inject({
                method: 'GET',
                url: '/rules-executions?ruleId=invalid-object-id-here',
                headers: {
                    authorization: 'apiKey myApiKey2'
                }
            });
            expect(response.statusCode).toBe(400);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'querystring/ruleId should be a valid ObjectId' }));
        });

        it('should return a list of rules executions filtered by ruleId', async () => {
            const eventType1 = await createEventType(adminServer);
            const eventType2 = await createEventType(adminServer);
            const target1 = await createTarget(adminServer, 'http://example.org');
            const target2 = await createTarget(adminServer, 'http://example.com');
            const rule1 = await createRule(adminServer, target1.id, eventType1.id, 'rule 1', { value: 2 });
            await createRule(adminServer, target2.id, eventType2.id, 'rule 2', { value: 2 });

            await processEvent(eventProcessingServer, eventType1.id, { value: 8 });
            await processEvent(eventProcessingServer, eventType2.id, { value: 7 });

            const response = await adminServer.inject({
                method: 'GET',
                url: '/rules-executions?ruleId=' + rule1.id,
                headers: {
                    authorization: 'apiKey myApiKey2'
                }
            });
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            const listResponse = JSON.parse(response.payload);
            expect(listResponse.results.length).toBe(1);
            const ruleExecution1 = listResponse.results[0];
            expect(ruleExecution1.eventTypeId).toBe(eventType1.id);
            expect(ruleExecution1.eventTypeName).toBe(eventType1.name);
            expect(ruleExecution1.ruleId).toBe(rule1.id);
            expect(ruleExecution1.ruleName).toBe(rule1.name);
            expect(ruleExecution1.match).toBe(false);
            expect(ruleExecution1.executedAt).not.toBe(undefined);
            expect(listResponse.next).toBe(undefined);
            expect(listResponse.prev).toBe(undefined);
        });

        it('should return a list of rules executions ordered by executedAt descending', async () => {
            const eventType = await createEventType(adminServer);
            const target1 = await createTarget(adminServer, 'https://target1.com');
            const target2 = await createTarget(adminServer, 'https://target2.com');
            const rule1 = await createRule(adminServer, target1.id, eventType.id, 'rule 1', { value: 2 });
            const rule2 = await createRule(adminServer, target2.id, eventType.id, 'rule 2', { value: { _lt: 3 } }, true);

            const scope2 = nock('https://target1.com')
                .post('/', { value: 2 })
                .once()
                .delayConnection(10)
                .reply(200, { ok: true })
                .post('/', { value: 2 })
                .once()
                .delayConnection(10)
                .reply(500, { error: 'server error' });

            const scope1 = nock('https://target2.com')
                .post('/', { value: 2 })
                .once()
                .reply(202, { success: true });

            await processEvent(eventProcessingServer, eventType.id, { value: 8 });
            await processEvent(eventProcessingServer, eventType.id, { value: 2 });
            await processEvent(eventProcessingServer, eventType.id, { value: 2 });
            await processEvent(eventProcessingServer, eventType.id, { value: 9 });

            const response = await adminServer.inject({
                method: 'GET',
                url: '/rules-executions',
                headers: {
                    authorization: 'apiKey myApiKey2'
                }
            });
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            const listResponse = JSON.parse(response.payload);
            expect(listResponse.results.length).toBe(8);
            const rulesExecutions = listResponse.results.filter(r => r.match);
            expect(rulesExecutions.length).toBe(4);

            const [ forthRuleExecution, thirdRuleExecution, secondRuleExecution, firstRuleExecution ] = rulesExecutions;

            expect(new Date(forthRuleExecution.executedAt).getTime()).toBeGreaterThan(new Date(thirdRuleExecution.executedAt).getTime());
            expect(new Date(thirdRuleExecution.executedAt).getTime()).toBeGreaterThan(new Date(secondRuleExecution.executedAt).getTime());
            expect(new Date(secondRuleExecution.executedAt).getTime()).toBeGreaterThan(new Date(firstRuleExecution.executedAt).getTime());

            const rule1FirstExecution = secondRuleExecution;
            expect(rule1FirstExecution).not.toBe(undefined);
            expect(rule1FirstExecution.eventTypeId).toBe(eventType.id);
            expect(rule1FirstExecution.eventTypeName).toBe(eventType.name);
            expect(rule1FirstExecution.ruleName).toBe(rule1.name);
            expect(rule1FirstExecution.skip).toBe(false);
            expect(rule1FirstExecution.executedAt).not.toBe(undefined);
            expect(rule1FirstExecution.targetId).toBe(target1.id);
            expect(rule1FirstExecution.targetName).toBe(target1.name);
            expect(rule1FirstExecution.targetSuccess).toBe(true);
            expect(rule1FirstExecution.targetStatusCode).toBe(200);

            const rule2FirstExecution = firstRuleExecution;
            expect(rule2FirstExecution).not.toBe(undefined);
            expect(rule2FirstExecution.eventTypeId).toBe(eventType.id);
            expect(rule2FirstExecution.eventTypeName).toBe(eventType.name);
            expect(rule2FirstExecution.ruleName).toBe(rule2.name);
            expect(rule2FirstExecution.skip).toBe(false);
            expect(rule2FirstExecution.executedAt).not.toBe(undefined);
            expect(rule2FirstExecution.targetId).toBe(target2.id);
            expect(rule2FirstExecution.targetName).toBe(target2.name);
            expect(rule2FirstExecution.targetSuccess).toBe(true);
            expect(rule2FirstExecution.targetStatusCode).toBe(202);

            const rule1LastExecution = forthRuleExecution;
            expect(rule1LastExecution).not.toBe(undefined);
            expect(rule1LastExecution.eventTypeId).toBe(eventType.id);
            expect(rule1LastExecution.eventTypeName).toBe(eventType.name);
            expect(rule1LastExecution.ruleName).toBe(rule1.name);
            expect(rule1LastExecution.skip).toBe(false);
            expect(rule1LastExecution.executedAt).not.toBe(undefined);
            expect(rule1LastExecution.targetId).toBe(target1.id);
            expect(rule1LastExecution.targetName).toBe(target1.name);
            expect(rule1LastExecution.targetSuccess).toBe(false);
            expect(rule1LastExecution.targetStatusCode).toBe(500);

            const rule2LastExecution = thirdRuleExecution;
            expect(rule2LastExecution).not.toBe(undefined);
            expect(rule2LastExecution.eventTypeId).toBe(eventType.id);
            expect(rule2LastExecution.eventTypeName).toBe(eventType.name);
            expect(rule2LastExecution.ruleName).toBe(rule2.name);
            expect(rule2LastExecution.skip).toBe(true);
            expect(rule2LastExecution.executedAt).not.toBe(undefined);
            expect(rule2LastExecution.targetId).toBe(undefined);
            expect(rule2LastExecution.targetName).toBe(undefined);
            expect(rule2LastExecution.targetSuccess).toBe(undefined);
            expect(rule2LastExecution.targetStatusCode).toBe(undefined);

            expect(scope1.isDone()).toBe(true);
            expect(scope2.isDone()).toBe(true);
        });

        async function processEvent(eventProcessingServer, eventTypeId, eventPayload) {
            const response = await eventProcessingServer.inject({
                method: 'POST',
                url: '/events/' + eventTypeId,
                body: eventPayload
            });
            expect(response.statusCode).toBe(204);
        }

        async function createTarget(adminServer, url = 'http://example.org') {
            const createResponse = await adminServer.inject({
                method: 'POST',
                url: '/targets',
                body: {
                    name: 'a target ' + new ObjectId().toHexString(),
                    url
                },
                headers: {
                    authorization: 'apiKey myApiKey2'
                }
            });
            expect(createResponse.statusCode).toBe(201);
            expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
            return JSON.parse(createResponse.payload);
        }

        async function createRule(adminServer, targetId, eventTypeId, name = 'a rule', filters: any = undefined, skipOnConsecutivesMatches: boolean = false) {
            const createResponse = await adminServer.inject({
                method: 'POST',
                url: '/rules',
                body: {
                    name,
                    type: 'realtime',
                    eventTypeId,
                    targetId,
                    filters,
                    skipOnConsecutivesMatches
                },
                headers: {
                    authorization: 'apiKey myApiKey2'
                }
            });
            expect(createResponse.statusCode).toBe(201);
            expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
            return JSON.parse(createResponse.payload);
        }

        async function createEventType(adminServer) {
            const createResponse = await adminServer.inject({
                method: 'POST',
                url: '/event-types',
                body: {
                    name: 'an event type ' + new ObjectId().toHexString()
                },
                headers: {
                    authorization: 'apiKey myApiKey2'
                }
            });
            expect(createResponse.statusCode).toBe(201);
            expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
            return JSON.parse(createResponse.payload);
        }
    });
});
