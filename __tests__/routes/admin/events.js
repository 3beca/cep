jest.mock('pino');
import { ObjectId } from 'mongodb';
import config from '../../../src/config';
import { buildApp } from '../../../src/app';

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
            expect(event1.payload).toStrictEqual({ value: 7 });
            const event2 = listResponse.results[1];
            expect(event2.eventTypeId).toBe(eventType.id);
            expect(event2.payload).toStrictEqual({ value: 8 });
            expect(listResponse.next).toBe(undefined);
            expect(listResponse.prev).toBe(undefined);
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
                    name: 'a target',
                    url
                }
            });
            expect(createResponse.statusCode).toBe(201);
            expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
            return JSON.parse(createResponse.payload);
        }

        async function createRule(server, targetId, eventTypeId, name = 'a rule', filters = undefined) {
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
