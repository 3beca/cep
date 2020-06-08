import { toDto } from '../utils/dto';
import { ObjectId, Db } from 'mongodb';
import { Event } from '../models/event';
import { Group } from '../models/group';
import { WindowSize } from '../models/window-size';
import { toMongo$Group, getEmptyGroupResult } from '../windowing/group';
import { convertWindowSizeToDateTime } from '../windowing/window-size';

export type EventsService = {
    list(page: number, pageSize: number, eventTypeId?: ObjectId): Promise<Event[]>;
    create(event: Omit<Event, 'id'>): Promise<Event>,
    aggregate(eventTypeId: ObjectId, windowSize: WindowSize, group: Group): Promise<any>;
}

export function buildEventsService(db: Db): EventsService {

    const collection = db.collection('events');

    return {
        async list(page: number, pageSize: number, eventTypeId?: ObjectId): Promise<Event[]> {
            const query = eventTypeId ? { eventTypeId } : {};
            const events = await collection.find(query).skip((page - 1) * pageSize).sort({ createdAt: -1 }).limit(pageSize).toArray();
            return events.map(toDto);
        },
        async create(event: Omit<Event, 'id'>): Promise<Event> {
            const eventToCreate = {
                ...event,
                createdAt: new Date()
            };
            const { insertedId } = await collection.insertOne(eventToCreate);
            return { ...eventToCreate, id: insertedId };
        },
        async aggregate(eventTypeId: ObjectId, windowSize: WindowSize, group: Group): Promise<any> {
            const result = await collection.aggregate([
                {
                    $match: {
                        eventTypeId,
                        createdAt: {
                            $gt: convertWindowSizeToDateTime(windowSize)
                        }
                    }
                },
                {
                    $group: toMongo$Group(group, 'payload.')
                }
            ]).toArray();
            if (result.length === 0) {
                return getEmptyGroupResult(group);
            }
            const { _id, ...rest } = result[0];
            return rest;
        }
    };
}
