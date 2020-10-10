import { toDto } from '../utils/dto';
import { ObjectId, Db } from 'mongodb';
import { RuleExecution } from '../models/rule-execution';

export type RulesExecutionsService = {
    list(page: number, pageSize: number, eventTypeId?: ObjectId, ruleId?: ObjectId): Promise<RuleExecution[]>;
    createMany(rulesExecutions: Omit<RuleExecution, 'id'>[]): Promise<void>;
    getLastRuleExecution(ruleId: ObjectId): Promise<RuleExecution>;
}

export function buildRulesExecutionsService(db: Db): RulesExecutionsService {

    const collection = db.collection('rules-executions');

    return {
        async list(page: number, pageSize: number, eventTypeId?: ObjectId, ruleId?: ObjectId): Promise<RuleExecution[]> {
            const query = {
                ...(eventTypeId ? { eventTypeId } : {}),
                ...(ruleId ? { ruleId } : {})
            };
            const rulesExecutions = await collection.find(query).skip((page - 1) * pageSize).sort({ executedAt: -1 }).limit(pageSize).toArray();
            return rulesExecutions.map(toDto);
        },
        async getLastRuleExecution(ruleId: ObjectId): Promise<RuleExecution> {
            const results = await collection.find({ ruleId }).sort({ executedAt: -1 }).limit(1).toArray();
            return toDto(results[0]);
        },
        async createMany(rulesExecutions: Omit<RuleExecution, 'id'>[]): Promise<void> {
            await collection.insertMany(rulesExecutions);
        }
    };
}
