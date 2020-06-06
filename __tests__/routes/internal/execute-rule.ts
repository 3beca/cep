jest.mock('pino');
import { ObjectId } from 'mongodb';
import nock from 'nock';
import config from '../../../src/config';
import { buildApp } from '../../../src/app';

describe('execute rule', () => {
    let app;
    let server;
    let internalServer;

    beforeEach(async () => {
        const options = {
            databaseName: `test-${new ObjectId()}`,
            databaseUrl: config.mongodb.databaseUrl,
            trustProxy: false,
            enableCors: false,
            scheduler: config.scheduler,
            internalHttp: config.internalHttp
        };
        app = await buildApp(options);
        server = app.getServer();
        internalServer = app.getInternalServer();
    });

    afterEach(async () => {
        await app.getDatabase().dropDatabase();
        await app.close();
        nock.cleanAll();
    });

    it('should return 400 when rule id is not a valid ObjectId', async () => {
        const response = await internalServer.inject({
            method: 'POST',
            url: '/execute-rule/invalid-object-id'
        });
        expect(response.statusCode).toBe(400);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(response.payload).toBe(JSON.stringify({
            statusCode: 400,
            error: 'Bad Request',
            message: 'params rule id must be a valid ObjectId'
        }));
    });

    it('should return 404 when rule does not exists', async () => {
        const response = await server.inject({
            method: 'POST',
            url: '/execute-rule/' + new ObjectId()
        });
        expect(response.statusCode).toBe(404);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(response.payload).toBe(JSON.stringify({ message: 'Resource not found' }));
    });

    it('should return 400 when rule is not of type tumbling', async () => {
        const eventType = await createEventType(server);
        const target = await createTarget(server, 'http://example.org/');
        const rule = await createRule(server, target.id, eventType.id, { filters: { value: 2 }});

        const response = await internalServer.inject({
            method: 'POST',
            url: '/execute-rule/' + rule.id
        });
        expect(response.statusCode).toBe(400);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(response.payload).toBe(JSON.stringify({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Cannot execute rule of type \'realtime\'. Only rule of type tumbling are supported.'
        }));
    });

    async function createTarget(server, url = 'http://example.org') {
        const createResponse = await server.inject({
            method: 'POST',
            url: '/admin/targets',
            body: {
                name: 'a target',
                url
            }
        });
        expect(createResponse.statusCode).toBe(201);
        expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
        return JSON.parse(createResponse.payload);
    }

    async function createRule(server, targetId, eventTypeId, rule = {}) {
        const defaultRuleValues = {
            name: 'a rule',
            type: 'realtime',
            skipOnConsecutivesMatches: false
        };
        const createResponse = await server.inject({
            method: 'POST',
            url: '/admin/rules',
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

    async function createEventType(server) {
        const createResponse = await server.inject({
            method: 'POST',
            url: '/admin/event-types',
            body: {
                name: 'an event type'
            }
        });
        expect(createResponse.statusCode).toBe(201);
        expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
        return JSON.parse(createResponse.payload);
    }
});
