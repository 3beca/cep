import { ObjectId, Db } from 'mongodb';
import ConflictError from '../errors/conflict-error';
import { toDto } from '../utils/dto';
import escapeStringRegexp from 'escape-string-regexp';
import { EventType } from '../models/event-type';
import NotFoundError from '../errors/not-found-error';

export type EventTypesService = {
    list(page: number, pageSize: number, search: string): Promise<EventType[]>;
    create(eventType: Pick<EventType, 'name'>): Promise<EventType>;
    getById(id: ObjectId): Promise<EventType>;
    getByIds(ids: ObjectId[]): Promise<EventType[]>;
    updateById(id: ObjectId, eventType: Pick<EventType, 'name'>): Promise<EventType>;
    deleteById(id: ObjectId): Promise<void>;
    registerOnBeforeDelete(beforeDelete: (id: ObjectId) => void): void;
}

export function buildEventTypesService(db: Db): EventTypesService {

    const collection = db.collection('event-types');
    const beforeDeleteEventHandlers: ((id: ObjectId) => void)[] = [];

    function getContainsRegex(search: string): string {
        return `.*${escapeStringRegexp(search)}.*`;
    }

    async function handleConflictError(error, name: string): Promise<object> {
        if (error.name === 'MongoError' && error.code === 11000) {
            const existingEventType = await collection.findOne({ name });
            if (existingEventType) {
                return new ConflictError(`Event type name must be unique and is already taken by event type with id ${existingEventType._id}`, existingEventType._id, 'event-types');
            }
        }
        return error;
    }

    return {
        async list(page: number, pageSize: number, search: string): Promise<EventType[]> {
            const query = search ? { name: { $regex: getContainsRegex(search), $options: 'i' } } : {};
            const eventTypes = await collection.find(query).skip((page - 1) * pageSize).limit(pageSize).toArray();
            return eventTypes.map(toDto);
        },
        async create(eventType: Pick<EventType, 'name'>): Promise<EventType> {
            const eventTypeToCreate = {
                ...eventType,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            try {
                const { insertedId } = await collection.insertOne(eventTypeToCreate);
                return { ...eventTypeToCreate, id: insertedId };
            } catch (error) {
                throw await handleConflictError(error, eventType.name);
            }
        },
        async updateById(id: ObjectId, eventType: Pick<EventType, 'name'>): Promise<EventType> {
            const existingEventType = await this.getById(id);
            if (!existingEventType) {
                throw new NotFoundError(`Event type ${id} cannot be found`);
            }
            const eventTypeToUpdate = {
                ...existingEventType,
                name: eventType.name,
                id: undefined,
                updatedAt: new Date()
            };
            try {
                await collection.replaceOne({ _id: id }, eventTypeToUpdate);
                return { ...eventTypeToUpdate, id };
            } catch (error) {
                throw await handleConflictError(error, eventType.name);
            }
        },
        async getById(id: ObjectId): Promise<EventType> {
            const eventType = await collection.findOne({ _id: id });
            return toDto(eventType);
        },
        async getByIds(ids: ObjectId[]): Promise<EventType[]> {
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
