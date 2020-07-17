jest.mock('pino');
import { buildApp, App } from '../../../src/app';
import { ObjectId } from 'mongodb';
import config from '../../../src/config';
import { Scheduler } from '../../../src/scheduler';
import nock from 'nock';

describe('admin', () => {
    let app: App;
    let server;
    let scheduler: Scheduler;

    beforeEach(async () => {
        const options = {
            databaseName: `test-${new ObjectId()}`,
            databaseUrl: config.mongodb.databaseUrl,
            trustProxy: false,
            enableCors: false
        };
        app = await buildApp(options);
        server = app.getServer();
        scheduler = app.getScheduler();
        await scheduler.start();
    });

    afterEach(async () => {
        await app.getDatabase().dropDatabase();
        await app.close();
        jest.clearAllMocks();
        nock.cleanAll();
    });

    describe('rules', () => {

        describe('get', () => {

            it('should return 200 with array of rules', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                const createResponse = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        type: 'realtime',
                        eventTypeId: eventType.id,
                        skipOnConsecutivesMatches: true,
                        targetId: target.id
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

            it('should return 200 with array of rules filtered by search query string', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                await createRule(server, eventType, target, 'my ru?e');
                await createRule(server, eventType, target, 'my rute');
                await createRule(server, eventType, target, 'my ru?e2');
                await createRule(server, eventType, target, 'my ruue');
                await createRule(server, eventType, target, 'my ru?e1');

                const response = await server.inject({
                    method: 'GET',
                    url: '/admin/rules?search=ru%3Fe'
                });
                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const listResponse = JSON.parse(response.payload);
                expect(listResponse.results.length).toBe(3);
                expect(listResponse.results[0].name).toBe('my ru?e');
                expect(listResponse.results[1].name).toBe('my ru?e1');
                expect(listResponse.results[2].name).toBe('my ru?e2');
            });

            it('should return 200 with next and prev links filtered by search query string', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                await createRule(server, eventType, target, 'my ru?e');
                await createRule(server, eventType, target, 'my rute');
                await createRule(server, eventType, target, 'my ru?e2');
                await createRule(server, eventType, target, 'my ruue');
                await createRule(server, eventType, target, 'my ru?e1');

                const response = await server.inject({
                    method: 'GET',
                    url: '/admin/rules?search=ru%3Fe&pageSize=1&page=2'
                });
                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const listResponse = JSON.parse(response.payload);
                expect(listResponse.results.length).toBe(1);
                expect(listResponse.results[0].name).toBe('my ru?e1');
                expect(listResponse.prev).toBe('http://localhost:8888/admin/rules?page=1&pageSize=1&search=ru%3Fe');
                expect(listResponse.next).toBe('http://localhost:8888/admin/rules?page=3&pageSize=1&search=ru%3Fe');
            });

            it('should set next and not prev link in first page when rules returned match page size', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                await Promise.all([1, 2, 3, 4, 5].map(value => server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule ' + value,
                        type: 'realtime',
                        eventTypeId: eventType.id,
                        targetId: target.id
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
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                await Promise.all([1, 2].map(value => server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule ' + value,
                        type: 'realtime',
                        eventTypeId: eventType.id,
                        targetId: target.id
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
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                await Promise.all([1, 2, 3, 4, 5].map(value => server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule ' + value,
                        type: 'realtime',
                        eventTypeId: eventType.id,
                        targetId: target.id
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
                    message: 'querystring/page should be integer'
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
                    message: 'querystring/pageSize should be integer'
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
                    message: 'querystring/pageSize should be <= 100'
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
                    message: 'querystring/pageSize should be >= 1'
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
                    message: 'querystring/page should be >= 1'
                }));
            });
        });

        describe('get by id', () => {

            it('should return 400 when rule identifier is not a valid ObjectId', async () => {
                const response = await server.inject({
                    method: 'GET',
                    url: '/admin/rules/invalid-object-id-here'
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'params rule id must be a valid ObjectId' }));
            });

            it('should return 404 when rule does not exists', async () => {
                const response = await server.inject({
                    method: 'GET',
                    url: '/admin/rules/' + new ObjectId()
                });
                expect(response.statusCode).toBe(404);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ message: 'Resource not found' }));
            });

            it('should return 200 with rule', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                const createResponse = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        type: 'realtime',
                        eventTypeId: eventType.id,
                        skipOnConsecutivesMatches: false,
                        targetId: target.id
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

            it('should return 400 when payload is not a valid json', async () => {
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    headers: {
                        'content-type': 'application/json'
                    },
                    body: '{invalid: json}'
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'Unexpected token i in JSON at position 1' }));
            });

            it('should return 400 when name is undefined', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: undefined,
                        type: 'realtime',
                        eventTypeId: eventType.id,
                        targetId: target.id
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'body should have required property \'name\'' }));
            });

            it('should return 400 when type is undefined', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule name',
                        type: undefined,
                        eventTypeId: eventType.id,
                        targetId: target.id
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'body should have required property \'type\'' }));
            });

            it('should return 400 when type is not supported', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule name',
                        type: 'unexisting rule type',
                        eventTypeId: eventType.id,
                        targetId: target.id
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body/type should be equal to one of the allowed values, body should have required property \'group\', body should have required property \'windowSize\', body/type should be equal to constant, body should have required property \'group\', body should have required property \'windowSize\', body/type should be equal to constant, body/type should be equal to constant, body should match exactly one schema in oneOf'
                }));
            });

            it('should return 400 when name is longer than 100 characters', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a'.repeat(101),
                        type: 'realtime',
                        eventTypeId: eventType.id,
                        targetId: target.id
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

            it('should return 400 when filters is invalid', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        type: 'realtime',
                        filters: {
                            a: { _aa: 0 }
                        },
                        eventTypeId: eventType.id,
                        targetId: target.id
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: '_aa is not a valid filter operator' }));
            });

            it('should return 400 when filters has an invalid key', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        type: 'realtime',
                        filters: {
                            '$a': 6
                        },
                        eventTypeId: eventType.id,
                        targetId: target.id
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'filter key \'$a\' cannot contain invalid symbol \'$\'' }));
            });

            it('should return 400 when event type id is undefined', async () => {
                const target = await createTarget(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        type: 'realtime',
                        filters: {
                            a: 2
                        },
                        eventTypeId: undefined,
                        targetId: target.id
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'body should have required property \'eventTypeId\'' }));
            });

            it('should return 400 when target id is undefined', async () => {
                const eventType = await createEventType(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        type: 'realtime',
                        filters: {
                            a: 2
                        },
                        eventTypeId: eventType.id,
                        targetId: undefined
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'body should have required property \'targetId\'' }));
            });

            it('should return 400 when target id and/or event type id are not valid ObjectIds', async () => {
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        type: 'realtime',
                        filters: {
                            a: 2
                        },
                        eventTypeId: 'abc',
                        targetId: 'cbd'
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body/targetId should be a valid ObjectId, body/eventTypeId should be a valid ObjectId'
                }));
            });

            it('should return 400 when event type does not exists', async () => {
                const nonExistingEventTypeId = new ObjectId().toHexString();
                const target = await createTarget(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        type: 'realtime',
                        filters: {
                            a: 2
                        },
                        eventTypeId: nonExistingEventTypeId,
                        targetId: target.id
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: `event type with identifier ${nonExistingEventTypeId} does not exists` }));
            });

            it('should return 400 when targetId does not exists', async () => {
                const nonExistingTargetId = new ObjectId().toHexString();
                const eventType = await createEventType(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        type: 'realtime',
                        filters: {
                            a: 2
                        },
                        eventTypeId: eventType.id,
                        targetId: nonExistingTargetId
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: `target with identifier ${nonExistingTargetId} does not exists` }));
            });

            it('should return 400 when group is undefined in rule of type sliding', async () => {
                const target = await createTarget(server);
                const eventType = await createEventType(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        type: 'sliding',
                        group: undefined,
                        windowSize: {
                            unit: 'minute',
                            value: 5
                        },
                        eventTypeId: eventType.id,
                        targetId: target.id
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body should have required property \'group\', body should have required property \'group\', body/type should be equal to constant, body/type should be equal to constant, body should match exactly one schema in oneOf'
                }));
            });

            it('should return 400 when group is invalid in rule of type sliding', async () => {
                const target = await createTarget(server);
                const eventType = await createEventType(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        type: 'sliding',
                        group: {
                            _id: 'invalid group'
                        },
                        windowSize: {
                            unit: 'minute',
                            value: 5
                        },
                        eventTypeId: eventType.id,
                        targetId: target.id
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'Group field \'_id\' contains reserved symbol \'_\''
                }));
            });

            it('should return 400 when windowSize is undefined in rule of type sliding', async () => {
                const target = await createTarget(server);
                const eventType = await createEventType(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        type: 'sliding',
                        group: {
                            count: { _sum: 1 }
                        },
                        windowSize: undefined,
                        eventTypeId: eventType.id,
                        targetId: target.id
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body should have required property \'windowSize\', body should have required property \'windowSize\', body/type should be equal to constant, body/type should be equal to constant, body should match exactly one schema in oneOf'
                }));
            });

            it('should return 400 when windowSize.unit is not supported in rule of type sliding', async () => {
                const target = await createTarget(server);
                const eventType = await createEventType(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        type: 'sliding',
                        group: {
                            count: { _sum: 1 }
                        },
                        windowSize: {
                            unit: 'day',
                            value: 1
                        },
                        eventTypeId: eventType.id,
                        targetId: target.id
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body/windowSize/unit should be equal to one of the allowed values'
                }));
            });

            it('should return 400 when windowSize.value is not an integer in rule of type sliding', async () => {
                const target = await createTarget(server);
                const eventType = await createEventType(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        type: 'sliding',
                        group: {
                            count: { _sum: 1 }
                        },
                        windowSize: {
                            unit: 'hour',
                            value: 5.5
                        },
                        eventTypeId: eventType.id,
                        targetId: target.id
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({
                    statusCode: 400,
                    error: 'Bad Request',
                    message: 'body/windowSize/value should be integer'
                }));
            });

            it('should return 201 with created rule type realtime when request is valid', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        type: 'realtime',
                        eventTypeId: eventType.id,
                        targetId: target.id,
                        skipOnConsecutivesMatches: true,
                        filters: {
                            value: 8
                        }
                    }
                });
                expect(response.statusCode).toBe(201);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const rule = JSON.parse(response.payload);
                expect(response.headers.location).toBe(`http://localhost:8888/admin/rules/${rule.id}`);
                expect(rule.name).toBe('a rule');
                expect(rule.type).toBe('realtime');
                expect(rule.filters).toEqual({ value: 8 });
                expect(rule.eventTypeId).toBe(eventType.id);
                expect(rule.eventTypeName).toBe(eventType.name);
                expect(rule.targetId).toBe(target.id);
                expect(rule.targetName).toBe(target.name);
                expect(rule.skipOnConsecutivesMatches).toBe(true);
                expect(ObjectId.isValid(rule.id)).toBe(true);
            });

            it('should return 201 with created rule type sliding when request is valid', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        type: 'sliding',
                        eventTypeId: eventType.id,
                        targetId: target.id,
                        skipOnConsecutivesMatches: true,
                        filters: {
                            value: 8
                        },
                        group: {
                            count: { _sum: 1 }
                        },
                        windowSize: {
                            unit: 'hour',
                            value: 5
                        }
                    }
                });
                expect(response.statusCode).toBe(201);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const rule = JSON.parse(response.payload);
                expect(response.headers.location).toBe(`http://localhost:8888/admin/rules/${rule.id}`);
                expect(rule.name).toBe('a rule');
                expect(rule.type).toBe('sliding');
                expect(rule.filters).toEqual({ value: 8 });
                expect(rule.group).toEqual({ count: { _sum: 1 }});
                expect(rule.windowSize).toEqual({ unit: 'hour', value: 5 });
                expect(rule.eventTypeId).toBe(eventType.id);
                expect(rule.eventTypeName).toBe(eventType.name);
                expect(rule.targetId).toBe(target.id);
                expect(rule.targetName).toBe(target.name);
                expect(rule.skipOnConsecutivesMatches).toBe(true);
                expect(ObjectId.isValid(rule.id)).toBe(true);
            });

            it('should return 201 with created rule type tumbling when request is valid and schedule rule execution, finally rule execution start within a second', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                scheduler.scheduleJob = jest.fn(scheduler.scheduleJob);
                const targetScope = nock('https://example.org')
                    .post('/', { count: 0 })
                    .reply(200);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        type: 'tumbling',
                        eventTypeId: eventType.id,
                        targetId: target.id,
                        skipOnConsecutivesMatches: true,
                        filters: { count: 0 },
                        group: {
                            count: { _sum: 1 }
                        },
                        windowSize: {
                            unit: 'second',
                            value: 1
                        }
                    }
                });
                expect(response.statusCode).toBe(201);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const rule = JSON.parse(response.payload);
                expect(response.headers.location).toBe(`http://localhost:8888/admin/rules/${rule.id}`);
                expect(rule.name).toBe('a rule');
                expect(rule.type).toBe('tumbling');
                expect(rule.filters).toEqual({ count: 0 });
                expect(rule.group).toEqual({ count: { _sum: 1 }});
                expect(rule.windowSize).toEqual({ unit: 'second', value: 1 });
                expect(rule.eventTypeId).toBe(eventType.id);
                expect(rule.eventTypeName).toBe(eventType.name);
                expect(rule.targetId).toBe(target.id);
                expect(rule.targetName).toBe(target.name);
                expect(rule.skipOnConsecutivesMatches).toBe(true);
                expect(ObjectId.isValid(rule.id)).toBe(true);
                const ruleId = ObjectId.createFromHexString(rule.id);
                expect(scheduler.scheduleJob).toHaveBeenCalledTimes(1);
                expect(scheduler.scheduleJob).toHaveBeenCalledWith('1 second', 'execute-rule', { ruleId });

                await new Promise(resolve => {
                    scheduler.onJobComplete((id, name, data) => {
                        expect(name).toBe('execute-rule');
                        expect(data.ruleId).toStrictEqual(ruleId);
                        resolve();
                    });
                });
                expect(targetScope.isDone()).toBe(true);
            });

            it('should return 500 and do not create rule if fail to schedule rule execution', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                scheduler.scheduleJob = jest.fn(() => Promise.reject(new Error('ups, bad luck')));

                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        type: 'tumbling',
                        eventTypeId: eventType.id,
                        targetId: target.id,
                        skipOnConsecutivesMatches: true,
                        filters: {
                            value: 8
                        },
                        group: {
                            count: { _sum: 1 }
                        },
                        windowSize: {
                            unit: 'hour',
                            value: 5
                        }
                    }
                });
                expect(response.statusCode).toBe(500);

                const listResponse = await server.inject({
                    method: 'GET',
                    url: '/admin/rules'
                });
                expect(listResponse.statusCode).toBe(200);
                const listResponseBody = JSON.parse(listResponse.payload);
                expect(listResponseBody.results.length).toBe(0);
                expect(scheduler.scheduleJob).toHaveBeenCalledTimes(1);
            });

            it('should return 409 when try to create a rule with the same name', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                const responseCreaterule = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'same name',
                        type: 'realtime',
                        eventTypeId: eventType.id,
                        targetId: target.id
                    }
                });
                const rule = JSON.parse(responseCreaterule.payload);
                const responseCreaterule2 = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'same name',
                        type: 'realtime',
                        eventTypeId: eventType.id,
                        targetId: target.id
                    }
                });
                expect(responseCreaterule2.statusCode).toBe(409);
                expect(responseCreaterule2.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(responseCreaterule2.headers.location).toBe(`http://localhost:8888/admin/rules/${rule.id}`);
                expect(responseCreaterule2.payload).toBe(JSON.stringify({ message: `Rule name must be unique and is already taken by rule with id ${rule.id}` }));
            });
        });

        describe('delete', () => {

            it('should return 400 when rule identifier is not a valid ObjectId', async () => {
                const response = await server.inject({
                    method: 'DELETE',
                    url: '/admin/rules/invalid-object-id-here'
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'params rule id must be a valid ObjectId' }));
            });

            it('should return 204 when rule does not exist', async () => {
                const response = await server.inject({
                    method: 'DELETE',
                    url: '/admin/rules/' + new ObjectId()
                });
                expect(response.statusCode).toBe(204);
            });

            it('should return 204 when rule exists', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                const createdRule = await createRule(server, eventType, target);

                const deleteResponse = await server.inject({
                    method: 'DELETE',
                    url: '/admin/rules/' + createdRule.id
                });
                expect(deleteResponse.statusCode).toBe(204);

                const getResponse = await server.inject({
                    method: 'GET',
                    url: '/admin/rules/' + createdRule.id
                });
                expect(getResponse.statusCode).toBe(404);
            });

            it('should return 204 and unschedule rule execution when tumbling rule is delete', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                scheduler.scheduleJob = jest.fn(scheduler.scheduleJob);
                scheduler.cancelJob = jest.fn(scheduler.cancelJob);

                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        type: 'tumbling',
                        eventTypeId: eventType.id,
                        targetId: target.id,
                        skipOnConsecutivesMatches: true,
                        filters: {
                            value: 8
                        },
                        group: {
                            count: { _sum: 1 }
                        },
                        windowSize: {
                            unit: 'minute',
                            value: 1
                        }
                    }
                });
                expect(response.statusCode).toBe(201);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const rule = JSON.parse(response.payload);
                const ruleId = ObjectId.createFromHexString(rule.id);
                expect(scheduler.scheduleJob).toHaveBeenCalledTimes(1);
                expect(scheduler.scheduleJob).toHaveBeenCalledWith('1 minute', 'execute-rule', { ruleId });
                const jobId = await (scheduler.scheduleJob as jest.Mock).mock.results[0].value;

                const deleteResponse = await server.inject({
                    method: 'DELETE',
                    url: '/admin/rules/' + rule.id
                });
                expect(deleteResponse.statusCode).toBe(204);
                expect(scheduler.cancelJob).toHaveBeenCalledTimes(1);
                expect(scheduler.cancelJob).toHaveBeenCalledWith(jobId);
            });

            it('should return 500 and do not delete the rule if an unexpected error happened while unschedule rule execution', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                scheduler.cancelJob = jest.fn(() => Promise.reject(new Error('ups, bad luck')));

                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        type: 'tumbling',
                        eventTypeId: eventType.id,
                        targetId: target.id,
                        skipOnConsecutivesMatches: true,
                        filters: {
                            value: 8
                        },
                        group: {
                            count: { _sum: 1 }
                        },
                        windowSize: {
                            unit: 'second',
                            value: 10
                        }
                    }
                });
                expect(response.statusCode).toBe(201);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const rule = JSON.parse(response.payload);

                const deleteResponse = await server.inject({
                    method: 'DELETE',
                    url: '/admin/rules/' + rule.id
                });
                expect(deleteResponse.statusCode).toBe(500);

                const getResponse = await server.inject({
                    method: 'GET',
                    url: '/admin/rules/' + rule.id
                });
                expect(getResponse.statusCode).toBe(200);
                expect(scheduler.cancelJob).toHaveBeenCalledTimes(1);
            });
        });

        async function createRule(server, eventType, target, name = 'a rule') {
            const createResponse = await server.inject({
                method: 'POST',
                url: '/admin/rules',
                body: {
                    name,
                    type: 'realtime',
                    eventTypeId: eventType.id,
                    targetId: target.id
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

        async function createTarget(server) {
            const createResponse = await server.inject({
                method: 'POST',
                url: '/admin/targets',
                body: {
                    name: 'a target',
                    url: 'https://example.org'
                }
            });
            expect(createResponse.statusCode).toBe(201);
            expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
            return JSON.parse(createResponse.payload);
        }
    });
});
