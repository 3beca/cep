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
import { SchedulerService } from './scheduler-service';
import { Job } from '../models/job';
import { AppOptions } from '../app';

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
    internalHttp: AppOptions['internalHttp'],
    targetsService: TargetsService,
    eventTypesService: EventTypesService,
    schedulerService: SchedulerService): RulesService {

    const { protocol, host, port } = internalHttp;
    const internalHttpBaseUrl = `${protocol}://${host}:${port}`;
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

    async function scheduleRuleExecution(rule: TumblingRule): Promise<Job> {
        const { id, windowSize } = rule;
        const job = await schedulerService.create({
            type: 'every',
            interval: `${windowSize.value} ${windowSize.unit}${windowSize.value > 1 ? 's' : ''}`,
            target: {
                method: 'POST',
                url: `${internalHttpBaseUrl}/execute-rule/${id}`
            }
        });
        return job as Job;
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
            try {
                const { insertedId } = await collection.insertOne(ruleToCreate);
                const createdRule = {
                    ...ruleToCreate,
                    id: insertedId
                };
                if (isTumblingRule(createdRule)) {
                    await scheduleRuleExecution(createdRule);
                }
                return createdRule as Rule;
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
        async getByEventTypeId(eventTypeId: ObjectId, types: RuleTypes[]): Promise<Rule[]> {
            const rules = await collection.find({ eventTypeId, type: { $in: types } }).toArray();
            return rules.map(toDto);
        }
    };
}
