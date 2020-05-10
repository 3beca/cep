import { ObjectId, Db } from 'mongodb';
import ConflictError from '../errors/conflict-error';
import { toDto } from '../utils/dto';
import escapeStringRegexp from 'escape-string-regexp';

export type EventTypesService = {
    list(page: number, pageSize: number, search: string): Promise<any[]>;
    create(eventType);
    getById(id: ObjectId): Promise<any>;
    getByIds(ids: ObjectId[]): Promise<any[]>;
    deleteById(id: ObjectId): Promise<void>;
    registerOnBeforeDelete(beforeDelete: (id: ObjectId) => void): void;
}

export function buildEventTypesService(db: Db): EventTypesService {

    const collection = db.collection('event-types');
    const beforeDeleteEventHandlers: ((id: ObjectId) => void)[] = [];

    function getContainsRegex(search: string): string {
        return `.*${escapeStringRegexp(search)}.*`;
    }

    return {
        async list(page: number, pageSize: number, search: string): Promise<any[]> {
            const query = search ? { name: { $regex: getContainsRegex(search), $options: 'i' } } : {};
            const eventTypes = await collection.find(query).skip((page - 1) * pageSize).limit(pageSize).toArray();
            return eventTypes.map(toDto);
        },
        async create(eventType) {
            const eventTypeToCreate = {
                ...eventType,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            try {
                const { insertedId } = await collection.insertOne(eventTypeToCreate);
                return { ...eventTypeToCreate, id: insertedId.toString() };
            } catch (error) {
                if (error.name === 'MongoError' && error.code === 11000) {
                    const existingEventType = await collection.findOne({ name: eventType.name });
                    if (existingEventType) {
                        throw new ConflictError(`Event type name must be unique and is already taken by event type with id ${existingEventType._id}`, existingEventType._id);
                    }
                }
                throw error;
            }
        },
        async getById(id: ObjectId): Promise<any> {
            const eventType = await collection.findOne({ _id: id });
            return toDto(eventType);
        },
        async getByIds(ids: ObjectId[]): Promise<any[]> {
            const eventTypes = await collection.find({ _id: { $in: ids }}).toArray();
            return eventTypes.map(toDto);
        },
        async deleteById(id: ObjectId): Promise<void> {
            for (const beforeDelete of beforeDeleteEventHandlers) {
                await beforeDelete(id);
            }
            await collection.deleteOne({ _id: id });
        },
        registerOnBeforeDelete(beforeDelete: (id: ObjectId) => void): void {
            beforeDeleteEventHandlers.push(beforeDelete);
        }
    };
}
