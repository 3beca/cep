import { ObjectId } from 'mongodb';
import ConflictError from '../errors/conflict-error';
import Filter from '../filters/filter';
import InvalidOperationError from '../errors/invalid-operation-error';
import { toDto } from '../utils/dto';

export function buildRulesService(db, targetsService, eventTypesService) {

    const collection = db.collection('rules');

    targetsService.registerOnBeforeDelete(async id => {
        const rules = await collection.find({ targetId: new ObjectId(id) }).toArray();
        if (rules.length > 0) {
            throw new InvalidOperationError(`Target cannot be deleted as in use by rules [${rules.map(r => `"${r._id}"`).join(', ')}]`);
        }
    });

    eventTypesService.registerOnBeforeDelete(async id => {
        const rules = await collection.find({ eventTypeId: new ObjectId(id) }).toArray();
        if (rules.length > 0) {
            throw new InvalidOperationError(`Event type cannot be deleted as in use by rules [${rules.map(r => `"${r._id}"`).join(', ')}]`);
        }
    });

    return {
        async list(page, pageSize) {
            const rules = await collection.find({}).skip((page - 1) * pageSize).limit(pageSize).toArray();
            return rules.map(toDto);
        },
        async create(rule) {
            const { filters, name, eventTypeId, targetId } = rule;

            Filter.assertIsValid(filters);

            const eventType = await eventTypesService.getById(eventTypeId);
            if (!eventType) {
                throw new InvalidOperationError(`event type with identifier ${eventTypeId} does not exists`);
            }
            const target = await targetsService.getById(targetId);
            if (!target) {
                throw new InvalidOperationError(`target with identifier ${targetId} does not exists`);
            }
            const ruleToCreate = {
                name,
                targetId: new ObjectId(targetId),
                eventTypeId: new ObjectId(eventTypeId),
                filters,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            try {
                const { insertedId } = await collection.insertOne(ruleToCreate);
                return { ...ruleToCreate, id: insertedId.toString() };
            } catch (error) {
                if (error.name === 'MongoError' && error.code === 11000) {
                    const existingRule = await collection.findOne({ name });
                    if (existingRule) {
                        throw new ConflictError(`Rule name must be unique and is already taken by rule with id ${existingRule._id}`, existingRule._id);
                    }
                }
                throw error;
            }
        },
        async getById(id) {
            const rule = await collection.findOne({ _id: new ObjectId(id) });
            return toDto(rule);
        },
        async deleteById(id) {
            await collection.deleteOne({ _id: new ObjectId(id) });
        },
        async getByEventTypeId(eventTypeId) {
            const rules = await collection.find({ eventTypeId: new ObjectId(eventTypeId) }).toArray();
            return rules.map(toDto);
        }
    };
}
