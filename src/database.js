import mongodb from 'mongodb';

export function connect(uri) {
    return mongodb.connect(uri, { useNewUrlParser: true });
}

export async function getAndSetupDatabase(client, databaseName) {
    const db = client.db(databaseName);
    const eventTypes = db.collection('event-types');
    await eventTypes.createIndex({ name: 1 }, { unique: true });
    return db;
}
