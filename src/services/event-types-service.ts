import { ObjectId, Db } from 'mongodb';
import { toDto } from '../utils/dto';
import escapeStringRegexp from 'escape-string-regexp';
import { EventType } from '../models/event-type';
import NotFoundError from '../errors/not-found-error';
import { handleConflictError } from '../errors/conflict-error-handler';

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

    function findByName(name: string): Promise<{ _id: ObjectId } | null> {
        return collection.findOne({ name }, { projection: { _id: 1 } });
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
                throw await handleConflictError(error, () => findByName(eventType.name),
                    { message: 'Event type name must be unique and is already taken by event type with id [ID]', resources: 'event-types' });
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
                throw await handleConflictError(error, () => findByName(eventType.name),
                { message: 'Event type name must be unique and is already taken by event type with id [ID]', resources: 'event-types' });
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
