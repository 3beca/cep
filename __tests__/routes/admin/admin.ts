jest.mock('pino');
import config from '../../../src/config';
import { ObjectId } from 'bson';
import { buildApp } from '../../../src/app';

describe('admin', () => {
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

    describe('check-health', () => {

        it('should return 204', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/admin/check-health'
            });
            expect(response.statusCode).toBe(204);
        });
    });

    describe('version', () => {

        it('should return 200 with cep version', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/admin/version'
            });
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            expect(response.payload).toBe(JSON.stringify({ version: '0.0.1' }));
        });
    });
});
