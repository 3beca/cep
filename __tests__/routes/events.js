import { buildServer } from '../../src/server';
import { buildEventTypesService } from '../../src/services/event-types-service';
import { ObjectId } from 'mongodb';
import { buildRulesService } from '../../src/services/rules-services';
import { buildTargetsService } from '../../src/services/targets-service';
import nock from 'nock';
import { buildEngine } from '../../src/engine';

describe.skip('events', () => {
    let server;
    let eventTypesService;
    let targetsService;
    let rulesService;

    beforeEach(() => {
        eventTypesService = buildEventTypesService();
        targetsService = buildTargetsService();
        rulesService = buildRulesService(targetsService, eventTypesService);
        const engine = buildEngine(eventTypesService, rulesService, targetsService);
        server = buildServer(eventTypesService, targetsService, rulesService, engine);
    });

    afterEach(async () => {
        await server.close();
        await rulesService.purge();
        await targetsService.purge();
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
            const createResponse = await server.inject({
                method: 'POST',
                url: '/admin/event-types',
                body: {
                    name: 'an event type'
                }
            });
            expect(createResponse.statusCode).toBe(201);
            expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
            const createdEventType = JSON.parse(createResponse.payload);

            const response = await server.inject({
                method: 'POST',
                url: '/events/' + createdEventType.id,
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

        it('should call target when event payload matches rule filters', async () => {
            const eventType = await createEventType(server);
            const target = await createTarget(server, 'http://example.org/');
            await createRule(server, target.id, eventType.id, 'a rule', { value: 2 });

            const scope = nock('http://example.org')
                .post('/', { value: 2 })
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

    async function createRule(server, targetId, eventTypeId, name = 'a rule', filters = undefined) {
        const createResponse = await server.inject({
            method: 'POST',
            url: '/admin/rules',
            body: {
                name,
                eventTypeId,
                targetId,
                filters
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
