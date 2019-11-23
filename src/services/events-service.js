import { toDto } from '../utils/dto';

export function buildEventsService(db) {

    const collection = db.collection('events');

    return {
        async list(page, pageSize) {
            const events = await collection.find({}).skip((page - 1) * pageSize).sort({ createdAt: -1 }).limit(pageSize).toArray();
            return events.map(toDto);
        },
        async create(event) {
            event.createdAt = new Date();
            await collection.insertOne(event);
            return event;
        }
    };
}
