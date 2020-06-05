jest.mock('pino');
import config from '../src/config';
import { ObjectId } from 'bson';
import { buildApp } from '../src/app';
import { buildServer } from '../src/server';
import { RulesExecutionsService } from '../src/services/rules-executions-service';
import { Engine } from '../src/engine';
import { EventsService } from '../src/services/events-service';
import { EventTypesService } from '../src/services/event-types-service';
import { TargetsService } from '../src/services/targets-service';
import { RulesService } from '../src/services/rules-services';

describe('builServer', () => {
    let app;
    let server;

    beforeEach(async () => {
        const options = {
            databaseName: `test-${new ObjectId()}`,
            databaseUrl: config.mongodb.databaseUrl,
            trustProxy: false,
            enableCors: false,
            scheduler: config.scheduler,
            internalHttp: config.internalHttp
        };
        app = await buildApp(options);
        server = app.getServer();
    });

    afterEach(async () => {
        await app.getDatabase().dropDatabase();
        await app.close();
    });

    it('should return 404 for no existing endpoint', async () => {
      const response = await server.inject({
          method: 'GET',
          url: '/not-existing-route'
        });
        expect(response.statusCode).toBe(404);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(response.payload).toBe(JSON.stringify({ message: 'Resource not found' }));
    });

    it('should return 200 for swagger endpoint', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/documentation/static/index.html'
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toBe('text/html; charset=UTF-8');
    });

    it('should return 200 for swagger json endpoint', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/documentation/json'
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    });

    it('should return 500 when unhandled errors happened', async () => {
        server.register(
            function(fastify, opts, next) {
                fastify.get('/', opts, async () => {
                    throw new Error('Something bad');
                });
                next();
            }, { prefix: '/error' }
        );

        const response = await server.inject({
            method: 'GET',
            url: '/error'
        });

        expect(response.statusCode).toBe(500);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    });

    it('should return 404 when CORS preflight request but cors is not enabled', async () => {
        server.register(
            function(fastify, opts, next) {
                fastify.get('/', async (request, reply) => {
                    reply.status(200).send({ success: true });
                });
                next();
            }, { prefix: '/cors' }
        );

        const responseOptions = await server.inject({
            method: 'OPTIONS',
            url: '/cors'
        });

        expect(responseOptions.statusCode).toBe(404);
        expect(responseOptions.headers['content-type']).toBe('application/json; charset=utf-8');

        const responseGet = await server.inject({
            method: 'GET',
            url: '/cors',
            headers: {
                origin: 'https://mywebsite.com'
            }
        });

        expect(responseGet.statusCode).toBe(200);
        expect(responseGet.headers['access-control-allow-origin']).toBe(undefined);
    });

    it('should return 204 when CORS preflight request and cors is enabled', async () => {
        const server = buildServer({ trustProxy: false, enableCors: true },
            null as unknown as EventTypesService,
            null as unknown as TargetsService,
            null as unknown as RulesService,
            null as unknown as EventsService,
            null as unknown as RulesExecutionsService,
            null as unknown as Engine);
        server.register(
            function(fastify, opts, next) {
                fastify.get('/', async (request, reply) => {
                    reply.status(200).send({ success: true });
                });
                next();
            }, { prefix: '/cors' }
        );

        const responseOptions = await server.inject({
            method: 'OPTIONS',
            url: '/cors'
        });

        expect(responseOptions.statusCode).toBe(204);

        const responseGet = await server.inject({
            method: 'GET',
            url: '/cors',
            headers: {
                origin: 'https://mywebsite.com'
            }
        });

        expect(responseGet.statusCode).toBe(200);
        expect(responseGet.headers['access-control-allow-origin']).toBe('https://mywebsite.com');
    });
});
