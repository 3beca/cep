jest.mock('pino');
import { ObjectId } from 'bson';
import { buildApp, App } from '../src/app';
import { buildAdminServer } from '../src/admin-server';
import { RulesExecutionsService } from '../src/services/rules-executions-service';
import { EventsService } from '../src/services/events-service';
import { EventTypesService } from '../src/services/event-types-service';
import { TargetsService } from '../src/services/targets-service';
import { RulesService } from '../src/services/rules-services';
import { buildMetrics } from '../src/metrics';
import { buildConfig } from '../src/config';

describe('admin server', () => {
    let app: App;
    let adminServer;

    beforeEach(async () => {
        const config = buildConfig();
        app = await buildApp({
            ...config,
            adminHttp: {
                ...config.adminHttp,
                enableSwagger: true
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

    it('should return 404 for no existing endpoint', async () => {
      const response = await adminServer.inject({
          method: 'GET',
          url: '/not-existing-route'
        });
        expect(response.statusCode).toBe(404);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(response.payload).toBe(JSON.stringify({ message: 'Resource not found' }));
    });

    it('should return 200 for swagger endpoint', async () => {
        const response = await adminServer.inject({
          method: 'GET',
          url: '/documentation/static/index.html'
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toBe('text/html; charset=UTF-8');
    });

    it('should return 404 for swagger endpoint when swagger is not enabled', async () => {
        const adminServer = buildAdminServer({
                trustProxy: false,
                enableCors: true,
                enableSwagger: false,
                host: '',
                port: 0,
                eventProcessingHttpBaseUrl: ''
            },
            null as unknown as EventTypesService,
            null as unknown as TargetsService,
            null as unknown as RulesService,
            null as unknown as EventsService,
            null as unknown as RulesExecutionsService,
            buildMetrics());
        const response = await adminServer.inject({
          method: 'GET',
          url: '/documentation/static/index.html'
        });
        expect(response.statusCode).toBe(404);
    });

    it('should return 200 for swagger json endpoint', async () => {
        const response = await adminServer.inject({
          method: 'GET',
          url: '/documentation/json'
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    });

    it('should return 404 for swagger json endpoint when swagger is not enabled', async () => {
        const adminServer = buildAdminServer({
                trustProxy: false,
                enableCors: true,
                enableSwagger: false,
                host: '',
                port: 0,
                eventProcessingHttpBaseUrl: ''
            },
            null as unknown as EventTypesService,
            null as unknown as TargetsService,
            null as unknown as RulesService,
            null as unknown as EventsService,
            null as unknown as RulesExecutionsService,
            buildMetrics());
        const response = await adminServer.inject({
          method: 'GET',
          url: '/documentation/json'
        });
        expect(response.statusCode).toBe(404);
    });

    it('should return 500 when unhandled errors happened', async () => {
        adminServer.register(
            function(fastify, opts, next) {
                fastify.get('/', opts, async () => {
                    throw new Error('Something bad');
                });
                next();
            }, { prefix: '/error' }
        );

        const response = await adminServer.inject({
            method: 'GET',
            url: '/error'
        });

        expect(response.statusCode).toBe(500);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    });

    it('should return 404 when CORS preflight request but cors is not enabled', async () => {
        adminServer.register(
            function(fastify, opts, next) {
                fastify.get('/', async (request, reply) => {
                    reply.status(200).send({ success: true });
                });
                next();
            }, { prefix: '/cors' }
        );

        const responseOptions = await adminServer.inject({
            method: 'OPTIONS',
            url: '/cors'
        });

        expect(responseOptions.statusCode).toBe(404);
        expect(responseOptions.headers['content-type']).toBe('application/json; charset=utf-8');

        const responseGet = await adminServer.inject({
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
        const adminServer = buildAdminServer({
                trustProxy: false,
                enableCors: true,
                enableSwagger: false,
                host: '',
                port: 0,
                eventProcessingHttpBaseUrl: ''
            },
            null as unknown as EventTypesService,
            null as unknown as TargetsService,
            null as unknown as RulesService,
            null as unknown as EventsService,
            null as unknown as RulesExecutionsService,
            buildMetrics());
        adminServer.register(
            function(fastify, opts, next) {
                fastify.get('/', async (request, reply) => {
                    reply.status(200).send({ success: true });
                });
                next();
            }, { prefix: '/cors' }
        );

        const responseOptions = await adminServer.inject({
            method: 'OPTIONS',
            url: '/cors'
        });

        expect(responseOptions.statusCode).toBe(204);

        const responseGet = await adminServer.inject({
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
