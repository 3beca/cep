import { ObjectId, Db } from 'mongodb';
import ConflictError from '../errors/conflict-error';
import Filter from '../filters/filter';
import InvalidOperationError from '../errors/invalid-operation-error';
import { toDto } from '../utils/dto';
import escapeStringRegexp from 'escape-string-regexp';
import { EventTypesService } from './event-types-service';
import { TargetsService } from './targets-service';
import { Rule, RuleTypes, SlidingRule, TumblingRule } from '../models/rule';
import { assertIsValid } from '../windowing/group';
import { Scheduler } from '../scheduler';

export type RulesService = {
    list(page: number, pageSize: number, search: string): Promise<Rule[]>;
    create(rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>): Promise<Rule>;
    getById(id: ObjectId): Promise<Rule>;
    deleteById(id: ObjectId): Promise<void>;
    getByEventTypeId(eventTypeId: ObjectId, types: RuleTypes[]): Promise<Rule[]>;
}

function isSlidingRule(rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>): rule is SlidingRule {
    return rule.type === 'sliding';
}

function isTumblingRule(rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>): rule is TumblingRule {
    return rule.type === 'tumbling';
}

export function buildRulesService(db: Db,
    targetsService: TargetsService,
    eventTypesService: EventTypesService,
    scheduler: Scheduler): RulesService {

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

    function scheduleRuleExecution(rule: TumblingRule): Promise<ObjectId> {
        const { id: ruleId, windowSize } = rule;
        const interval = `${windowSize.value} ${windowSize.unit}${windowSize.value > 1 ? 's' : ''}`;
        return scheduler.scheduleJob(interval, 'execute-rule', { ruleId });
    }

    function unScheduleRuleExecution(rule: TumblingRule): Promise<void> {
        return scheduler.cancelJob(rule.jobId);
    }

    return {
        async list(page: number, pageSize: number, search: string): Promise<Rule[]> {
            const query = search ? { name: { $regex: getContainsRegex(search), $options: 'i' } } : {};
            const rules = await collection.find(query).skip((page - 1) * pageSize).limit(pageSize).toArray();
            return rules.map(toDto);
        },
        async create(rule: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>): Promise<Rule> {
            const { filters, name, eventTypeId, targetId } = rule;

            if (isSlidingRule(rule) || isTumblingRule(rule)) {
                assertIsValid(rule.group);
            }
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
                ...rule,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            let insertedId;
            try {
                const opResult = await collection.insertOne(ruleToCreate);
                insertedId = opResult.insertedId;
            } catch (error) {
                if (error.name === 'MongoError' && error.code === 11000) {
                    const existingRule = await collection.findOne({ name });
                    if (existingRule) {
                        throw new ConflictError(`Rule name must be unique and is already taken by rule with id ${existingRule._id}`, existingRule._id, 'rules');
                    }
                }
                throw error;
            }
            const createdRule = {
                ...ruleToCreate,
                id: insertedId
            };
            if (isTumblingRule(createdRule)) {
                let jobId;
                try {
                    jobId = await scheduleRuleExecution(createdRule);
                } catch (error) {
                    await collection.deleteOne({ _id: insertedId });
                    throw error;
                }
                await collection.updateOne({ _id: insertedId }, { $set: { jobId } });
                createdRule.jobId = jobId;
            }
            return createdRule as Rule;
        },
        async getById(id: ObjectId): Promise<Rule> {
            const rule = await collection.findOne({ _id: id });
            return toDto(rule);
        },
        async deleteById(id: ObjectId): Promise<void> {
            const rule = await this.getById(id);
            if (rule && isTumblingRule(rule)) {
                await unScheduleRuleExecution(rule);
            }
            await collection.deleteOne({ _id: id });
        },
        async getByEventTypeId(eventTypeId: ObjectId, types: RuleTypes[]): Promise<Rule[]> {
            const rules = await collection.find({ eventTypeId, type: { $in: types } }).toArray();
            return rules.map(toDto);
        }
    };
}
