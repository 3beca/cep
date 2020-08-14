jest.mock('pino');
import { ObjectId } from 'mongodb';
import { buildConfig } from '../../../src/config';
import { buildApp, App } from '../../../src/app';
import nock from 'nock';
import { FastifyInstance } from 'fastify';

describe('admin server', () => {
    let app: App;
    let adminServer: FastifyInstance;
    let eventProcessingServer: FastifyInstance;

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

    describe('events', () => {

        it('should return 401 when invalid token', async () => {
            const response = await adminServer.inject({
                method: 'GET',
                url: '/events',
                headers: {
                    authorization: 'apiKey invalidApiKey'
                }
            });
            expect(response.statusCode).toBe(401);
        });

        it('should return an empty list of events when no events have been processed', async () => {
            const response = await adminServer.inject({
                method: 'GET',
                url: '/events',
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

        it('should return a list of the processed events', async () => {
            const eventType = await createEventType(adminServer);

            await processEvent(eventProcessingServer, eventType.id, { value: 8 });
            await processEvent(eventProcessingServer, eventType.id, { value: 7 });

            const response = await adminServer.inject({
                method: 'GET',
                url: '/events',
                headers: {
                    authorization: 'apiKey myApiKey2'
                }
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

        it('should return 400 bad request when events are filtered by an invalid eventTypeId', async () => {
            const response = await adminServer.inject({
                method: 'GET',
                url: '/events?eventTypeId=invalid-object-id-here',
                headers: {
                    authorization: 'apiKey myApiKey2'
                }
            });
            expect(response.statusCode).toBe(400);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'querystring/eventTypeId should be a valid ObjectId' }));
        });

        it('should return a list of the processed events filtered by eventTypeId', async () => {
            const eventType1 = await createEventType(adminServer);
            const eventType2 = await createEventType(adminServer);

            await processEvent(eventProcessingServer, eventType1.id, { value: 8 });
            await processEvent(eventProcessingServer, eventType2.id, { value: 7 });

            const response = await adminServer.inject({
                method: 'GET',
                url: '/events?eventTypeId=' + eventType1.id,
                headers: {
                    authorization: 'apiKey myApiKey2'
                }
            });
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            const listResponse = JSON.parse(response.payload);
            expect(listResponse.results.length).toBe(1);
            const event1 = listResponse.results[0];
            expect(event1.eventTypeId).toBe(eventType1.id);
            expect(event1.eventTypeName).toBe(eventType1.name);
            expect(event1.payload).toStrictEqual({ value: 8 });
            expect(event1.createdAt).not.toBe(undefined);
            expect(listResponse.next).toBe(undefined);
            expect(listResponse.prev).toBe(undefined);
        });

        async function processEvent(server, eventTypeId: string, eventPayload: any) {
            const response = await server.inject({
                method: 'POST',
                url: '/events/' + eventTypeId,
                body: eventPayload
            });
            expect(response.statusCode).toBe(204);
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
