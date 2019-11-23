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
    await eventTypes.createIndex({ name: 1 }, { unique: true });
    await targets.createIndex({ name: 1 }, { unique: true });
    await rules.createIndex({ name: 1 }, { unique: true });
    await rules.createIndex({ targetId: 1 });
    await rules.createIndex({ eventTypeId: 1 });
    await events.createIndex({ createdAt: 1 }, { expireAfterSeconds: ninetyDays });
    await events.createIndex({ eventTypeId: 1, createdAt: 1 });
    return db;
}
