import { toDto } from '../utils/dto';
import { ObjectId, Db } from 'mongodb';
import { RuleExecution } from '../models/rule-execution';

export type RulesExecutionsService = {
    list(page: number, pageSize: number, eventTypeId?: string, ruleId?: string): Promise<RuleExecution[]>;
    createMany(rulesExecutions: RuleExecution[]): Promise<void>;
    getLastRuleExecution(ruleId: string): Promise<RuleExecution>;
}

export function buildRulesExecutionsService(db: Db): RulesExecutionsService {

    const collection = db.collection('rules-executions');

    return {
        async list(page: number, pageSize: number, eventTypeId?: string, ruleId?: string): Promise<RuleExecution[]> {
            const query = {
                ...(eventTypeId ? { eventTypeId: new ObjectId(eventTypeId) } : {}),
                ...(ruleId ? { ruleId: new ObjectId(ruleId) } : {})
            };
            const rulesExecutions = await collection.find(query).skip((page - 1) * pageSize).sort({ executedAt: -1 }).limit(pageSize).toArray();
            return rulesExecutions.map(toDto);
        },
        async getLastRuleExecution(ruleId: string): Promise<RuleExecution> {
            const results = await collection.find({ ruleId: ObjectId.createFromHexString(ruleId) }).sort({ executedAt: -1 }).limit(1).toArray();
            return toDto(results[0]);
        },
        async createMany(rulesExecutions: RuleExecution[]): Promise<void> {
            await collection.insertMany(rulesExecutions.map(r => ({
                ...r,
                eventId: r.eventId ? ObjectId.createFromHexString(r.eventId) : undefined,
                eventTypeId: ObjectId.createFromHexString(r.eventTypeId),
                ruleId: ObjectId.createFromHexString(r.ruleId),
                targetId: r.targetId ? ObjectId.createFromHexString(r.targetId) : undefined
            })));
        }
    };
}
