jest.mock('pino');
import { ObjectId } from 'bson';
import { buildApp, App } from '../src/app';
import { buildMetrics } from '../src/metrics';
import { buildAppConfig } from '../src/config';
import { buildEventProcessingServer } from '../src/event-processing-server';
import { Engine } from '../src/engine';

describe('event processing server', () => {
    let app: App;
    let eventProcessingServer;

    beforeEach(async () => {
        const config = buildAppConfig();
        app = await buildApp({
            ...config,
            eventProcessingHttp: {
                ...config.adminHttp,
                enableSwagger: true
            },
            mongodb: {
                ...config.mongodb,
                databaseName: `test-${new ObjectId()}`
            }
        });
        eventProcessingServer = app.getEventProcessingServer();
    });

    afterEach(async () => {
        await app.getDatabase().dropDatabase();
        await app.close();
    });

    it('should return 404 for no existing endpoint', async () => {
      const response = await eventProcessingServer.inject({
          method: 'GET',
          url: '/not-existing-route'
        });
        expect(response.statusCode).toBe(404);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(response.payload).toBe(JSON.stringify({ message: 'Resource not found' }));
    });

    it('should return 200 for swagger endpoint', async () => {
        const response = await eventProcessingServer.inject({
          method: 'GET',
          url: '/documentation/static/index.html'
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toBe('text/html; charset=UTF-8');
    });

    it('should return 404 for swagger endpoint when swagger is not enabled', async () => {
        const eventProcessingServer = buildEventProcessingServer({
                trustProxy: false,
                enableSwagger: false,
                host: '',
                port: 0
            },
            null as unknown as Engine,
            buildMetrics());
        const response = await eventProcessingServer.inject({
          method: 'GET',
          url: '/documentation/static/index.html'
        });
        expect(response.statusCode).toBe(404);
    });

    it('should return 200 for swagger json endpoint', async () => {
        const response = await eventProcessingServer.inject({
          method: 'GET',
          url: '/documentation/json'
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    });

    it('should return 404 for swagger json endpoint when swagger is not enabled', async () => {
        const eventProcessingServer = buildEventProcessingServer({
                trustProxy: false,
                enableSwagger: false,
                host: '',
                port: 0
            },
            null as unknown as Engine,
            buildMetrics());
        const response = await eventProcessingServer.inject({
          method: 'GET',
          url: '/documentation/json'
        });
        expect(response.statusCode).toBe(404);
    });

    it('should return 500 when unhandled errors happened', async () => {
        eventProcessingServer.register(
            function(fastify, opts, next) {
                fastify.get('/', opts, async () => {
                    throw new Error('Something bad');
                });
                next();
            }, { prefix: '/error' }
        );

        const response = await eventProcessingServer.inject({
            method: 'GET',
            url: '/error'
        });

        expect(response.statusCode).toBe(500);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    });
});
