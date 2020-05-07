import { ObjectId } from 'mongodb';
import ConflictError from '../errors/conflict-error';
import Filter from '../filters/filter';
import InvalidOperationError from '../errors/invalid-operation-error';
import { toDto } from '../utils/dto';
import escapeStringRegexp from 'escape-string-regexp';

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

    function getContainsRegex(search: string): string {
        return `.*${escapeStringRegexp(search)}.*`;
    }

    function reduceToDictionary(dictionary, current) {
        dictionary[current.id] = current;
        return dictionary;
    }

    async function getEventTypesDictionaryByIds(ids: string[]): Promise<{[key: string]: any }> {
        const eventTypes = await eventTypesService.getByIds(ids);
        return eventTypes.reduce(reduceToDictionary, {});
    }

    async function getTargetsDictionaryByIds(ids: string[]): Promise<{[key: string]: any }> {
        const targets = await targetsService.getByIds(ids);
        return targets.reduce(reduceToDictionary, {});
    }

    async function toRuleDto(rule) {
        const { eventTypeId, targetId } = rule;
        const eventTypes = await getEventTypesDictionaryByIds([eventTypeId.toHexString()]);
        const targets = await getTargetsDictionaryByIds([targetId.toHexString()]);
        return toDto(denormalizeRule(rule, eventTypes, targets));
    }

    async function toRulesDtos(rules: any[]) {
        const eventTypesIds = [ ...new Set(rules.map(r => r.eventTypeId.toHexString())) ];
        const targetsIds = [ ...new Set(rules.map(r => r.targetId.toHexString())) ];
        const eventTypes = await getEventTypesDictionaryByIds(eventTypesIds);
        const targets = await getTargetsDictionaryByIds(targetsIds);
        return rules.map(rule => denormalizeRule(rule, eventTypes, targets)).map(toDto);
    }

    function denormalizeRule(rule: any, eventTypes: {[key:string]: any}, targets: {[key:string]: any}) {
        const { eventTypeId, targetId } = rule;
        const { name: eventTypeName } = eventTypes[eventTypeId.toHexString()];
        const { name: targetName } = targets[targetId.toHexString()];
        return { ...rule, eventTypeName, targetName };
    }

    return {
        async list(page: number, pageSize: number, search: string) {
            const query = search ? { name: { $regex: getContainsRegex(search), $options: 'i' } } : {};
            const rules = await collection.find(query).skip((page - 1) * pageSize).limit(pageSize).toArray();
            return toRulesDtos(rules);
        },
        async create(rule) {
            const { filters, name, eventTypeId, targetId, skipOnConsecutivesMatches } = rule;

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
                skipOnConsecutivesMatches,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            try {
                const { insertedId } = await collection.insertOne(ruleToCreate);
                return toRuleDto({
                    ...ruleToCreate,
                    id: insertedId.toString()
                });
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
        async getById(id: string) {
            const rule = await collection.findOne({ _id: new ObjectId(id) });
            if (!rule) {
                return null;
            }
            return toRuleDto(rule);
        },
        async deleteById(id: string) {
            await collection.deleteOne({ _id: new ObjectId(id) });
        },
        async getByEventTypeId(eventTypeId: string) {
            const rules = await collection.find({ eventTypeId: new ObjectId(eventTypeId) }).toArray();
            return toRulesDtos(rules);
        }
    };
}
