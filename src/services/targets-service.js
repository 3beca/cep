import { ObjectId } from 'mongodb';
import ConflictError from '../errors/conflict-error';
import { toDto } from '../utils/dto';

export function buildTargetsService(db) {

    const collection = db.collection('targets');
    const beforeDeleteEventHandlers = [];

    return {
        async list(page, pageSize) {
            const targets = await collection.find({}).skip((page - 1) * pageSize).limit(pageSize).toArray();
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
                return { ...targetToCreate, id: insertedId};
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
        async getById(id) {
            const target = await collection.findOne({ _id: new ObjectId(id) });
            return toDto(target);
        },
        async deleteById(id) {
            for (const beforeDelete of beforeDeleteEventHandlers) {
                await beforeDelete(id);
            }
            await collection.deleteOne({ _id: new ObjectId(id) });
        },
        async getByRuleIds(ids) {
            const targets = await collection.find({ _id: { $in: ids.map(id => new ObjectId(id)) }}).toArray();
            return targets.map(toDto);
        },
        registerOnBeforeDelete(beforeDelete) {
            beforeDeleteEventHandlers.push(beforeDelete);
        }
    };
}
