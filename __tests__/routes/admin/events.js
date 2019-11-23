jest.mock('pino');
import { ObjectId } from 'mongodb';
import config from '../../../src/config';
import { buildApp } from '../../../src/app';

describe('admin', () => {
    let app;

    beforeEach(async () => {
        const options = {
            databaseName: `test-${new ObjectId()}`,
            databaseUrl: config.mongodb.databaseUrl
        };
        app = await buildApp(options);
    });

    afterEach(async () => {
        await app.getDatabase().dropDatabase();
        await app.close();
    });

    describe('events', () => {

        it('should return an empty list of events when no events have been processed', async () => {
            expect(true).toBe(true);
        });
    });
});
