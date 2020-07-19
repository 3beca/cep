jest.mock('pino');
import { ObjectId } from 'mongodb';
import { buildAppConfig } from '../../../src/config';
import { buildApp, App } from '../../../src/app';
import nock from 'nock';

describe('admin', () => {
    let app: App;
    let adminServer;
    let eventProcessingServer;

    beforeEach(async () => {
        const config = buildAppConfig();
        app = await buildApp({
            ...config,
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

        it('should return an empty list of rules executions when no rules have been executed', async () => {
            const response = await adminServer.inject({
                method: 'GET',
                url: '/rules-executions'
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
                url: '/rules-executions?eventTypeId=invalid-object-id-here'
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
                url: '/rules-executions?eventTypeId=' + eventType1.id
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
                url: '/rules-executions?ruleId=invalid-object-id-here'
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
                url: '/rules-executions?ruleId=' + rule1.id
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

        it('should return a list of rules executions', async () => {
            const eventType = await createEventType(adminServer);
            const target1 = await createTarget(adminServer, 'https://target1.com');
            const target2 = await createTarget(adminServer, 'https://target2.com');
            const rule1 = await createRule(adminServer, target1.id, eventType.id, 'rule 1', { value: 2 });
            const rule2 = await createRule(adminServer, target2.id, eventType.id, 'rule 2', { value: { _lt: 3 } }, true);

            const scope2 = nock('https://target1.com')
                .post('/', { value: 2 })
                .once()
                .reply(200, { ok: true })
                .post('/', { value: 2 })
                .once()
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
                url: '/rules-executions'
            });
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            const listResponse = JSON.parse(response.payload);
            expect(listResponse.results.length).toBe(8);
            const matchResults = listResponse.results.filter(r => r.match);
            expect(matchResults.length).toBe(4);

            const [ ruleExecution1, ruleExecution2, ruleExecution3, ruleExecution4 ] = matchResults;

            expect(ruleExecution1.eventTypeId).toBe(eventType.id);
            expect(ruleExecution1.eventTypeName).toBe(eventType.name);
            expect(ruleExecution1.ruleId).toBe(rule2.id);
            expect(ruleExecution1.ruleName).toBe(rule2.name);
            expect(ruleExecution1.match).toBe(true);
            expect(ruleExecution1.skip).toBe(true);
            expect(ruleExecution1.executedAt).not.toBe(undefined);
            expect(ruleExecution1.targetId).toBe(undefined);
            expect(ruleExecution1.targetName).toBe(undefined);
            expect(ruleExecution1.targetSuccess).toBe(undefined);
            expect(ruleExecution1.targetStatusCode).toBe(undefined);
            expect(ruleExecution1.targetError).toBe(undefined);

            expect(ruleExecution2.eventTypeId).toBe(eventType.id);
            expect(ruleExecution2.eventTypeName).toBe(eventType.name);
            expect(ruleExecution2.ruleId).toBe(rule1.id);
            expect(ruleExecution2.ruleName).toBe(rule1.name);
            expect(ruleExecution2.match).toBe(true);
            expect(ruleExecution2.skip).toBe(false);
            expect(ruleExecution2.executedAt).not.toBe(undefined);
            expect(ruleExecution2.targetId).toBe(target1.id);
            expect(ruleExecution2.targetName).toBe(target1.name);
            expect(ruleExecution2.targetSuccess).toBe(false);
            expect(ruleExecution2.targetStatusCode).toBe(500);
            expect(ruleExecution2.targetError).toBe(undefined);

            expect(ruleExecution3.eventTypeId).toBe(eventType.id);
            expect(ruleExecution3.eventTypeName).toBe(eventType.name);
            expect(ruleExecution3.ruleId).toBe(rule2.id);
            expect(ruleExecution3.ruleName).toBe(rule2.name);
            expect(ruleExecution3.match).toBe(true);
            expect(ruleExecution3.skip).toBe(false);
            expect(ruleExecution3.executedAt).not.toBe(undefined);
            expect(ruleExecution3.targetId).toBe(target2.id);
            expect(ruleExecution3.targetName).toBe(target2.name);
            expect(ruleExecution3.targetSuccess).toBe(true);
            expect(ruleExecution3.targetStatusCode).toBe(202);
            expect(ruleExecution3.targetError).toBe(undefined);

            expect(ruleExecution4.eventTypeId).toBe(eventType.id);
            expect(ruleExecution4.eventTypeName).toBe(eventType.name);
            expect(ruleExecution4.ruleId).toBe(rule1.id);
            expect(ruleExecution4.ruleName).toBe(rule1.name);
            expect(ruleExecution4.match).toBe(true);
            expect(ruleExecution4.skip).toBe(false);
            expect(ruleExecution4.executedAt).not.toBe(undefined);
            expect(ruleExecution4.targetId).toBe(target1.id);
            expect(ruleExecution4.targetName).toBe(target1.name);
            expect(ruleExecution4.targetSuccess).toBe(true);
            expect(ruleExecution4.targetStatusCode).toBe(200);
            expect(ruleExecution4.targetError).toBe(undefined);

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
                }
            });
            expect(createResponse.statusCode).toBe(201);
            expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
            return JSON.parse(createResponse.payload);
        }
    });
});
