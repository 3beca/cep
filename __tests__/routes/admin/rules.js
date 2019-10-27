jest.mock('pino');
import { buildServer } from '../../../src/server';
import { ObjectId } from 'mongodb';
import { buildEventTypesService } from '../../../src/services/event-types-service';
import { buildTargetsService } from '../../../src/services/targets-service';
import { buildEngine } from '../../../src/engine';
import { buildRulesService } from '../../../src/services/rules-services';
import { connect, getAndSetupDatabase } from '../../../src/database';
import config from '../../../src/config';

describe('admin', () => {

    let server;
    let dbClient;
    let db;

    beforeEach(async () => {
        const { url, databaseName } = config.mongodb;
        dbClient = await connect(url);
        db = await getAndSetupDatabase(dbClient, `${databaseName}-test-${new ObjectId()}`);
        const eventTypesService = buildEventTypesService(db);
        const targetsService = buildTargetsService(db);
        const rulesService = buildRulesService(db, targetsService, eventTypesService);
        const engine = buildEngine(eventTypesService, rulesService, targetsService);
        server = buildServer(eventTypesService, targetsService, rulesService, engine);
    });

    afterEach(async () => {
        await server.close();
        await db.dropDatabase();
        await dbClient.close();
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
                        eventTypeId: eventType.id,
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

            it('should set next and not prev link in first page when rules returned match page size', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                await Promise.all([1, 2, 3, 4, 5].map(value => server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule ' + value,
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

            it('should return 200 with rule', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                const createResponse = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        eventTypeId: eventType.id,
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
                        eventTypeId: eventType.id,
                        targetId: target.id
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'body should have required property \'name\'' }));
            });

            it('should return 400 when name is longer than 100 characters', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a'.repeat(101),
                        eventTypeId: eventType.id,
                        targetId: target.id
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'body.name should NOT be longer than 100 characters' }));
            });

            it('should return 400 when filters is invalid', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
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

            it('should return 400 when event type id is undefined', async () => {
                const target = await createTarget(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
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

            it('should return 400 when event type does not exists', async () => {
                const nonExistingEventTypeId = new ObjectId().toHexString();
                const target = await createTarget(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
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

            it('should return 201 with created rule when request is valid', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        eventTypeId: eventType.id,
                        targetId: target.id,
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
                expect(rule.filters).toEqual({ value: 8 });
                expect(rule.eventTypeId).toBe(eventType.id);
                expect(rule.targetId).toBe(target.id);
                expect(ObjectId.isValid(rule.id)).toBe(true);
            });

            it('should return 409 when try to create a rule with the same name', async () => {
                const eventType = await createEventType(server);
                const target = await createTarget(server);
                const responseCreaterule = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'same name',
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
                const createResponse = await server.inject({
                    method: 'POST',
                    url: '/admin/rules',
                    body: {
                        name: 'a rule',
                        eventTypeId: eventType.id,
                        targetId: target.id
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
