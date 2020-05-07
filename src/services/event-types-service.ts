import { ObjectId } from 'mongodb';
import ConflictError from '../errors/conflict-error';
import { toDto } from '../utils/dto';

export function buildEventTypesService(db) {

    const collection = db.collection('event-types');
    const beforeDeleteEventHandlers: ((id: string) => void)[] = [];

    return {
        async list(page, pageSize) {
            const eventTypes = await collection.find({}).skip((page - 1) * pageSize).limit(pageSize).toArray();
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
        async getById(id: string) {
            const eventType = await collection.findOne({ _id: new ObjectId(id) });
            return toDto(eventType);
        },
        async getByIds(ids: string[]): Promise<any[]> {
            const eventTypes = await collection.find({ _id: { $in: ids.map(id => new ObjectId(id)) }}).toArray();
            return eventTypes.map(toDto);
        },
        async deleteById(id: string) {
            for (const beforeDelete of beforeDeleteEventHandlers) {
                await beforeDelete(id);
            }
            await collection.deleteOne({ _id: new ObjectId(id) });
        },
        registerOnBeforeDelete(beforeDelete) {
            beforeDeleteEventHandlers.push(beforeDelete);
        }
    };
}
