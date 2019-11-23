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

    describe('targets', () => {

        describe('get', () => {
            it('should return 200 with array of targets', async () => {
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
                const createdTarget = JSON.parse(createResponse.payload);

                const response = await server.inject({
                    method: 'GET',
                    url: '/admin/targets'
                });
                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const listResponse = JSON.parse(response.payload);
                expect(listResponse.results.length).toBe(1);
                const target = listResponse.results[0];
                expect(target).toEqual(createdTarget);
            });

            it('should set next and not prev link in first page when targets returned match page size', async () => {
                await Promise.all([1, 2, 3, 4, 5].map(value => server.inject({
                    method: 'POST',
                    url: '/admin/targets',
                    body: {
                        name: 'a target ' + value,
                        url: 'http://example.org'
                    }
                })));
                const responseNoPrev = await server.inject({
                    method: 'GET',
                    url: '/admin/targets?page=1&pageSize=2'
                });
                const payloadResponseNoPrev = JSON.parse(responseNoPrev.payload);
                expect(payloadResponseNoPrev.prev).toBeUndefined();
                expect(payloadResponseNoPrev.next).toBe('http://localhost:8888/admin/targets?page=2&pageSize=2');
            });

            it('should not set next and not prev link in first page when targets returned are lower than page size', async () => {
                await Promise.all([1, 2].map(value => server.inject({
                    method: 'POST',
                    url: '/admin/targets',
                    body: {
                        name: 'a target ' + value,
                        url: 'http://example.org'
                    }
                })));
                const responseNoPrev = await server.inject({
                    method: 'GET',
                    url: '/admin/targets?page=1&pageSize=3'
                });
                const payloadResponseNoPrev = JSON.parse(responseNoPrev.payload);
                expect(payloadResponseNoPrev.prev).toBeUndefined();
                expect(payloadResponseNoPrev.next).toBeUndefined();
            });

            it('should set next and prev link if a middle page', async () => {
                await Promise.all([1, 2, 3, 4, 5].map(value => server.inject({
                    method: 'POST',
                    url: '/admin/targets',
                    body: {
                        name: 'a target ' + value,
                        url: 'http://example.org'
                    }
                })));
                const responseNoPrev = await server.inject({
                    method: 'GET',
                    url: '/admin/targets?page=2&pageSize=2'
                });
                const payloadResponseNoPrev = JSON.parse(responseNoPrev.payload);
                expect(payloadResponseNoPrev.prev).toBe('http://localhost:8888/admin/targets?page=1&pageSize=2');
                expect(payloadResponseNoPrev.next).toBe('http://localhost:8888/admin/targets?page=3&pageSize=2');
            });

            it('should return 400 with invalid page query string', async () => {
                const response = await server.inject({
                    method: 'GET',
                    url: '/admin/targets?page=invalid'
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
                    url: '/admin/targets?pageSize=invalid'
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
                    url: '/admin/targets?pageSize=101'
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
                    url: '/admin/targets?pageSize=0'
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
                    url: '/admin/targets?page=0'
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

            it('should return 404 when target does not exists', async () => {
                const response = await server.inject({
                    method: 'GET',
                    url: '/admin/targets/' + new ObjectId()
                });
                expect(response.statusCode).toBe(404);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ message: 'Resource not found' }));
            });

            it('should return 200 with array of targets', async () => {
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
                const createdTarget = JSON.parse(createResponse.payload);

                const response = await server.inject({
                    method: 'GET',
                    url: '/admin/targets/' + createdTarget.id
                });
                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const gettarget = JSON.parse(response.payload);
                expect(gettarget).toEqual(createdTarget);
            });
        });

        describe('post', () => {
            it('should return 400 when name is undefined', async () => {
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/targets',
                    body: {
                        name: undefined,
                        url: 'https://example.org'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'body should have required property \'name\'' }));
            });

            it('should return 400 when url is undefined', async () => {
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/targets',
                    body: {
                        name: 'a target',
                        url: undefined
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'body should have required property \'url\'' }));
            });

            it('should return 400 when url is not valid', async () => {
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/targets',
                    body: {
                        name: 'a target',
                        url: 'a non valid url'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'body.url should match format "url"' }));
            });

            it('should return 400 when name is longer than 100 characters', async () => {
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/targets',
                    body: {
                        name: 'a'.repeat(101),
                        url: 'https://example.org'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'body.name should NOT be longer than 100 characters' }));
            });

            it('should return 201 with created target when request is valid', async () => {
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/targets',
                    body: {
                        name: 'a target',
                        url: 'http://example.org'
                    }
                });
                expect(response.statusCode).toBe(201);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const target = JSON.parse(response.payload);
                expect(response.headers.location).toBe(`http://localhost:8888/admin/targets/${target.id}`);
                expect(target.name).toBe('a target');
                expect(target.url).toBe('http://example.org');
                expect(ObjectId.isValid(target.id)).toBe(true);
            });

            it('should return 409 when try to create a target with the same name', async () => {
                const responseCreateTarget = await server.inject({
                    method: 'POST',
                    url: '/admin/targets',
                    body: {
                        name: 'same name',
                        url: 'http://example.org'
                    }
                });
                const target = JSON.parse(responseCreateTarget.payload);
                const responseCreateTarget2 = await server.inject({
                    method: 'POST',
                    url: '/admin/targets',
                    body: {
                        name: 'same name',
                        url: 'http://example.org'
                    }
                });
                expect(responseCreateTarget2.statusCode).toBe(409);
                expect(responseCreateTarget2.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(responseCreateTarget2.headers.location).toBe(`http://localhost:8888/admin/targets/${target.id}`);
                expect(responseCreateTarget2.payload).toBe(JSON.stringify({ message: `Target name must be unique and is already taken by target with id ${target.id}` }));
            });
        });

        describe('delete', () => {
            it('should return 204 when target does not exist', async () => {
                const response = await server.inject({
                    method: 'DELETE',
                    url: '/admin/targets/' + new ObjectId()
                });
                expect(response.statusCode).toBe(204);
            });

            it('should return 204 when target exists', async () => {
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
                const createdTarget = JSON.parse(createResponse.payload);

                const deleteResponse = await server.inject({
                    method: 'DELETE',
                    url: '/admin/targets/' + createdTarget.id
                });
                expect(deleteResponse.statusCode).toBe(204);

                const getResponse = await server.inject({
                    method: 'GET',
                    url: '/admin/targets' + createdTarget.id
                });
                expect(getResponse.statusCode).toBe(404);
            });

            it('should return 400 when target is used in one or more rules', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                const rule = await createRule(server, target.id, eventType.id);

                const deleteResponse = await server.inject({
                    method: 'DELETE',
                    url: '/admin/targets/' + target.id
                });
                expect(deleteResponse.statusCode).toBe(400);
                expect(deleteResponse.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(deleteResponse.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: `Target cannot be deleted as in use by rules ["${rule.id}"]`
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
