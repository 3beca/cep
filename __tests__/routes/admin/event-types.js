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
        server = app.server;
    });

    afterEach(async () => {
        await app.server.close();
        await app.db.dropDatabase();
        await app.dbClient.close();
    });

    describe('event types', () => {

        describe('get', () => {
            it('should return 200 with array of event types', async () => {
                const createResponse = await server.inject({
                    method: 'POST',
                    url: '/admin/event-types',
                    body: {
                        name: 'an event type'
                    }
                });
                expect(createResponse.statusCode).toBe(201);
                expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
                const createdEvent = JSON.parse(createResponse.payload);

                const response = await server.inject({
                    method: 'GET',
                    url: '/admin/event-types'
                });
                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const listResponse = JSON.parse(response.payload);
                expect(listResponse.results.length).toBe(1);
                const event = listResponse.results[0];
                expect(event).toEqual(createdEvent);
            });

            it('should set next and not prev link in first page when event types returned match page size', async () => {
                await Promise.all([1, 2, 3, 4, 5].map(value => server.inject({
                    method: 'POST',
                    url: '/admin/event-types',
                    body: {
                        name: 'an event type ' + value
                    }
                })));
                const responseNoPrev = await server.inject({
                    method: 'GET',
                    url: '/admin/event-types?page=1&pageSize=2'
                });
                const payloadResponseNoPrev = JSON.parse(responseNoPrev.payload);
                expect(payloadResponseNoPrev.prev).toBeUndefined();
                expect(payloadResponseNoPrev.next).toBe('http://localhost:8888/admin/event-types?page=2&pageSize=2');
            });

            it('should not set next and not prev link in first page when event types returned are lower than page size', async () => {
                await Promise.all([1, 2].map(value => server.inject({
                    method: 'POST',
                    url: '/admin/event-types',
                    body: {
                        name: 'an event type ' + value
                    }
                })));
                const responseNoPrev = await server.inject({
                    method: 'GET',
                    url: '/admin/event-types?page=1&pageSize=3'
                });
                const payloadResponseNoPrev = JSON.parse(responseNoPrev.payload);
                expect(payloadResponseNoPrev.prev).toBeUndefined();
                expect(payloadResponseNoPrev.next).toBeUndefined();
            });

            it('should set next and prev link if a middle page', async () => {
                await Promise.all([1, 2, 3, 4, 5].map(value => server.inject({
                    method: 'POST',
                    url: '/admin/event-types',
                    body: {
                        name: 'an event type ' + value
                    }
                })));
                const responseNoPrev = await server.inject({
                    method: 'GET',
                    url: '/admin/event-types?page=2&pageSize=2'
                });
                const payloadResponseNoPrev = JSON.parse(responseNoPrev.payload);
                expect(payloadResponseNoPrev.prev).toBe('http://localhost:8888/admin/event-types?page=1&pageSize=2');
                expect(payloadResponseNoPrev.next).toBe('http://localhost:8888/admin/event-types?page=3&pageSize=2');
            });

            it('should return 400 with invalid page query string', async () => {
                const response = await server.inject({
                    method: 'GET',
                    url: '/admin/event-types?page=invalid'
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'querystring.page should be integer'
                }));
            });

            it('should return 400 with invalid pageSize query string', async () => {
                const response = await server.inject({
                    method: 'GET',
                    url: '/admin/event-types?pageSize=invalid'
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'querystring.pageSize should be integer'
                }));
            });

            it('should return 400 with pageSize query string greater than 100', async () => {
                const response = await server.inject({
                    method: 'GET',
                    url: '/admin/event-types?pageSize=101'
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'querystring.pageSize should be <= 100'
                }));
            });

            it('should return 400 with pageSize query string lesser than 1', async () => {
                const response = await server.inject({
                    method: 'GET',
                    url: '/admin/event-types?pageSize=0'
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'querystring.pageSize should be >= 1'
                }));
            });

            it('should return 400 with page query string lesser than 1', async () => {
                const response = await server.inject({
                    method: 'GET',
                    url: '/admin/event-types?page=0'
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'querystring.page should be >= 1'
                }));
            });
        });

        describe('get by id', () => {

            it('should return 404 when event does not exists', async () => {
                const response = await server.inject({
                    method: 'GET',
                    url: '/admin/event-types/' + new ObjectId()
                });
                expect(response.statusCode).toBe(404);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ message: 'Resource not found' }));
            });

            it('should return 200 with array of event types', async () => {
                const createResponse = await server.inject({
                    method: 'POST',
                    url: '/admin/event-types',
                    body: {
                        name: 'an event type'
                    }
                });
                expect(createResponse.statusCode).toBe(201);
                expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
                const createdEvent = JSON.parse(createResponse.payload);

                const response = await server.inject({
                    method: 'GET',
                    url: '/admin/event-types/' + createdEvent.id
                });
                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const getEvent = JSON.parse(response.payload);
                expect(getEvent).toEqual(createdEvent);
            });
        });

        describe('post', () => {
            it('should return 400 when name is undefined', async () => {
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/event-types',
                    body: {
                        name: undefined
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'body should have required property \'name\'' }));
            });

            it('should return 400 when name is longer than 100 characters', async () => {
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/event-types',
                    body: {
                        name: 'a'.repeat(101)
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'body.name should NOT be longer than 100 characters' }));
            });

            it('should return 201 with created event when request is valid', async () => {
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/event-types',
                    body: {
                        name: 'sensor-data'
                    }
                });
                expect(response.statusCode).toBe(201);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const event = JSON.parse(response.payload);
                expect(response.headers.location).toBe(`http://localhost:8888/admin/event-types/${event.id}`);
                expect(event.name).toBe('sensor-data');
                expect(event.url).toBe(`http://localhost:8888/events/${event.id}`);
                expect(ObjectId.isValid(event.id)).toBe(true);
            });

            it('should return 409 when try to create an event type with the same name', async () => {
                const responseCreateEvent = await server.inject({
                    method: 'POST',
                    url: '/admin/event-types',
                    body: {
                        name: 'same name'
                    }
                });
                const event = JSON.parse(responseCreateEvent.payload);
                const responseCreateEvent2 = await server.inject({
                    method: 'POST',
                    url: '/admin/event-types',
                    body: {
                        name: 'same name'
                    }
                });
                expect(responseCreateEvent2.statusCode).toBe(409);
                expect(responseCreateEvent2.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(responseCreateEvent2.headers.location).toBe(`http://localhost:8888/admin/event-types/${event.id}`);
                expect(responseCreateEvent2.payload).toBe(JSON.stringify({ message: `Event type name must be unique and is already taken by event type with id ${event.id}` }));
            });
        });

        describe('delete', () => {
            it('should return 204 when event does not exist', async () => {
                const response = await server.inject({
                    method: 'DELETE',
                    url: '/admin/event-types/' + new ObjectId()
                });
                expect(response.statusCode).toBe(204);
            });

            it('should return 204 when event exists', async () => {
                const createResponse = await server.inject({
                    method: 'POST',
                    url: '/admin/event-types',
                    body: {
                        name: 'sensor-data'
                    }
                });
                expect(createResponse.statusCode).toBe(201);
                expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
                const createdEvent = JSON.parse(createResponse.payload);

                const deleteResponse = await server.inject({
                    method: 'DELETE',
                    url: '/admin/event-types/' + createdEvent.id
                });
                expect(deleteResponse.statusCode).toBe(204);

                const getResponse = await server.inject({
                    method: 'GET',
                    url: '/admin/event-types' + createdEvent.id
                });
                expect(getResponse.statusCode).toBe(404);
            });

            it('should return 400 when event type is used in one or more rules', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                const rule = await createRule(server, target.id, eventType.id);

                const deleteResponse = await server.inject({
                    method: 'DELETE',
                    url: '/admin/event-types/' + eventType.id
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

    async function createTarget(server) {
        const createResponse = await server.inject({
            method: 'POST',
            url: '/admin/targets',
            body: {
                name: 'a target',
                url: 'http://example.org'
            }
        });
        expect(createResponse.statusCode).toBe(201);
        expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
        return JSON.parse(createResponse.payload);
    }

    async function createRule(server, targetId, eventTypeId) {
        const createResponse = await server.inject({
            method: 'POST',
            url: '/admin/rules',
            body: {
                name: 'a rule',
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
