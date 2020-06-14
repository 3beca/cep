jest.mock('pino');
import config from '../src/config';
import { ObjectId } from 'bson';
import { buildApp, App } from '../src/app';
import { FastifyInstance } from 'fastify';

describe('metrics server', () => {
    let app: App;
    let metricsServer: FastifyInstance;

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
        await app.getInternalServer().inject({
            method: 'GET',
            url: '/test'
        });
        await app.getServer().inject({
            method: 'GET',
            url: '/test'
        });
        const response = await metricsServer.inject({
            method: 'GET',
            url: '/metrics'
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toBe('text/plain');
        expect(response.payload).toContain('process_cpu_user_seconds_total');
        expect(response.payload).toContain('nodejs_version_info');
        expect(response.payload).toContain('cep_internal_server_http_request_duration_seconds_bucket');
        expect(response.payload).toContain('cep_internal_server_http_request_duration_seconds_sum');
        expect(response.payload).toContain('cep_internal_server_http_request_duration_seconds_count');
        expect(response.payload).toContain('cep_internal_server_http_request_summary_seconds');
        expect(response.payload).toContain('cep_internal_server_http_request_summary_seconds_sum');
        expect(response.payload).toContain('cep_internal_server_http_request_summary_seconds_count');
        expect(response.payload).toContain('cep_server_http_request_duration_seconds_bucket');
        expect(response.payload).toContain('cep_server_http_request_duration_seconds_sum');
        expect(response.payload).toContain('cep_server_http_request_duration_seconds_count');
        expect(response.payload).toContain('cep_server_http_request_summary_seconds');
        expect(response.payload).toContain('cep_server_http_request_summary_seconds_sum');
        expect(response.payload).toContain('cep_server_http_request_summary_seconds_count');
    });

    it('should return 500 when unhandled errors happened', async () => {
        metricsServer.register(
            function(fastify, opts, next) {
                fastify.get('/', {}, async () => {
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
