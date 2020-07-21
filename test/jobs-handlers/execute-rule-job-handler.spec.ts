jest.mock('pino');
import { ObjectId } from 'mongodb';
import nock from 'nock';
import { buildApp, App } from '../../src/app';
import { JobHandler } from '../../src/jobs-handlers/job-handler';
import NotFoundError from '../../src/errors/not-found-error';
import InvalidOperationError from '../../src/errors/invalid-operation-error';
import { buildConfig } from '../../src/config';

describe('execute rule job handler', () => {
    let app: App;
    let adminServer;
    let eventProcessingServer;
    let executeRuleJobHandler: JobHandler;

    beforeEach(async () => {
        const config = buildConfig();
        app = await buildApp({
            ...config,
            mongodb: {
                ...config.mongodb,
                databaseName: `test-${new ObjectId()}`
            }
        });
        adminServer = app.getAdminServer();
        eventProcessingServer = app.getEventProcessingServer();
        const scheduler = app.getScheduler();
        executeRuleJobHandler = scheduler.getJobHandler('execute-rule');
    });

    afterEach(async () => {
        await app.getDatabase().dropDatabase();
        await app.close();
        nock.cleanAll();
    });

    it('should throw NotFoundError when rule does not exists', async () => {
        expect.assertions(2);
        const ruleId = new ObjectId();
        try {
            await executeRuleJobHandler({ ruleId });
        } catch (error) {
            expect(error instanceof NotFoundError).toBe(true);
            expect(error.message).toBe(`Rule ${ruleId} cannot be found`);
        }
    });

    it('should throw InvalidOperationError when rule is not of type tumbling', async () => {
        expect.assertions(8);
        const eventType = await createEventType(adminServer);
        const target = await createTarget(adminServer, 'http://example.org/');
        const rule = await createRule(adminServer, target.id, eventType.id, { filters: { value: 2 }});
        const ruleId = ObjectId.createFromHexString(rule.id);
        try {
            await executeRuleJobHandler({ ruleId });
        } catch (error) {
            expect(error instanceof InvalidOperationError).toBe(true);
            expect(error.message).toBe('Cannot execute rule of type \'realtime\'. Only rule of type tumbling are supported.');
        }
    });

    it('should call target when tumbling rule has no events to process', async () => {
        const eventType = await createEventType(adminServer);
        const target = await createTarget(adminServer, 'http://example.org');
        const rule = await createRule(adminServer, target.id, eventType.id, {
            type: 'tumbling',
            group: {
                average: { _avg: '_value' },
                count: { _sum: 1 },
                max: { _max: '_value' },
                min: { _min: '_value' },
                stdDevPop: { _stdDevPop: '_value' },
                stdDevSamp: { _stdDevSamp: '_value' }
            },
            windowSize: {
                unit: 'minute',
                value: 1
            }
        });
        const ruleId = ObjectId.createFromHexString(rule.id);

        const scope = nock('http://example.org')
            .post('/', {
                average: null,
                count: 0,
                max: null,
                min: null,
                stdDevPop: null,
                stdDevSamp: null
            })
            .reply(200);

        await executeRuleJobHandler({ ruleId });
        expect(scope.isDone()).toBe(true);
    });

    it('should call target when tumbling rule has events without field to process', async () => {
        const eventType = await createEventType(adminServer);
        const target = await createTarget(adminServer, 'http://example.org');

        await eventProcessingServer.inject({
            method: 'POST',
            url: '/events/' + eventType.id,
            body: {
                otherValue: 5
            }
        });
        await eventProcessingServer.inject({
            method: 'POST',
            url: '/events/' + eventType.id,
            body: {
                otherValue: 15
            }
        });
        await eventProcessingServer.inject({
            method: 'POST',
            url: '/events/' + eventType.id,
            body: {
                otherValue: 100
            }
        });

        const rule = await createRule(adminServer, target.id, eventType.id, {
            type: 'tumbling',
            group: {
                average: { _avg: '_value' },
                count: { _sum: 1 },
                max: { _max: '_value' },
                min: { _min: '_value' },
                stdDevPop: { _stdDevPop: '_value' },
                stdDevSamp: { _stdDevSamp: '_value' }
            },
            windowSize: {
                unit: 'minute',
                value: 1
            }
        });
        const ruleId = ObjectId.createFromHexString(rule.id);

        const scope = nock('http://example.org')
            .post('/', {
                average: null,
                count: 3,
                max: null,
                min: null,
                stdDevPop: null,
                stdDevSamp: null
            })
            .reply(200);

        await executeRuleJobHandler({ ruleId });

        expect(scope.isDone()).toBe(true);
    });

    it('should call target when tumbling rule has some events without field to process', async () => {
        const eventType = await createEventType(adminServer);
        const target = await createTarget(adminServer, 'http://example.org');

        await eventProcessingServer.inject({
            method: 'POST',
            url: '/events/' + eventType.id,
            body: {
                otherValue: 5
            }
        });
        await eventProcessingServer.inject({
            method: 'POST',
            url: '/events/' + eventType.id,
            body: {
                value: 15
            }
        });
        await eventProcessingServer.inject({
            method: 'POST',
            url: '/events/' + eventType.id,
            body: {
                otherValue: 100
            }
        });

        const rule = await createRule(adminServer, target.id, eventType.id, {
            type: 'tumbling',
            group: {
                average: { _avg: '_value' },
                count: { _sum: 1 },
                max: { _max: '_value' },
                min: { _min: '_value' },
                stdDevPop: { _stdDevPop: '_value' },
                stdDevSamp: { _stdDevSamp: '_value' }
            },
            windowSize: {
                unit: 'minute',
                value: 1
            }
        });
        const ruleId = ObjectId.createFromHexString(rule.id);

        const scope = nock('http://example.org')
            .post('/', {
                average: 15,
                count: 3,
                max: 15,
                min: 15,
                stdDevPop: 0,
                stdDevSamp: null
            })
            .reply(200);

        await executeRuleJobHandler({ ruleId });

        expect(scope.isDone()).toBe(true);
    });

    it('should call target when tumbling rule filter match', async () => {
        const eventType = await createEventType(adminServer);
        const target = await createTarget(adminServer, 'http://example.org');
        const rule = await createRule(adminServer, target.id, eventType.id, {
            type: 'tumbling',
            filters: { average: 40 },
            group: { average: { _avg: '_value' } },
            windowSize: {
                unit: 'minute',
                value: 1
            }
        });
        const ruleId = ObjectId.createFromHexString(rule.id);

        await eventProcessingServer.inject({
            method: 'POST',
            url: '/events/' + eventType.id,
            body: {
                value: 5
            }
        });
        await eventProcessingServer.inject({
            method: 'POST',
            url: '/events/' + eventType.id,
            body: {
                value: 15
            }
        });
        await eventProcessingServer.inject({
            method: 'POST',
            url: '/events/' + eventType.id,
            body: {
                value: 100
            }
        });

        const scope = nock('http://example.org')
            .post('/', { average: 40 })
            .reply(200);

        await executeRuleJobHandler({ ruleId });

        expect(scope.isDone()).toBe(true);
    });

    async function createTarget(adminServer, url = 'http://example.org') {
        const createResponse = await adminServer.inject({
            method: 'POST',
            url: '/targets',
            body: {
                name: 'a target',
                url
            }
        });
        expect(createResponse.statusCode).toBe(201);
        expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
        return JSON.parse(createResponse.payload);
    }

    async function createRule(adminServer, targetId, eventTypeId, rule = {}) {
        const defaultRuleValues = {
            name: 'a rule',
            type: 'realtime',
            skipOnConsecutivesMatches: false
        };
        const createResponse = await adminServer.inject({
            method: 'POST',
            url: '/rules',
            body: {
                ...defaultRuleValues,
                eventTypeId,
                targetId,
                ...rule
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
                name: 'an event type'
            }
        });
        expect(createResponse.statusCode).toBe(201);
        expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
        return JSON.parse(createResponse.payload);
    }
});
