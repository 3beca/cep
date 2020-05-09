import mongodb from 'mongodb';

export function connect(uri) {
    return mongodb.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        ignoreUndefined: true
    });
}

const ninetyDays = 60 * 60 * 24 * 30 * 3;

export async function getAndSetupDatabase(client, databaseName) {
    const db = client.db(databaseName);
    const eventTypes = db.collection('event-types');
    const targets = db.collection('targets');
    const rules = db.collection('rules');
    const events = db.collection('events');
    const rulesExecutions = db.collection('rules-executions');
    await Promise.all([
        eventTypes.createIndex({ name: 1 }, { unique: true }),
        targets.createIndex({ name: 1 }, { unique: true }),
        rules.createIndex({ name: 1 }, { unique: true }),
        rules.createIndex({ targetId: 1 }),
        rules.createIndex({ eventTypeId: 1 }),
        events.createIndex({ createdAt: 1 }, { expireAfterSeconds: ninetyDays }),
        events.createIndex({ eventTypeId: 1, createdAt: 1 }),
        rulesExecutions.createIndex({ ruleId: 1, executionAt: 1 }),
        rulesExecutions.createIndex({ eventTypeId: 1, ruleId: 1, executionAt: 1 })
    ]);
    return db;
}
