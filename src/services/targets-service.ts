import { ObjectId, Db } from 'mongodb';
import ConflictError from '../errors/conflict-error';
import { toDto } from '../utils/dto';
import escapeStringRegex from 'escape-string-regexp';

export function buildTargetsService(db: Db) {

    const collection = db.collection('targets');
    const beforeDeleteEventHandlers: ((id: string) => void)[] = [];

    function getContainsRegex(search: string): string {
        return `.*${escapeStringRegex(search)}.*`;
    }

    return {
        async list(page: number, pageSize: number, search?: string) {
            const query = search ? { name: { $regex: getContainsRegex(search), $options: 'i' } } : {};
            const targets = await collection.find(query).skip((page - 1) * pageSize).limit(pageSize).toArray();
            return targets.map(toDto);
        },
        async create(target) {
            const targetToCreate = {
                ...target,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            try {
                const { insertedId } = await collection.insertOne(targetToCreate);
                return { ...targetToCreate, id: insertedId.toString() };
            } catch (error) {
                if (error.name === 'MongoError' && error.code === 11000) {
                    const existingTarget = await collection.findOne({ name: target.name });
                    if (existingTarget) {
                        throw new ConflictError(`Target name must be unique and is already taken by target with id ${existingTarget._id}`, existingTarget._id);
                    }
                }
                throw error;
            }
        },
        async getById(id: string) {
            const target = await collection.findOne({ _id: new ObjectId(id) });
            return toDto(target);
        },
        async deleteById(id: string) {
            for (const beforeDelete of beforeDeleteEventHandlers) {
                await beforeDelete(id);
            }
            await collection.deleteOne({ _id: new ObjectId(id) });
        },
        async getByIds(ids: string[]): Promise<any[]> {
            const targets = await collection.find({ _id: { $in: ids.map(id => new ObjectId(id)) }}).toArray();
            return targets.map(toDto);
        },
        registerOnBeforeDelete(beforeDelete) {
            beforeDeleteEventHandlers.push(beforeDelete);
        }
    };
}
