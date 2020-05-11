import { ObjectId } from 'mongodb';

export type RuleExecution = {
    id: ObjectId;
    eventTypeId: ObjectId;
    eventTypeName: string;
    eventId?: ObjectId;
    requestId: string;
    ruleId: ObjectId;
    ruleName: string;
    match: boolean;
    skip: boolean;
    targetId?: ObjectId;
    targetName?: string;
    targetSuccess?: boolean;
    targetStatusCode?: number;
    targetError?: string;
    executedAt: Date;
}
