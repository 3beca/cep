jest.mock('pino');
import { ObjectId } from 'mongodb';
import nock from 'nock';
import { buildConfig } from '../../../src/config';
import { buildApp, App } from '../../../src/app';

describe('event processing', () => {
    let app: App;
    let adminServer;
    let eventProcessingServer;

    beforeEach(async () => {
        const config = buildConfig();
        app = await buildApp({
            ...config,
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

    describe('post an event', () => {

        it('should return 400 when event type id is not a valid ObjectId', async () => {
            const response = await eventProcessingServer.inject({
                method: 'POST',
                url: '/events/invalid-object-id'
            });
            expect(response.statusCode).toBe(400);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            expect(response.payload).toBe(JSON.stringify({
                statusCode: 400,
                error: 'Bad Request',
                message: 'params event type id must be a valid ObjectId'
            }));
        });

        it('should return 404 when event type does not exists', async () => {
            const response = await eventProcessingServer.inject({
                method: 'POST',
                url: '/events/' + new ObjectId()
            });
            expect(response.statusCode).toBe(404);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            expect(response.payload).toBe(JSON.stringify({
                statusCode: 404,
                error: 'Not Found',
                message: 'Resource not found'
            }));
        });

        it('should return 400 when payload is not a valid json', async () => {
            const response = await eventProcessingServer.inject({
                method: 'POST',
                url: '/events/' + new ObjectId(),
                headers: {
                    'content-type': 'application/json'
                },
                body: '{invalid: json}'
            });
            expect(response.statusCode).toBe(400);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            expect(response.payload).toBe(JSON.stringify({
                statusCode: 400,
                error: 'Bad Request',
                message: 'Unexpected token i in JSON at position 1'
            }));
        });

        it('should return 204 when event type exists', async () => {
            const eventType = await createEventType(adminServer);

            const response = await eventProcessingServer.inject({
                method: 'POST',
                url: '/events/' + eventType.id,
                body: {
                    value: 5
                }
            });
            expect(response.statusCode).toBe(204);
        });

        it('should not call target when event payload does not match rule filters', async () => {
            const eventType = await createEventType(adminServer);
            const target = await createTarget(adminServer, 'http://example.org');
            await createRule(adminServer, target.id, eventType.id, { filters: { value: 2 } });

            const scope = nock('http://example.org')
                .post('/', { value: 2 })
                .reply(200);

            const response = await eventProcessingServer.inject({
                method: 'POST',
                url: '/events/' + eventType.id,
                body: {
                    value: 5
                }
            });
            expect(response.statusCode).toBe(204);
            expect(scope.isDone()).toBe(false);
        });

        it('should call target when event payload matches rule filters with request-id header and payload as body', async () => {
            const eventType = await createEventType(adminServer);
            const target = await createTarget(adminServer, 'http://example.org/');
            const rule = await createRule(adminServer, target.id, eventType.id, { filters: { value: 2 }});

            const requestId = new ObjectId().toHexString();
            const scope = nock('http://example.org', {
                reqheaders: {
                    'request-id': requestId,
                    'X-Rule-Id': rule.id,
                    'X-Rule-Name': rule.name,
                    'X-Target-Id': target.id,
                    'X-Target-Name': target.name
                }})
                .post('/', { value: 2 })
                .reply(200);

            const response = await eventProcessingServer.inject({
                method: 'POST',
                url: '/events/' + eventType.id,
                headers: {
                    'request-id': requestId
                },
                body: {
                    value: 2
                }
            });
            expect(response.statusCode).toBe(204);
            expect(scope.isDone()).toBe(true);
        });

        it('should call target twice when event payload matches 2 rules filters', async () => {
            const eventType = await createEventType(adminServer);
            const target = await createTarget(adminServer, 'http://example.org/');
            const rule1 = await createRule(adminServer, target.id, eventType.id, { name: 'rule 1', filters: { value: 2 }});
            const rule2 = await createRule(adminServer, target.id, eventType.id, { name: 'rule 2', filters: { value: { _gt: 1 } }});

            const scope1 = nock('http://example.org', {
                reqheaders: {
                    'X-Rule-Id': rule1.id,
                    'X-Rule-Name': rule1.name,
                    'X-Target-Id': target.id,
                    'X-Target-Name': target.name,
                }})
                .post('/', { value: 2 })
                .once()
                .reply(200);

            const scope2 = nock('http://example.org', {
                reqheaders: {
                    'X-Rule-Id': rule2.id,
                    'X-Rule-Name': rule2.name,
                    'X-Target-Id': target.id,
                    'X-Target-Name': target.name,
                }})
                .post('/', { value: 2 })
                .once()
                .reply(200);

            const response = await eventProcessingServer.inject({
                method: 'POST',
                url: '/events/' + eventType.id,
                body: {
                    value: 2
                }
            });
            expect(response.statusCode).toBe(204);
            expect(scope1.isDone()).toBe(true);
            expect(scope2.isDone()).toBe(true);
        });

        it('should call target only on first matches when rule is created with skipOnConsecutivesMatches=true', async () => {
            const eventType = await createEventType(adminServer);
            const target = await createTarget(adminServer, 'http://example.org/');
            const rule = await createRule(adminServer, target.id, eventType.id, {
                name: 'rule 1',
                filters: { value: 2 },
                skipOnConsecutivesMatches: true
            });

            const scope1 = nock('http://example.org', {
                reqheaders: {
                    'request-id': '1',
                    'X-Rule-Id': rule.id,
                    'X-Rule-Name': rule.name,
                    'X-Target-Id': target.id,
                    'X-Target-Name': target.name
                }})
                .post('/', { value: 2 })
                .once()
                .reply(200);

            await eventProcessingServer.inject({
                method: 'POST',
                url: '/events/' + eventType.id,
                headers: {
                    'request-id': '1'
                },
                body: {
                    value: 2
                }
            });

            expect(scope1.isDone()).toBe(true);

            const scope2 = nock('http://example.org', {
                reqheaders: {
                    'request-id': '2',
                }})
                .post('/', { value: 2 })
                .once()
                .reply(200);

            await eventProcessingServer.inject({
                method: 'POST',
                url: '/events/' + eventType.id,
                headers: {
                    'request-id': '2'
                },
                body: {
                    value: 2
                }
            });

            expect(scope2.isDone()).toBe(false);

            const scope3 = nock('http://example.org', {
                reqheaders: {
                    'request-id': '3',
                }})
                .post('/', { value: 3 })
                .once()
                .reply(200);

            await eventProcessingServer.inject({
                method: 'POST',
                url: '/events/' + eventType.id,
                headers: {
                    'request-id': '3'
                },
                body: {
                    value: 3
                }
            });

            expect(scope3.isDone()).toBe(false);

            const scope4 = nock('http://example.org', {
                reqheaders: {
                    'request-id': '4',
                    'X-Rule-Id': rule.id,
                    'X-Rule-Name': rule.name,
                    'X-Target-Id': target.id,
                    'X-Target-Name': target.name
                }})
                .post('/', { value: 2 })
                .once()
                .reply(200);

            await eventProcessingServer.inject({
                method: 'POST',
                url: '/events/' + eventType.id,
                headers: {
                    'request-id': '4'
                },
                body: {
                    value: 2
                }
            });

            expect(scope4.isDone()).toBe(true);

            const scope5 = nock('http://example.org', {
                reqheaders: {
                    'request-id': '5',
                }})
                .post('/', { value: 2 })
                .once()
                .reply(200);

            await eventProcessingServer.inject({
                method: 'POST',
                url: '/events/' + eventType.id,
                headers: {
                    'request-id': '5'
                },
                body: {
                    value: 2
                }
            });

            expect(scope5.isDone()).toBe(false);
        });
    });

    it('should not call target when event payload does not match rule filters of type sliding', async () => {
        const eventType = await createEventType(adminServer);
        const target = await createTarget(adminServer, 'http://example.org');
        await createRule(adminServer, target.id, eventType.id, {
            type: 'sliding',
            group: { count: { _sum: 1 } },
            windowSize: {
                unit: 'minute',
                value: 1
            },
            filters: { count: 2 }
        });

        const scope = nock('http://example.org')
            .post('/', { count: 2 })
            .reply(200);

        const response = await eventProcessingServer.inject({
            method: 'POST',
            url: '/events/' + eventType.id,
            body: {
                value: 5
            }
        });
        expect(response.statusCode).toBe(204);
        expect(scope.isDone()).toBe(false);
    });

    it('should call target when event payload matches rule filters of type sliding', async () => {
        const eventType = await createEventType(adminServer);
        const target = await createTarget(adminServer, 'http://example.org');

        await eventProcessingServer.inject({
            method: 'POST',
            url: '/events/' + eventType.id,
            body: {
                value: 5
            }
        });

        await createRule(adminServer, target.id, eventType.id, {
            type: 'sliding',
            group: { count: { _sum: 1 } },
            windowSize: {
                unit: 'minute',
                value: 1
            },
            filters: { count: 2 }
        });

        const scope = nock('http://example.org')
            .post('/', { count: 2 })
            .reply(200);

        const response = await eventProcessingServer.inject({
            method: 'POST',
            url: '/events/' + eventType.id,
            body: {
                value: 5
            }
        });
        expect(response.statusCode).toBe(204);
        expect(scope.isDone()).toBe(true);
    });

    it('should call target when event payload matches rule without filters of type sliding', async () => {
        const eventType = await createEventType(adminServer);
        const target = await createTarget(adminServer, 'http://example.org');

        await eventProcessingServer.inject({
            method: 'POST',
            url: '/events/' + eventType.id,
            body: {
                value: 5
            }
        });

        await createRule(adminServer, target.id, eventType.id, {
            type: 'sliding',
            group: { average: { _avg: '_value' } },
            windowSize: {
                unit: 'hour',
                value: 3
            }
        });

        const scope = nock('http://example.org')
            .post('/', { average: 10 })
            .reply(200);

        const response = await eventProcessingServer.inject({
            method: 'POST',
            url: '/events/' + eventType.id,
            body: {
                value: 15
            }
        });
        expect(response.statusCode).toBe(204);
        expect(scope.isDone()).toBe(true);
    });

    it('should call target when event payload matches rule filters of type sliding with max', async () => {
        const eventType = await createEventType(adminServer);
        const target = await createTarget(adminServer, 'http://example.org');

        await eventProcessingServer.inject({
            method: 'POST',
            url: '/events/' + eventType.id,
            body: {
                value: 1
            }
        });
        await eventProcessingServer.inject({
            method: 'POST',
            url: '/events/' + eventType.id,
            body: {
                value: 8
            }
        });
        await eventProcessingServer.inject({
            method: 'POST',
            url: '/events/' + eventType.id,
            body: {
                value: 2
            }
        });

        await createRule(adminServer, target.id, eventType.id, {
            type: 'sliding',
            group: { maxValue: { _max: '_value' } },
            windowSize: {
                unit: 'second',
                value: 30
            }
        });

        const scope = nock('http://example.org')
            .post('/', { maxValue: 8 })
            .reply(200);

        const response = await eventProcessingServer.inject({
            method: 'POST',
            url: '/events/' + eventType.id,
            body: {
                value: 6
            }
        });
        expect(response.statusCode).toBe(204);
        expect(scope.isDone()).toBe(true);
    });

    async function createTarget(adminServer, url = 'http://example.org') {
        const createResponse = await adminServer.inject({
            method: 'POST',
            url: '/targets',
            body: {
                name: 'a target',
                url
            }
        });
        expect(createResponse.statusCode).toBe(201);
        expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
        return JSON.parse(createResponse.payload);
    }

    async function createRule(adminServer, targetId, eventTypeId, rule = {}) {
        const defaultRuleValues = {
            name: 'a rule',
            type: 'realtime',
            skipOnConsecutivesMatches: false
        };
        const createResponse = await adminServer.inject({
            method: 'POST',
            url: '/rules',
            body: {
                ...defaultRuleValues,
                eventTypeId,
                targetId,
                ...rule
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
            }
        });
        expect(createResponse.statusCode).toBe(201);
        expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
        return JSON.parse(createResponse.payload);
    }
});
