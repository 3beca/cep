import { buildServer } from '../../../src/server';
import rulesService from '../../../src/services/rules-services';
import { ObjectId } from 'bson';

describe('admin', () => {
    let server;

    beforeEach(() => {
        server = buildServer();
    });

    afterEach(async () => {
        await server.close();
        await rulesService.purge();
    });

    describe('rules', () => {

        describe('get', () => {
            it('should return 200 with array of rules', async () => {
                const createResponse = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule'
                    }
                });
                expect(createResponse.statusCode).toBe(201);
                expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
                const createdRule = JSON.parse(createResponse.payload);

                const response = await server.inject({
                    method: 'GET',
                    url: '/admin/rules'
                });
                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const listResponse = JSON.parse(response.payload);
                expect(listResponse.results.length).toBe(1);
                const rule = listResponse.results[0];
                expect(rule).toEqual(createdRule);
            });

            it('should set next and not prev link in first page when rules returned match page size', async () => {
                await Promise.all([1, 2, 3, 4, 5].map(value => server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule ' + value
                    }
                })));
                const responseNoPrev = await server.inject({
                    method: 'GET',
                    url: '/admin/rules?page=1&pageSize=2'
                });
                const payloadResponseNoPrev = JSON.parse(responseNoPrev.payload);
                expect(payloadResponseNoPrev.prev).toBeUndefined();
                expect(payloadResponseNoPrev.next).toBe('http://localhost:8888/admin/rules?page=2&pageSize=2');
            });

            it('should not set next and not prev link in first page when rules returned are lower than page size', async () => {
                await Promise.all([1, 2].map(value => server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule ' + value
                    }
                })));
                const responseNoPrev = await server.inject({
                    method: 'GET',
                    url: '/admin/rules?page=1&pageSize=3'
                });
                const payloadResponseNoPrev = JSON.parse(responseNoPrev.payload);
                expect(payloadResponseNoPrev.prev).toBeUndefined();
                expect(payloadResponseNoPrev.next).toBeUndefined();
            });

            it('should set next and prev link if a middle page', async () => {
                await Promise.all([1, 2, 3, 4, 5].map(value => server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule ' + value
                    }
                })));
                const responseNoPrev = await server.inject({
                    method: 'GET',
                    url: '/admin/rules?page=2&pageSize=2'
                });
                const payloadResponseNoPrev = JSON.parse(responseNoPrev.payload);
                expect(payloadResponseNoPrev.prev).toBe('http://localhost:8888/admin/rules?page=1&pageSize=2');
                expect(payloadResponseNoPrev.next).toBe('http://localhost:8888/admin/rules?page=3&pageSize=2');
            });

            it('should return 400 with invalid page query string', async () => {
                const response = await server.inject({
                    method: 'GET',
                    url: '/admin/rules?page=invalid'
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
                    url: '/admin/rules?pageSize=invalid'
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
                    url: '/admin/rules?pageSize=101'
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
                    url: '/admin/rules?pageSize=0'
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
                    url: '/admin/rules?page=0'
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

            it('should return 404 when rule does not exists', async () => {
                const response = await server.inject({
                    method: 'GET',
                    url: '/admin/rules/' + new ObjectId()
                });
                expect(response.statusCode).toBe(404);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ message: 'Resource not found' }));
            });

            it('should return 200 with array of rules', async () => {
                const createResponse = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule'
                    }
                });
                expect(createResponse.statusCode).toBe(201);
                expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
                const createdRule = JSON.parse(createResponse.payload);

                const response = await server.inject({
                    method: 'GET',
                    url: '/admin/rules/' + createdRule.id
                });
                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const getRule = JSON.parse(response.payload);
                expect(getRule).toEqual(createdRule);
            });
        });

        describe('post', () => {
            it('should return 400 when name is undefined', async () => {
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: undefined,
                        url: 'https://example.org'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'body should have required property \'name\'' }));
            });

            it('should return 400 when name is longer than 100 characters', async () => {
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a'.repeat(101),
                        url: 'https://example.org'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'body.name should NOT be longer than 100 characters' }));
            });

            it('should return 201 with created rule when request is valid', async () => {
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule'
                    }
                });
                expect(response.statusCode).toBe(201);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const rule = JSON.parse(response.payload);
                expect(response.headers.location).toBe(`http://localhost:8888/admin/rules/${rule.id}`);
                expect(rule.name).toBe('a rule');
                expect(ObjectId.isValid(rule.id)).toBe(true);
            });

            it('should return 409 when try to create a rule with the same name', async () => {
                const responseCreaterule = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'same name',
                        url: 'http://example.org'
                    }
                });
                const rule = JSON.parse(responseCreaterule.payload);
                const responseCreaterule2 = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'same name',
                        url: 'http://example.org'
                    }
                });
                expect(responseCreaterule2.statusCode).toBe(409);
                expect(responseCreaterule2.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(responseCreaterule2.headers.location).toBe(`http://localhost:8888/admin/rules/${rule.id}`);
                expect(responseCreaterule2.payload).toBe(JSON.stringify({ message: `Rule name must be unique and is already taken by rule with id ${rule.id}` }));
            });
        });

        describe('delete', () => {
            it('should return 204 when rule does not exist', async () => {
                const response = await server.inject({
                    method: 'DELETE',
                    url: '/admin/rules/' + new ObjectId()
                });
                expect(response.statusCode).toBe(204);
            });

            it('should return 204 when rule exists', async () => {
                const createResponse = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        url: 'http://example.org'
                    }
                });
                expect(createResponse.statusCode).toBe(201);
                expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
                const createdRule = JSON.parse(createResponse.payload);

                const deleteResponse = await server.inject({
                    method: 'DELETE',
                    url: '/admin/rules/' + createdRule.id
                });
                expect(deleteResponse.statusCode).toBe(204);

                const getResponse = await server.inject({
                    method: 'GET',
                    url: '/admin/rules' + createdRule.id
                });
                expect(getResponse.statusCode).toBe(404);
            });
        });
    });
});