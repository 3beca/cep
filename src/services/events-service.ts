import { toDto } from '../utils/dto';
import { ObjectId } from 'mongodb';

export function buildEventsService(db) {

    const collection = db.collection('events');

    return {
        async list(page, pageSize, eventTypeId?: string) {
            const query = eventTypeId ? { eventTypeId: new ObjectId(eventTypeId) } : {};
            const events = await collection.find(query).skip((page - 1) * pageSize).sort({ createdAt: -1 }).limit(pageSize).toArray();
            return events.map(toDto);
        },
        async getLastEvent(eventTypeId) {
            const events = await collection.find({ eventTypeId: new ObjectId(eventTypeId) }).sort({ createdAt: -1 }).limit(1).toArray();
            return toDto(events[0]);
        },
        async create(eventType, payload, requestId, rules, targets: any[] = [], targetsResponse: any[] = []) {
            const event = {
                payload,
                requestId,
                eventTypeId: new ObjectId(eventType.id),
                eventTypeName: eventType.name,
                rules: rules.map(r => ({ id: new ObjectId(r.id), name: r.name, targetId: new ObjectId(r.targetId) })),
                targets: targets.map((t, index) => {
                    const { statusCode, body } = targetsResponse[index];
                    return { id: new ObjectId(t.id), name: t.name, response: { statusCode, body } };
                }),
                createdAt: new Date()
            };
            await collection.insertOne(event);
            return toDto(event);
        }
    };
}
