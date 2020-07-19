jest.mock('pino');
import { buildAppConfig } from '../../../src/config';
import { ObjectId } from 'bson';
import { buildApp, App } from '../../../src/app';

describe('admin', () => {
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

    describe('check-health', () => {

        it('should return 204', async () => {
            const response = await adminServer.inject({
                method: 'GET',
                url: '/check-health'
            });
            expect(response.statusCode).toBe(204);
        });
    });
});
