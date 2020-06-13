jest.mock('pino');
import config from '../src/config';
import { ObjectId } from 'bson';
import { buildApp } from '../src/app';

describe('metrics server', () => {
    let app;
    let metricsServer;

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
        metricsServer = app.getMetricsServer();
    });

    afterEach(async () => {
        await app.getDatabase().dropDatabase();
        await app.close();
    });

    it('should return 200 with prometheus metrics', async () => {
        const response = await metricsServer.inject({
            method: 'GET',
            url: '/metrics'
          });
          expect(response.statusCode).toBe(200);
          expect(response.headers['content-type']).toBe('text/plain');
          expect(response.payload).toBe('metrics');
    });

    it('should return 500 when unhandled errors happened', async () => {
        metricsServer.register(
            function(fastify, opts, next) {
                fastify.get('/', opts, async () => {
                    throw new Error('Something bad');
                });
                next();
            }, { prefix: '/error' }
        );

        const response = await metricsServer.inject({
            method: 'GET',
            url: '/error'
        });

        expect(response.statusCode).toBe(500);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    });
});
