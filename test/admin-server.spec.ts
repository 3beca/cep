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
        expect(response.payload).toBe(JSON.stringify({
            statusCode: 404,
            error: 'Not Found',
            message: 'Resource not found'
        }));
    });

    it('should return 401 when api keys are set but does not match request Authorization header', async () => {
        const adminServer = buildAdminServer({
            trustProxy: false,
            enableCors: true,
            enableSwagger: false,
            host: '',
            port: 0,
            eventProcessingHttpBaseUrl: '',
            apiKeys: 'myApiKey1 myApiKey2'
        },
        null as unknown as EventTypesService,
        null as unknown as TargetsService,
        null as unknown as RulesService,
        null as unknown as EventsService,
        null as unknown as RulesExecutionsService,
        buildMetrics());
        const response = await adminServer.inject({
            method: 'GET',
            url: '/a-route',
            headers: {
                authorization: 'apiKey myApiKey3'
            }
        });
        expect(response.statusCode).toBe(401);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(JSON.parse(response.payload)).toStrictEqual({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'invalid authorization header'
        });
    });

    it('should return 401 when api keys are set but no Authorization header', async () => {
        const adminServer = buildAdminServer({
            trustProxy: false,
            enableCors: true,
            enableSwagger: false,
            host: '',
            port: 0,
            eventProcessingHttpBaseUrl: '',
            apiKeys: 'myApiKey1 myApiKey2'
        },
        null as unknown as EventTypesService,
        null as unknown as TargetsService,
        null as unknown as RulesService,
        null as unknown as EventsService,
        null as unknown as RulesExecutionsService,
        buildMetrics());
        const response = await adminServer.inject({
            method: 'GET',
            url: '/a-route'
        });
        expect(response.statusCode).toBe(401);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(JSON.parse(response.payload)).toStrictEqual({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'missing authorization header'
        });
    });

    it('should return 200 for swagger endpoint', async () => {
        const response = await adminServer.inject({
          method: 'GET',
          url: '/documentation/static/index.html'
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toBe('text/html; charset=UTF-8');
    });

    it('should return 200 for swagger endpoint when no authorization header set and apiKeys are set', async () => {
        const adminServer = buildAdminServer({
                trustProxy: false,
                enableCors: true,
                enableSwagger: true,
                host: '',
                port: 0,
                eventProcessingHttpBaseUrl: '',
                apiKeys: 'myApiKey1 myApiKey2'
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
        expect(response.statusCode).toBe(200);
    });

    it('should return 404 for swagger endpoint when swagger is not enabled', async () => {
        const adminServer = buildAdminServer({
                trustProxy: false,
                enableCors: true,
                enableSwagger: false,
                host: '',
                port: 0,
                eventProcessingHttpBaseUrl: '',
                apiKeys: ''
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

    it('should return 200 for swagger json endpoint when no authorization header set and apiKeys are set', async () => {
        const adminServer = buildAdminServer({
                trustProxy: false,
                enableCors: true,
                enableSwagger: true,
                host: '',
                port: 0,
                eventProcessingHttpBaseUrl: '',
                apiKeys: 'myApiKey1 myApiKey2'
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
        expect(response.statusCode).toBe(200);
    });

    it('should return 404 for swagger json endpoint when swagger is not enabled', async () => {
        const adminServer = buildAdminServer({
                trustProxy: false,
                enableCors: true,
                enableSwagger: false,
                host: '',
                port: 0,
                eventProcessingHttpBaseUrl: '',
                apiKeys: ''
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
                fastify.post('/', async (request, reply) => {
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

        const responsePost = await adminServer.inject({
            method: 'POST',
            url: '/cors',
            headers: {
                'Content-Type': 'application/json',
                origin: 'https://mywebsite.com'
            },
            body: { test: true }
        });

        expect(responsePost.statusCode).toBe(200);
        expect(responsePost.headers['access-control-allow-origin']).toBe(undefined);
    });

    it('should return 204 when CORS preflight request and cors and security is enabled', async () => {
        const adminServer = buildAdminServer({
                trustProxy: false,
                enableCors: true,
                enableSwagger: false,
                host: '',
                port: 0,
                eventProcessingHttpBaseUrl: '',
                apiKeys: 'abc'
            },
            null as unknown as EventTypesService,
            null as unknown as TargetsService,
            null as unknown as RulesService,
            null as unknown as EventsService,
            null as unknown as RulesExecutionsService,
            buildMetrics());
        adminServer.register(
            function(fastify, opts, next) {
                fastify.post('/', async (request, reply) => {
                    reply.status(200).send({ success: true });
                });
                next();
            }, { prefix: '/cors' }
        );

        const responseOptions = await adminServer.inject({
            method: 'OPTIONS',
            url: '/cors',
            headers: {
                origin: 'https://mywebsite.com',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type, Authorization'
            }
        });

        expect(responseOptions.statusCode).toBe(204);
        expect(responseOptions.headers['access-control-allow-origin']).toBe('https://mywebsite.com');
        expect(responseOptions.headers['access-control-allow-methods']).toBe('GET, POST, DELETE, PUT');
        expect(responseOptions.headers['access-control-allow-headers']).toBe('Content-Type, Authorization');

        const responsePost = await adminServer.inject({
            method: 'POST',
            url: '/cors',
            headers: {
                'Content-Type': 'application/json',
                authorization: 'apiKey abc',
                origin: 'https://mywebsite.com'
            },
            body: { test: true}
        } as any);

        expect(responsePost.statusCode).toBe(200);
        expect(responsePost.headers['access-control-allow-origin']).toBe('https://mywebsite.com');
    });

    it('should return 204 when CORS preflight request and cors is enabled but security is not enabled', async () => {
        const adminServer = buildAdminServer({
                trustProxy: false,
                enableCors: true,
                enableSwagger: false,
                host: '',
                port: 0,
                eventProcessingHttpBaseUrl: '',
                apiKeys: ''
            },
            null as unknown as EventTypesService,
            null as unknown as TargetsService,
            null as unknown as RulesService,
            null as unknown as EventsService,
            null as unknown as RulesExecutionsService,
            buildMetrics());
        adminServer.register(
            function(fastify, opts, next) {
                fastify.post('/', async (request, reply) => {
                    reply.status(200).send({ success: true });
                });
                next();
            }, { prefix: '/cors' }
        );

        const responseOptions = await adminServer.inject({
            method: 'OPTIONS',
            url: '/cors',
            headers: {
                origin: 'https://mywebsite.com',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type, Authorization'
            }
        });

        expect(responseOptions.statusCode).toBe(204);
        expect(responseOptions.headers['access-control-allow-origin']).toBe('https://mywebsite.com');
        expect(responseOptions.headers['access-control-allow-methods']).toBe('GET, POST, DELETE, PUT');
        expect(responseOptions.headers['access-control-allow-headers']).toBe('Content-Type');
    });
});
