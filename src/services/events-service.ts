import { toDto } from '../utils/dto';
import { ObjectId, Db } from 'mongodb';
import { Event } from '../models/event';

export type EventsService = {
    list(page: number, pageSize: number, eventTypeId?: string): Promise<Event[]>;
    create(event: Event): Promise<Event>
}

export function buildEventsService(db: Db): EventsService {

    const collection = db.collection('events');

    return {
        async list(page: number, pageSize: number, eventTypeId?: string): Promise<Event[]> {
            const query = eventTypeId ? { eventTypeId: new ObjectId(eventTypeId) } : {};
            const events = await collection.find(query).skip((page - 1) * pageSize).sort({ createdAt: -1 }).limit(pageSize).toArray();
            return events.map(toDto);
        },
        async create(event: Event): Promise<Event> {
            const eventToCreate = {
                ...event,
                eventTypeId: ObjectId.createFromHexString(event.eventTypeId),
                createdAt: new Date()
            };
            const { insertedId } = await collection.insertOne(eventToCreate);
            return toDto({ ...eventToCreate, _id: insertedId });
        }
    };
}
