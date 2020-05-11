import { ObjectId, Db } from 'mongodb';
import ConflictError from '../errors/conflict-error';
import Filter from '../filters/filter';
import InvalidOperationError from '../errors/invalid-operation-error';
import { toDto } from '../utils/dto';
import escapeStringRegexp from 'escape-string-regexp';
import { EventTypesService } from './event-types-service';
import { TargetsService } from './targets-service';
import { Rule } from '../models/rule';

export type RulesService = {
    list(page: number, pageSize: number, search: string): Promise<Rule[]>;
    create(rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>): Promise<Rule>;
    getById(id: ObjectId): Promise<Rule>;
    deleteById(id: ObjectId): Promise<void>;
    getByEventTypeId(eventTypeId: ObjectId): Promise<Rule[]>;
}

export function buildRulesService(db: Db, targetsService: TargetsService, eventTypesService: EventTypesService): RulesService {

    const collection = db.collection('rules');

    targetsService.registerOnBeforeDelete(async (targetId: ObjectId) => {
        const rules = await collection.find({ targetId }).toArray();
        if (rules.length > 0) {
            throw new InvalidOperationError(`Target cannot be deleted as in use by rules [${rules.map(r => `"${r._id}"`).join(', ')}]`);
        }
    });

    eventTypesService.registerOnBeforeDelete(async (eventTypeId: ObjectId) => {
        const rules = await collection.find({ eventTypeId }).toArray();
        if (rules.length > 0) {
            throw new InvalidOperationError(`Event type cannot be deleted as in use by rules [${rules.map(r => `"${r._id}"`).join(', ')}]`);
        }
    });

    function getContainsRegex(search: string): string {
        return `.*${escapeStringRegexp(search)}.*`;
    }

    return {
        async list(page: number, pageSize: number, search: string): Promise<Rule[]> {
            const query = search ? { name: { $regex: getContainsRegex(search), $options: 'i' } } : {};
            const rules = await collection.find(query).skip((page - 1) * pageSize).limit(pageSize).toArray();
            return rules.map(toDto);
        },
        async create(rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>): Promise<Rule> {
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
                targetId,
                eventTypeId,
                filters,
                skipOnConsecutivesMatches,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            try {
                const { insertedId } = await collection.insertOne(ruleToCreate);
                return {
                    ...ruleToCreate,
                    id: insertedId
                };
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
        async getById(id: ObjectId): Promise<Rule> {
            const rule = await collection.findOne({ _id: id });
            return toDto(rule);
        },
        async deleteById(id: ObjectId): Promise<void> {
            await collection.deleteOne({ _id: id });
        },
        async getByEventTypeId(eventTypeId: ObjectId): Promise<Rule[]> {
            const rules = await collection.find({ eventTypeId }).toArray();
            return rules.map(toDto);
        }
    };
}
