jest.mock('pino');
import { buildConfig } from '../../../src/config';
import { ObjectId } from 'bson';
import { buildApp, App } from '../../../src/app';

describe('admin server', () => {
    let app: App;
    let adminServer;

    beforeEach(async () => {
        const config = buildConfig();
        app = await buildApp({
            ...config,
            adminHttp: {
                ...config.adminHttp,
                apiKeys: 'myApiKey myApiKey2'
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

    describe('check-health', () => {

        it('should return 401 when invalid token', async () => {
            const response = await adminServer.inject({
                method: 'GET',
                url: '/check-health',
                headers: {
                    authorization: 'apiKey invalidApiKey'
                }
            });
            expect(response.statusCode).toBe(401);
        });

        it('should return 204', async () => {
            const response = await adminServer.inject({
                method: 'GET',
                url: '/check-health',
                headers: {
                    authorization: 'apiKey myApiKey'
                }
            });
            expect(response.statusCode).toBe(204);
        });
    });
});
