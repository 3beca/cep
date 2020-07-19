jest.mock('pino');
import { ObjectId } from 'mongodb';
import { buildApp, App } from '../../../src/app';
import { buildAppConfig } from '../../../src/config';

describe('admin', () => {
    let app: App;
    let adminServer;

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
    });

    afterEach(async () => {
        await app.getDatabase().dropDatabase();
        await app.close();
    });

    describe('event types', () => {

        describe('get', () => {

            it('should return 200 with array of event types', async () => {
                const createResponse = await adminServer.inject({
                    method: 'POST',
                    url: '/event-types',
                    body: {
                        name: 'an event type'
                    }
                });
                expect(createResponse.statusCode).toBe(201);
                expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
                const createdEvent = JSON.parse(createResponse.payload);

                const response = await adminServer.inject({
                    method: 'GET',
                    url: '/event-types'
                });
                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const listResponse = JSON.parse(response.payload);
                expect(listResponse.results.length).toBe(1);
                const event = listResponse.results[0];
                expect(event).toEqual(createdEvent);
            });

            it('should return 200 with array of event types filtered by search query string', async () => {
                await createEventType(adminServer, 'my event?ype');
                await createEventType(adminServer, 't?y');
                await createEventType(adminServer, 'good targ?t');
                await createEventType(adminServer, 'bad targ?t');
                await createEventType(adminServer, 'bbbbt?yppp');

                const response = await adminServer.inject({
                    method: 'GET',
                    url: '/event-types?search=T%3FY'
                });
                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const listResponse = JSON.parse(response.payload);
                expect(listResponse.results.length).toBe(3);
                expect(listResponse.results[0].name).toBe('bbbbt?yppp');
                expect(listResponse.results[1].name).toBe('my event?ype');
                expect(listResponse.results[2].name).toBe('t?y');
            });

            it('should return 200 with next and prev links filtered by search query string', async () => {
                await createEventType(adminServer, 'my event?ype');
                await createEventType(adminServer, 't?y');
                await createEventType(adminServer, 'good targ?t');
                await createEventType(adminServer, 'bad targ?t');
                await createEventType(adminServer, 'bbbbt?yppp');

                const response = await adminServer.inject({
                    method: 'GET',
                    url: '/event-types?search=T%3FY&pageSize=1&page=2'
                });
                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const listResponse = JSON.parse(response.payload);
                expect(listResponse.results.length).toBe(1);
                expect(listResponse.results[0].name).toBe('my event?ype');
                expect(listResponse.prev).toBe('http://localhost:8888/event-types?page=1&pageSize=1&search=T%3FY');
                expect(listResponse.next).toBe('http://localhost:8888/event-types?page=3&pageSize=1&search=T%3FY');
            });

            it('should set next and not prev link in first page when event types returned match page size', async () => {
                await Promise.all([1, 2, 3, 4, 5].map(value => adminServer.inject({
                    method: 'POST',
                    url: '/event-types',
                    body: {
                        name: 'an event type ' + value
                    }
                })));
                const responseNoPrev = await adminServer.inject({
                    method: 'GET',
                    url: '/event-types?page=1&pageSize=2'
                });
                const payloadResponseNoPrev = JSON.parse(responseNoPrev.payload);
                expect(payloadResponseNoPrev.prev).toBeUndefined();
                expect(payloadResponseNoPrev.next).toBe('http://localhost:8888/event-types?page=2&pageSize=2');
            });

            it('should not set next and not prev link in first page when event types returned are lower than page size', async () => {
                await Promise.all([1, 2].map(value => adminServer.inject({
                    method: 'POST',
                    url: '/event-types',
                    body: {
                        name: 'an event type ' + value
                    }
                })));
                const responseNoPrev = await adminServer.inject({
                    method: 'GET',
                    url: '/event-types?page=1&pageSize=3'
                });
                const payloadResponseNoPrev = JSON.parse(responseNoPrev.payload);
                expect(payloadResponseNoPrev.prev).toBeUndefined();
                expect(payloadResponseNoPrev.next).toBeUndefined();
            });

            it('should set next and prev link if a middle page', async () => {
                await Promise.all([1, 2, 3, 4, 5].map(value => adminServer.inject({
                    method: 'POST',
                    url: '/event-types',
                    body: {
                        name: 'an event type ' + value
                    }
                })));
                const responseNoPrev = await adminServer.inject({
                    method: 'GET',
                    url: '/event-types?page=2&pageSize=2'
                });
                const payloadResponseNoPrev = JSON.parse(responseNoPrev.payload);
                expect(payloadResponseNoPrev.prev).toBe('http://localhost:8888/event-types?page=1&pageSize=2');
                expect(payloadResponseNoPrev.next).toBe('http://localhost:8888/event-types?page=3&pageSize=2');
            });

            it('should return 400 with invalid page query string', async () => {
                const response = await adminServer.inject({
                    method: 'GET',
                    url: '/event-types?page=invalid'
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'querystring/page should be integer'
                }));
            });

            it('should return 400 with invalid pageSize query string', async () => {
                const response = await adminServer.inject({
                    method: 'GET',
                    url: '/event-types?pageSize=invalid'
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'querystring/pageSize should be integer'
                }));
            });

            it('should return 400 with pageSize query string greater than 100', async () => {
                const response = await adminServer.inject({
                    method: 'GET',
                    url: '/event-types?pageSize=101'
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'querystring/pageSize should be <= 100'
                }));
            });

            it('should return 400 with pageSize query string lesser than 1', async () => {
                const response = await adminServer.inject({
                    method: 'GET',
                    url: '/event-types?pageSize=0'
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'querystring/pageSize should be >= 1'
                }));
            });

            it('should return 400 with page query string lesser than 1', async () => {
                const response = await adminServer.inject({
                    method: 'GET',
                    url: '/event-types?page=0'
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'querystring/page should be >= 1'
                }));
            });
        });

        describe('get by id', () => {

            it('should return 400 when event identifier is not a valid ObjectId', async () => {
                const response = await adminServer.inject({
                    method: 'GET',
                    url: '/event-types/invalid-object-id-here'
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'params event type id must be a valid ObjectId' }));
            });

            it('should return 404 when event does not exists', async () => {
                const response = await adminServer.inject({
                    method: 'GET',
                    url: '/event-types/' + new ObjectId()
                });
                expect(response.statusCode).toBe(404);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ message: 'Resource not found' }));
            });

            it('should return 200 with the event types', async () => {
                const createResponse = await adminServer.inject({
                    method: 'POST',
                    url: '/event-types',
                    body: {
                        name: 'an event type'
                    }
                });
                expect(createResponse.statusCode).toBe(201);
                expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
                const createdEvent = JSON.parse(createResponse.payload);

                const response = await adminServer.inject({
                    method: 'GET',
                    url: '/event-types/' + createdEvent.id
                });
                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const getEvent = JSON.parse(response.payload);
                expect(getEvent).toEqual(createdEvent);
            });
        });

        describe('post', () => {
            it('should return 400 when name is undefined', async () => {
                const response = await adminServer.inject({
                    method: 'POST',
                    url: '/event-types',
                    body: {
                        name: undefined
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'body should have required property \'name\'' }));
            });

            it('should return 400 when name is longer than 100 characters', async () => {
                const response = await adminServer.inject({
                    method: 'POST',
                    url: '/event-types',
                    body: {
                        name: 'a'.repeat(101)
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'body/name should NOT be longer than 100 characters' }));
            });

            it('should return 201 with created event when request is valid', async () => {
                const response = await adminServer.inject({
                    method: 'POST',
                    url: '/event-types',
                    body: {
                        name: 'sensor-data'
                    }
                });
                expect(response.statusCode).toBe(201);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const event = JSON.parse(response.payload);
                expect(response.headers.location).toBe(`http://localhost:8888/event-types/${event.id}`);
                expect(event.name).toBe('sensor-data');
                expect(event.url).toBe(`http://localhost:8888/events/${event.id}`);
                expect(ObjectId.isValid(event.id)).toBe(true);
            });

            it('should return 409 when try to create an event type with the same name', async () => {
                const responseCreateEvent = await adminServer.inject({
                    method: 'POST',
                    url: '/event-types',
                    body: {
                        name: 'same name'
                    }
                });
                const event = JSON.parse(responseCreateEvent.payload);
                const responseCreateEvent2 = await adminServer.inject({
                    method: 'POST',
                    url: '/event-types',
                    body: {
                        name: 'same name'
                    }
                });
                expect(responseCreateEvent2.statusCode).toBe(409);
                expect(responseCreateEvent2.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(responseCreateEvent2.headers.location).toBe(`http://localhost:8888/event-types/${event.id}`);
                expect(responseCreateEvent2.payload).toBe(JSON.stringify({ message: `Event type name must be unique and is already taken by event type with id ${event.id}` }));
            });
        });

        describe('delete', () => {

            it('should return 400 when event identifier is not a valid ObjectId', async () => {
                const response = await adminServer.inject({
                    method: 'DELETE',
                    url: '/event-types/invalid-object-id-here'
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'params event type id must be a valid ObjectId' }));
            });

            it('should return 204 when event does not exist', async () => {
                const response = await adminServer.inject({
                    method: 'DELETE',
                    url: '/event-types/' + new ObjectId()
                });
                expect(response.statusCode).toBe(204);
            });

            it('should return 204 when event exists', async () => {
                const createResponse = await adminServer.inject({
                    method: 'POST',
                    url: '/event-types',
                    body: {
                        name: 'sensor-data'
                    }
                });
                expect(createResponse.statusCode).toBe(201);
                expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
                const createdEvent = JSON.parse(createResponse.payload);

                const deleteResponse = await adminServer.inject({
                    method: 'DELETE',
                    url: '/event-types/' + createdEvent.id
                });
                expect(deleteResponse.statusCode).toBe(204);

                const getResponse = await adminServer.inject({
                    method: 'GET',
                    url: '/event-types/' + createdEvent.id
                });
                expect(getResponse.statusCode).toBe(404);
            });

            it('should return 400 when event type is used in one or more rules', async () => {
                const eventType = await createEventType(adminServer);
                const target = await createTarget(adminServer);
                const rule = await createRule(adminServer, target.id, eventType.id);

                const deleteResponse = await adminServer.inject({
                    method: 'DELETE',
                    url: '/event-types/' + eventType.id
                });
                expect(deleteResponse.statusCode).toBe(400);
                expect(deleteResponse.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(deleteResponse.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: `Event type cannot be deleted as in use by rules ["${rule.id}"]`
                }));
            });
        });
    });

    async function createTarget(adminServer) {
        const createResponse = await adminServer.inject({
            method: 'POST',
            url: '/targets',
            body: {
                name: 'a target',
                url: 'http://example.org'
            }
        });
        expect(createResponse.statusCode).toBe(201);
        expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
        return JSON.parse(createResponse.payload);
    }

    async function createRule(adminServer, targetId, eventTypeId) {
        const createResponse = await adminServer.inject({
            method: 'POST',
            url: '/rules',
            body: {
                name: 'a rule',
                type: 'realtime',
                eventTypeId,
                targetId,
                filters: {
                    field: 'value'
                }
            }
        });
        expect(createResponse.statusCode).toBe(201);
        expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
        return JSON.parse(createResponse.payload);
    }

    async function createEventType(adminServer, name = 'an event type') {
        const createResponse = await adminServer.inject({
            method: 'POST',
            url: '/event-types',
            body: {
                name
            }
        });
        expect(createResponse.statusCode).toBe(201);
        expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
        return JSON.parse(createResponse.payload);
    }
});
