jest.mock('pino');
import { ObjectId } from 'mongodb';
import config from '../../../src/config';
import { buildApp } from '../../../src/app';
import nock from 'nock';

describe('admin', () => {
    let app;
    let server;

    beforeEach(async () => {
        const options = {
            databaseName: `test-${new ObjectId()}`,
            databaseUrl: config.mongodb.databaseUrl
        };
        app = await buildApp(options);
        server = app.getServer();
    });

    afterEach(async () => {
        await app.getDatabase().dropDatabase();
        await app.close();
        nock.cleanAll();
    });

    describe('events', () => {

        it('should return an empty list of events when no events have been processed', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/admin/events'
            });
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            const listResponse = JSON.parse(response.payload);
            expect(listResponse.results.length).toBe(0);
            expect(listResponse.next).toBe(undefined);
            expect(listResponse.prev).toBe(undefined);
        });

        it('should return a list of the processed events', async () => {
            const eventType = await createEventType(server);

            await processEvent(server, eventType.id, { value: 8 });
            await processEvent(server, eventType.id, { value: 7 });

            const response = await server.inject({
                method: 'GET',
                url: '/admin/events'
            });
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            const listResponse = JSON.parse(response.payload);
            expect(listResponse.results.length).toBe(2);
            const event1 = listResponse.results[0];
            expect(event1.eventTypeId).toBe(eventType.id);
            expect(event1.eventTypeName).toBe(eventType.name);
            expect(event1.payload).toStrictEqual({ value: 7 });
            expect(event1.createdAt).not.toBe(undefined);
            const event2 = listResponse.results[1];
            expect(event2.eventTypeId).toBe(eventType.id);
            expect(event2.eventTypeName).toBe(eventType.name);
            expect(event2.payload).toStrictEqual({ value: 8 });
            expect(event2.createdAt).not.toBe(undefined);
            expect(listResponse.next).toBe(undefined);
            expect(listResponse.prev).toBe(undefined);
        });

        it('should return a list of the processed events and rule matching and target response', async () => {
            const eventType = await createEventType(server);
            const target1 = await createTarget(server, 'http://example.org');
            const target2 = await createTarget(server, 'http://example.com');
            const rule1 = await createRule(server, target1.id, eventType.id, 'rule 1', { value: 2 });
            const rule2 = await createRule(server, target2.id, eventType.id, 'rule 2', { value: 2 });

            const scope1 = nock('http://example.org')
                .post('/', { value: 2 })
                .once()
                .reply(200, { success: true });

            const scope2 = nock('http://example.com')
                .post('/', { value: 2 })
                .once()
                .reply(503);

            await processEvent(server, eventType.id, { value: 2 });

            const response = await server.inject({
                method: 'GET',
                url: '/admin/events'
            });
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            const listResponse = JSON.parse(response.payload);
            expect(listResponse.results.length).toBe(1);
            const event1 = listResponse.results[0];
            expect(event1.eventTypeId).toBe(eventType.id);
            expect(event1.eventTypeName).toBe(eventType.name);
            expect(event1.payload).toStrictEqual({ value: 2 });
            expect(event1.createdAt).not.toBe(undefined);
            expect(event1.rules).toStrictEqual([
                { id: rule1.id, name: rule1.name, targetId: rule1.targetId },
                { id: rule2.id, name: rule2.name, targetId: rule2.targetId },
            ]);
            expect(event1.targets).toStrictEqual([{
                id: target1.id,
                name: target1.name,
                response: {
                    statusCode: 200,
                    body: {
                        success: true
                    }
                }
            }, {
                id: target2.id,
                name: target2.name,
                response: {
                    statusCode: 503
                }
            }]);
            expect(scope1.isDone()).toBe(true);
            expect(scope2.isDone()).toBe(true);
        });

        async function processEvent(server, eventTypeId, eventPayload) {
            const response = await server.inject({
                method: 'POST',
                url: '/events/' + eventTypeId,
                body: eventPayload
            });
            expect(response.statusCode).toBe(204);
        }

        async function createTarget(server, url = 'http://example.org') {
            const createResponse = await server.inject({
                method: 'POST',
                url: '/admin/targets',
                body: {
                    name: 'a target ' + new ObjectId().toHexString(),
                    url
                }
            });
            expect(createResponse.statusCode).toBe(201);
            expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
            return JSON.parse(createResponse.payload);
        }

        async function createRule(server, targetId, eventTypeId, name = 'a rule', filters: any = undefined) {
            const createResponse = await server.inject({
                method: 'POST',
                url: '/admin/rules',
                body: {
                    name,
                    eventTypeId,
                    targetId,
                    filters
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
});
