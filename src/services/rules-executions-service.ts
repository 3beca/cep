import { toDto } from '../utils/dto';
import { ObjectId, Db } from 'mongodb';
import { RuleExecution } from '../models/rules-executions';

export type RulesExecutionsService = {
    list(page: number, pageSize: number, eventTypeId?: string, ruleId?: string): Promise<RuleExecution[]>;
    createMany(rulesExecutions: RuleExecution[]): Promise<void>
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
