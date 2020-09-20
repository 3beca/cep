import { connect } from '../src/database';
import { buildConfig } from '../src/config';
import { ObjectId, Db, MongoClient } from 'mongodb';
import { buildScheduler, Scheduler } from '../src/scheduler';

describe('scheduler', () => {

    let dbClient: MongoClient;
    let db: Db;
    let scheduler: Scheduler;

    beforeEach(async () => {
        const config = buildConfig();
        dbClient = await connect(config.mongodb.url);
        const databaseName = `test-${new ObjectId()}`;
        db = dbClient.db(databaseName);
        scheduler = buildScheduler(db);
        await scheduler.start();
    });

    afterEach(async () => {
        await scheduler.stop();
        await db.dropDatabase();
        await dbClient.close();
        jest.clearAllMocks();
    });

    it('scheduled job failing its execution should raise onError event', async () => {
        scheduler.setJobHandler('test', async () => {
            throw new Error('Oops, an error occurred');
        });
        await new Promise(resolve => {
            scheduler.scheduleJob('1 second', 'test', {});
            scheduler.onJobError((id, name, data, error) => {
                expect(name).toBe('test');
                expect(error.message).toBe('Oops, an error occurred');
                resolve();
            });
        });
    });
});
