jest.mock('pino');
import { ObjectId } from 'mongodb';
import { buildConfig } from '../../../src/config';
import { buildApp, App } from '../../../src/app';

describe('admin server', () => {
    let app: App;
    let adminServer;

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
    });

    afterEach(async () => {
        await app.getDatabase().dropDatabase();
        await app.close();
    });

    describe('targets', () => {

        describe('get', () => {

            it('should return 401 when invalid token', async () => {
                const response = await adminServer.inject({
                    method: 'GET',
                    url: '/targets',
                    headers: {
                        authorization: 'apiKey invalidApiKey'
                    }
                });
                expect(response.statusCode).toBe(401);
            });

            it('should return 200 with array of targets', async () => {
                const createResponse = await adminServer.inject({
                    method: 'POST',
                    url: '/targets',
                    body: {
                        name: 'a target',
                        url: 'http://example.org',
                        headers: {
                            authorization: 'Bearer myKey',
                            'x-app-id': '123'
                        },
                        body: {
                            title: 'Notification',
                            description: 'your sensor value is {{event.value}}'
                        }
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(createResponse.statusCode).toBe(201);
                expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
                const createdTarget = JSON.parse(createResponse.payload);
                expect(createdTarget.name).toBe('a target');
                expect(createdTarget.url).toBe('http://example.org');
                expect(createdTarget.headers).toStrictEqual({
                    authorization: 'Bearer myKey',
                    'x-app-id': '123'
                });
                expect(createdTarget.body).toStrictEqual({
                    title: 'Notification',
                    description: 'your sensor value is {{event.value}}'
                });

                const response = await adminServer.inject({
                    method: 'GET',
                    url: '/targets',
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const listResponse = JSON.parse(response.payload);
                expect(listResponse.results.length).toBe(1);
                const target = listResponse.results[0];
                expect(target).toEqual(createdTarget);
            });

            it('should return 200 with array of targets filtered by search query string', async () => {
                await createTarget(adminServer, 'my targ?t');
                await createTarget(adminServer, 'my blaster');
                await createTarget(adminServer, 'good targ?t');
                await createTarget(adminServer, 'bad targ?t');
                await createTarget(adminServer, 'juice');

                const response = await adminServer.inject({
                    method: 'GET',
                    url: '/targets?search=tArg%3Ft',
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const listResponse = JSON.parse(response.payload);
                expect(listResponse.results.length).toBe(3);
                expect(listResponse.results[0].name).toBe('bad targ?t');
                expect(listResponse.results[1].name).toBe('good targ?t');
                expect(listResponse.results[2].name).toBe('my targ?t');
            });

            it('should return 200 with next and prev links filtered by search query string', async () => {
                await createTarget(adminServer, 'my targ?T');
                await createTarget(adminServer, 'my blaster');
                await createTarget(adminServer, 'good targ?T');
                await createTarget(adminServer, 'bad targ?T');
                await createTarget(adminServer, 'juice');

                const response = await adminServer.inject({
                    method: 'GET',
                    url: '/targets?search=tArg%3Ft&pageSize=1&page=2',
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const listResponse = JSON.parse(response.payload);
                expect(listResponse.results.length).toBe(1);
                expect(listResponse.results[0].name).toBe('good targ?T');
                expect(listResponse.prev).toBe('http://localhost:80/targets?page=1&pageSize=1&search=tArg%3Ft');
                expect(listResponse.next).toBe('http://localhost:80/targets?page=3&pageSize=1&search=tArg%3Ft');
            });

            it('should set next and not prev link in first page when targets returned match page size', async () => {
                await Promise.all([1, 2, 3, 4, 5].map(value => adminServer.inject({
                    method: 'POST',
                    url: '/targets',
                    body: {
                        name: 'a target ' + value,
                        url: 'http://example.org'
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                })));
                const responseNoPrev = await adminServer.inject({
                    method: 'GET',
                    url: '/targets?page=1&pageSize=2',
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                const payloadResponseNoPrev = JSON.parse(responseNoPrev.payload);
                expect(payloadResponseNoPrev.prev).toBeUndefined();
                expect(payloadResponseNoPrev.next).toBe('http://localhost:80/targets?page=2&pageSize=2');
            });

            it('should not set next and not prev link in first page when targets returned are lower than page size', async () => {
                await Promise.all([1, 2].map(value => adminServer.inject({
                    method: 'POST',
                    url: '/targets',
                    body: {
                        name: 'a target ' + value,
                        url: 'http://example.org'
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                })));
                const responseNoPrev = await adminServer.inject({
                    method: 'GET',
                    url: '/targets?page=1&pageSize=3',
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                const payloadResponseNoPrev = JSON.parse(responseNoPrev.payload);
                expect(payloadResponseNoPrev.prev).toBeUndefined();
                expect(payloadResponseNoPrev.next).toBeUndefined();
            });

            it('should set next and prev link if a middle page', async () => {
                await Promise.all([1, 2, 3, 4, 5].map(value => adminServer.inject({
                    method: 'POST',
                    url: '/targets',
                    body: {
                        name: 'a target ' + value,
                        url: 'http://example.org'
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                })));
                const responseNoPrev = await adminServer.inject({
                    method: 'GET',
                    url: '/targets?page=2&pageSize=2',
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                const payloadResponseNoPrev = JSON.parse(responseNoPrev.payload);
                expect(payloadResponseNoPrev.prev).toBe('http://localhost:80/targets?page=1&pageSize=2');
                expect(payloadResponseNoPrev.next).toBe('http://localhost:80/targets?page=3&pageSize=2');
            });

            it('should return 400 with invalid page query string', async () => {
                const response = await adminServer.inject({
                    method: 'GET',
                    url: '/targets?page=invalid',
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
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
                    url: '/targets?pageSize=invalid',
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
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
                    url: '/targets?pageSize=101',
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
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
                    url: '/targets?pageSize=0',
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
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
                    url: '/targets?page=0',
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
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

            it('should return 401 when invalid token', async () => {
                const response = await adminServer.inject({
                    method: 'GET',
                    url: '/targets/' + new ObjectId(),
                    headers: {
                        authorization: 'apiKey invalidApiKey'
                    }
                });
                expect(response.statusCode).toBe(401);
            });

            it('should return 400 when target identifier is not a valid ObjectId', async () => {
                const response = await adminServer.inject({
                    method: 'GET',
                    url: '/targets/invalid-object-id-here',
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'params target id must be a valid ObjectId'
                }));
            });

            it('should return 404 when target does not exists', async () => {
                const response = await adminServer.inject({
                    method: 'GET',
                    url: '/targets/' + new ObjectId(),
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(404);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 404,
                    error: 'Not Found',
                    message: 'Resource not found'
                }));
            });

            it('should return 200 with target', async () => {
                const createResponse = await adminServer.inject({
                    method: 'POST',
                    url: '/targets',
                    body: {
                        name: 'a target',
                        url: 'http://example.org',
                        headers: {
                            authorization: 'Bearer myKey',
                            'x-app-id': 123
                        }
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(createResponse.statusCode).toBe(201);
                expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
                const createdTarget = JSON.parse(createResponse.payload);
                expect(createdTarget.name).toBe('a target');
                expect(createdTarget.url).toBe('http://example.org');
                expect(createdTarget.headers).toStrictEqual({
                    authorization: 'Bearer myKey',
                    'x-app-id': '123'
                });

                const response = await adminServer.inject({
                    method: 'GET',
                    url: '/targets/' + createdTarget.id,
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const getTarget = JSON.parse(response.payload);
                expect(getTarget).toEqual(createdTarget);
            });
        });

        describe('post', () => {

            it('should return 401 when invalid token', async () => {
                const response = await adminServer.inject({
                    method: 'POST',
                    url: '/targets',
                    body: {
                        name: 'a target',
                        url: 'https://example.org'
                    },
                    headers: {
                        authorization: 'apiKey invalidApiKey'
                    }
                });
                expect(response.statusCode).toBe(401);
            });

            it('should return 400 when name is undefined', async () => {
                const response = await adminServer.inject({
                    method: 'POST',
                    url: '/targets',
                    body: {
                        name: undefined,
                        url: 'https://example.org'
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body should have required property \'name\''
                }));
            });

            it('should return 400 when url is undefined', async () => {
                const response = await adminServer.inject({
                    method: 'POST',
                    url: '/targets',
                    body: {
                        name: 'a target',
                        url: undefined
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body should have required property \'url\''
                }));
            });

            it('should return 400 when url is not valid', async () => {
                const response = await adminServer.inject({
                    method: 'POST',
                    url: '/targets',
                    body: {
                        name: 'a target',
                        url: 'a non valid url'
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body/url should match format "uri"'
                }));
            });

            it('should return 400 when name is longer than 100 characters', async () => {
                const response = await adminServer.inject({
                    method: 'POST',
                    url: '/targets',
                    body: {
                        name: 'a'.repeat(101),
                        url: 'https://example.org'
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body/name should NOT be longer than 100 characters'
                }));
            });

            it('should return 400 when headers is not an object', async () => {
                const response = await adminServer.inject({
                    method: 'POST',
                    url: '/targets',
                    body: {
                        name: 'test',
                        url: 'https://example.org',
                        headers: []
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body/headers should be object'
                }));
            });

            it('should return 400 when headers value is not a string', async () => {
                const response = await adminServer.inject({
                    method: 'POST',
                    url: '/targets',
                    body: {
                        name: 'test',
                        url: 'https://example.org',
                        headers: {
                            a: { complex: 'object' }
                        }
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body/headers/a should be string'
                }));
            });

            it('should return 400 when headers key is Content-Type', async () => {
                const response = await adminServer.inject({
                    method: 'POST',
                    url: '/targets',
                    body: {
                        name: 'test',
                        url: 'https://example.org',
                        headers: {
                            'Content-Type': 'plain/text'
                        }
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body/headers/content-type cannot be specified'
                }));
            });

            it('should return 400 when headers key is Content-Length', async () => {
                const response = await adminServer.inject({
                    method: 'POST',
                    url: '/targets',
                    body: {
                        name: 'test',
                        url: 'https://example.org',
                        headers: {
                            'Content-Length': 456
                        }
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body/headers/content-length cannot be specified'
                }));
            });

            it('should return 400 when body is not an object', async () => {
                const response = await adminServer.inject({
                    method: 'POST',
                    url: '/targets',
                    body: {
                        name: 'test',
                        url: 'https://example.org',
                        body: []
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body/body should be object'
                }));
            });

            it('should return 400 when body has invalid syntax in template', async () => {
                const response = await adminServer.inject({
                    method: 'POST',
                    url: '/targets',
                    body: {
                        name: 'test',
                        url: 'https://example.org',
                        body: {
                            title: 'my title is {{ bad syntax'
                        }
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body/body/title output "{{ bad syntax" not closed, line:1, col:13'
                }));
            });

            it('should return 201 with created target when request has only required fields', async () => {
                const response = await adminServer.inject({
                    method: 'POST',
                    url: '/targets',
                    body: {
                        name: 'a target',
                        url: 'http://example.org'
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(201);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const target = JSON.parse(response.payload);
                expect(response.headers.location).toBe(`http://localhost:80/targets/${target.id}`);
                expect(target.name).toBe('a target');
                expect(target.url).toBe('http://example.org');
                expect(ObjectId.isValid(target.id)).toBe(true);
            });

            it('should return 201 with created target when request includes valid headers and body', async () => {
                const response = await adminServer.inject({
                    method: 'POST',
                    url: '/targets',
                    body: {
                        name: 'a target',
                        url: 'http://example.org',
                        headers: {
                            authorization: 'Bearer myKey',
                            'x-custom-header': 5
                        },
                        body: {
                            title: 'Notification',
                            description: 'your sensor value is {{event.value}}'
                        }
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(201);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const target = JSON.parse(response.payload);
                expect(response.headers.location).toBe(`http://localhost:80/targets/${target.id}`);
                expect(target.name).toBe('a target');
                expect(target.url).toBe('http://example.org');
                expect(target.headers).toStrictEqual({
                    authorization: 'Bearer myKey',
                    'x-custom-header': '5'
                });
                expect(target.body).toStrictEqual({
                    title: 'Notification',
                    description: 'your sensor value is {{event.value}}'
                });
                expect(ObjectId.isValid(target.id)).toBe(true);
            });

            it('should return 201 with created target when url host is a top-level domain', async () => {
                const response = await adminServer.inject({
                    method: 'POST',
                    url: '/targets',
                    body: {
                        name: 'a target',
                        url: 'http://example'
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(201);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const target = JSON.parse(response.payload);
                expect(response.headers.location).toBe(`http://localhost:80/targets/${target.id}`);
                expect(target.name).toBe('a target');
                expect(target.url).toBe('http://example');
                expect(ObjectId.isValid(target.id)).toBe(true);
            });

            it('should return 409 when try to create a target with the same name', async () => {
                const target = await createTarget(adminServer, 'same name');
                const responseCreateTarget2 = await adminServer.inject({
                    method: 'POST',
                    url: '/targets',
                    body: {
                        name: 'same name',
                        url: 'http://example.org'
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(responseCreateTarget2.statusCode).toBe(409);
                expect(responseCreateTarget2.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(responseCreateTarget2.headers.location).toBe(`http://localhost:80/targets/${target.id}`);
                expect(responseCreateTarget2.payload).toBe(JSON.stringify({
                    statusCode: 409,
                    error: 'Conflict',
                    message: `Target name must be unique and is already taken by target with id ${target.id}`
                }));
            });
        });

        describe('put', () => {

            it('should return 401 when invalid token', async () => {
                const response = await adminServer.inject({
                    method: 'PUT',
                    url: '/targets/' + new ObjectId().toHexString(),
                    body: {
                        name: 'a target',
                        url: 'https://example.org'
                    },
                    headers: {
                        authorization: 'apiKey invalidApiKey'
                    }
                });
                expect(response.statusCode).toBe(401);
            });

            it('should return 400 when target identifier is not a valid ObjectId', async () => {
                const response = await adminServer.inject({
                    method: 'PUT',
                    url: '/targets/invalid-object-id-here',
                    body: {
                        name: 'a name',
                        url: 'https://example.org'
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'params target id must be a valid ObjectId'
                }));
            });

            it('should return 404 when target does not exists', async () => {
                const response = await adminServer.inject({
                    method: 'PUT',
                    url: '/targets/' + new ObjectId(),
                    body: {
                        name: 'a name',
                        url: 'https://example.org'
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(404);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 404,
                    error: 'Not Found',
                    message: 'Resource not found'
                }));
            });

            it('should return 400 when name is undefined', async () => {
                const response = await adminServer.inject({
                    method: 'PUT',
                    url: '/targets/' + new ObjectId().toHexString(),
                    body: {
                        name: undefined,
                        url: 'https://example.org'
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body should have required property \'name\''
                }));
            });

            it('should return 400 when url is undefined', async () => {
                const response = await adminServer.inject({
                    method: 'PUT',
                    url: '/targets/' + new ObjectId().toHexString(),
                    body: {
                        name: 'a target',
                        url: undefined
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body should have required property \'url\''
                }));
            });

            it('should return 400 when url is not valid', async () => {
                const response = await adminServer.inject({
                    method: 'PUT',
                    url: '/targets/' + new ObjectId().toHexString(),
                    body: {
                        name: 'a target',
                        url: 'a non valid url'
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body/url should match format "uri"'
                }));
            });

            it('should return 400 when name is longer than 100 characters', async () => {
                const response = await adminServer.inject({
                    method: 'PUT',
                    url: '/targets/' + new ObjectId().toHexString(),
                    body: {
                        name: 'a'.repeat(101),
                        url: 'https://example.org'
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body/name should NOT be longer than 100 characters'
                }));
            });

            it('should return 400 when headers is not an object', async () => {
                const response = await adminServer.inject({
                    method: 'PUT',
                    url: '/targets/' + new ObjectId().toHexString(),
                    body: {
                        name: 'test',
                        url: 'https://example.org',
                        headers: []
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body/headers should be object'
                }));
            });

            it('should return 400 when headers value is not a string', async () => {
                const response = await adminServer.inject({
                    method: 'PUT',
                    url: '/targets/' + new ObjectId().toHexString(),
                    body: {
                        name: 'test',
                        url: 'https://example.org',
                        headers: {
                            a: { complex: 'object' }
                        }
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body/headers/a should be string'
                }));
            });

            it('should return 400 when headers key is Content-Type', async () => {
                const target = await createTarget(adminServer);
                const response = await adminServer.inject({
                    method: 'PUT',
                    url: '/targets/' + target.id,
                    body: {
                        name: 'test',
                        url: 'https://example.org',
                        headers: {
                            'Content-Type': 'plain/text'
                        }
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body/headers/content-type cannot be specified'
                }));
            });

            it('should return 400 when headers key is Content-Length', async () => {
                const target = await createTarget(adminServer);
                const response = await adminServer.inject({
                    method: 'PUT',
                    url: '/targets/' + target.id,
                    body: {
                        name: 'test',
                        url: 'https://example.org',
                        headers: {
                            'Content-Length': 456
                        }
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body/headers/content-length cannot be specified'
                }));
            });

            it('should return 400 when body is not an object', async () => {
                const target = await createTarget(adminServer);
                const response = await adminServer.inject({
                    method: 'PUT',
                    url: '/targets/' + target.id,
                    body: {
                        name: 'test',
                        url: 'https://example.org',
                        body: []
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body/body should be object'
                }));
            });

            it('should return 400 when body has invalid syntax in template', async () => {
                const target = await createTarget(adminServer);
                const response = await adminServer.inject({
                    method: 'PUT',
                    url: '/targets/' + target.id,
                    body: {
                        name: 'test',
                        url: 'https://example.org',
                        body: {
                            title: 'my title is {{ bad syntax'
                        }
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body/body/title output "{{ bad syntax" not closed, line:1, col:13'
                }));
            });

            it('should return 200 with updated target when request has only required fields', async () => {
                const target = await createTarget(adminServer, 'my target');
                const response = await adminServer.inject({
                    method: 'PUT',
                    url: '/targets/' + target.id,
                    body: {
                        name: 'my target 2',
                        url: 'http://example-changed.org'
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const updatedTarget = JSON.parse(response.payload);
                expect(updatedTarget.name).toBe('my target 2');
                expect(updatedTarget.url).toBe('http://example-changed.org');
                expect(ObjectId.isValid(updatedTarget.id)).toBe(true);
                expect(updatedTarget.id).toBe(target.id);
                expect(updatedTarget.createdAt).toBe(target.createdAt);
                expect(updatedTarget.updatedAt).not.toBe(target.updatedAt);
            });

            it('should return 200 with updated target when request includes valid headers and body', async () => {
                const target = await createTarget(adminServer, 'my target');
                const response = await adminServer.inject({
                    method: 'PUT',
                    url: '/targets/' + target.id,
                    body: {
                        name: 'an updatedTarget',
                        url: 'http://example-changed.org',
                        headers: {
                            authorization: 'Bearer myKey',
                            'x-custom-header': 5
                        },
                        body: {
                            title: 'Notification',
                            description: 'your sensor value is {{event.value}}'
                        }
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const updatedTarget = JSON.parse(response.payload);
                expect(ObjectId.isValid(updatedTarget.id)).toBe(true);
                expect(updatedTarget.id).toBe(target.id);
                expect(updatedTarget.name).toBe('an updatedTarget');
                expect(updatedTarget.url).toBe('http://example-changed.org');
                expect(updatedTarget.headers).toStrictEqual({
                    authorization: 'Bearer myKey',
                    'x-custom-header': '5'
                });
                expect(updatedTarget.body).toStrictEqual({
                    title: 'Notification',
                    description: 'your sensor value is {{event.value}}'
                });
                expect(updatedTarget.createdAt).toBe(target.createdAt);
                expect(updatedTarget.updatedAt).not.toBe(target.updatedAt);
            });

            it('should return 409 when try to create a target with the same name', async () => {
                const target1 = await createTarget(adminServer, 'same name');
                const target2 = await createTarget(adminServer, 'a name');
                const responseUpdateTarget2 = await adminServer.inject({
                    method: 'PUT',
                    url: '/targets/' + target2.id,
                    body: {
                        name: 'same name',
                        url: 'http://example.org'
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(responseUpdateTarget2.statusCode).toBe(409);
                expect(responseUpdateTarget2.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(responseUpdateTarget2.headers.location).toBe(`http://localhost:80/targets/${target1.id}`);
                expect(responseUpdateTarget2.payload).toBe(JSON.stringify({
                    statusCode: 409,
                    error: 'Conflict',
                    message: `Target name must be unique and is already taken by target with id ${target1.id}`
                }));
            });
        });

        describe('delete', () => {

            it('should return 401 when invalid token', async () => {
                const response = await adminServer.inject({
                    method: 'DELETE',
                    url: '/targets/' + new ObjectId(),
                    headers: {
                        authorization: 'apiKey invalidApiKey'
                    }
                });
                expect(response.statusCode).toBe(401);
            });

            it('should return 400 when target identifier is not a valid ObjectId', async () => {
                const response = await adminServer.inject({
                    method: 'DELETE',
                    url: '/targets/invalid-object-id-here',
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'params target id must be a valid ObjectId'
                }));
            });

            it('should return 204 when target does not exist', async () => {
                const response = await adminServer.inject({
                    method: 'DELETE',
                    url: '/targets/' + new ObjectId(),
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(response.statusCode).toBe(204);
            });

            it('should return 204 when target exists', async () => {
                const createResponse = await adminServer.inject({
                    method: 'POST',
                    url: '/targets',
                    body: {
                        name: 'a target',
                        url: 'http://example.org'
                    },
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(createResponse.statusCode).toBe(201);
                expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
                const createdTarget = JSON.parse(createResponse.payload);

                const deleteResponse = await adminServer.inject({
                    method: 'DELETE',
                    url: '/targets/' + createdTarget.id,
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(deleteResponse.statusCode).toBe(204);

                const getResponse = await adminServer.inject({
                    method: 'GET',
                    url: '/targets/' + createdTarget.id,
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
                });
                expect(getResponse.statusCode).toBe(404);
            });

            it('should return 400 when target is used in one or more rules', async () => {
                const eventType = await createEventType(adminServer);
                const target = await createTarget(adminServer);
                const rule = await createRule(adminServer, target.id, eventType.id);

                const deleteResponse = await adminServer.inject({
                    method: 'DELETE',
                    url: '/targets/' + target.id,
                    headers: {
                        authorization: 'apiKey myApiKey'
                    }
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

    async function createTarget(adminServer, name = 'a target') {
        const createResponse = await adminServer.inject({
            method: 'POST',
            url: '/targets',
            body: {
                name,
                url: 'http://example.org'
            },
            headers: {
                authorization: 'apiKey myApiKey'
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
            },
            headers: {
                authorization: 'apiKey myApiKey'
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
            },
            headers: {
                authorization: 'apiKey myApiKey'
            }
        });
        expect(createResponse.statusCode).toBe(201);
        expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
        return JSON.parse(createResponse.payload);
    }
});
