jest.mock('pino');
import { ObjectId } from 'mongodb';
import nock from 'nock';
import config from '../../src/config';
import { buildApp } from '../../src/app';

describe('events', () => {
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
        nock.cleanAll();
    });

    describe('post an event', () => {

        it('should return 404 when event type does not exists', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/events/' + new ObjectId()
            });
            expect(response.statusCode).toBe(404);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            expect(response.payload).toBe(JSON.stringify({ message: 'Resource not found' }));
        });

        it('should return 204 when event type exists', async () => {
            const eventType = await createEventType(server);

            const response = await server.inject({
                method: 'POST',
                url: '/events/' + eventType.id,
                body: {
                    value: 5
                }
            });
            expect(response.statusCode).toBe(204);
        });

        it('should not call target when event payload does not match rule filters', async () => {
            const eventType = await createEventType(server);
            const target = await createTarget(server, 'http://example.org');
            await createRule(server, target.id, eventType.id, 'a rule', { value: 2 });

            const scope = nock('http://example.org')
                .post('/', { value: 2 })
                .reply(200);

            const response = await server.inject({
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
            const eventType = await createEventType(server);
            const target = await createTarget(server, 'http://example.org/');
            await createRule(server, target.id, eventType.id, 'a rule', { value: 2 });

            const requestId = new ObjectId().toHexString();
            const scope = nock('http://example.org', {
                reqheaders: {
                    'request-id': requestId,
                }})
                .post('/', { value: 2 })
                .reply(200);

            const response = await server.inject({
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

        it('should call target once when event payload matches 2 rules filters', async () => {
            const eventType = await createEventType(server);
            const target = await createTarget(server, 'http://example.org/');
            await createRule(server, target.id, eventType.id, 'rule 1', { value: 2 });
            await createRule(server, target.id, eventType.id, 'rule 2', { value: { _gt: 1 } });

            const scope = nock('http://example.org')
                .post('/', { value: 2 })
                .once()
                .reply(200);

            const response = await server.inject({
                method: 'POST',
                url: '/events/' + eventType.id,
                body: {
                    value: 2
                }
            });
            expect(response.statusCode).toBe(204);
            expect(scope.isDone()).toBe(true);
        });

        it('should call target only on first matches when rule is created with skipOnConsecutivesMatches=true', async () => {
            const eventType = await createEventType(server);
            const target = await createTarget(server, 'http://example.org/');
            const skipOnConsecutivesMatches = true;
            await createRule(server, target.id, eventType.id, 'rule 1', { value: 2 }, skipOnConsecutivesMatches);

            const scope1 = nock('http://example.org', {
                reqheaders: {
                    'request-id': '1',
                }})
                .post('/', { value: 2 })
                .once()
                .reply(200);

            await server.inject({
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

            await server.inject({
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

            await server.inject({
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
                }})
                .post('/', { value: 2 })
                .once()
                .reply(200);

            await server.inject({
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

            await server.inject({
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

    async function createRule(server, targetId, eventTypeId, name = 'a rule', filters = undefined, skipOnConsecutivesMatches = false) {
        const createResponse = await server.inject({
            method: 'POST',
            url: '/admin/rules',
            body: {
                name,
                eventTypeId,
                targetId,
                filters,
                skipOnConsecutivesMatches
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
