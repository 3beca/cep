jest.mock('pino');
import { ObjectId } from 'mongodb';
import config from '../../../src/config';
import { buildApp } from '../../../src/app';

describe('admin', () => {
    let app;
    let server;

    beforeEach(async () => {
        const options = {
            databaseName: `test-${new ObjectId()}`,
            databaseUrl: config.mongodb.databaseUrl
        };
        app = await buildApp(options);
        server = app.getServer();
    });

    afterEach(async () => {
        await app.getDatabase().dropDatabase();
        await app.close();
    });

    describe('events', () => {

        it('should return an empty list of events when no events have been processed', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/admin/events'
            });
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            const listResponse = JSON.parse(response.payload);
            expect(listResponse.results.length).toBe(0);
            expect(listResponse.next).toBe(undefined);
            expect(listResponse.prev).toBe(undefined);
        });
    });
});
