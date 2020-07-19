jest.mock('pino');
import { buildAppConfig } from '../../../src/config';
import { ObjectId } from 'bson';
import { buildApp, App } from '../../../src/app';

describe('admin server', () => {
    let app: App;
    let adminServer;

    beforeEach(async () => {
        const config = buildAppConfig();
        app = await buildApp({
            ...config,
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

    describe('version', () => {

        it('should return 200 with cep version', async () => {
            const response = await adminServer.inject({
                method: 'GET',
                url: '/version'
            });
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            expect(response.payload).toBe(JSON.stringify({ version: '0.0.1' }));
        });
    });

});
