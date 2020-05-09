export type RuleExecution = {
    id?: string;
    eventTypeId: string;
    eventTypeName: string;
    eventId?: string;
    requestId: string;
    ruleId: string;
    ruleName: string;
    match: boolean;
    skip: boolean;
    targetId?: string;
    targetName?: string;
    targetSuccess?: boolean;
    targetStatusCode?: number;
    targetError?: string;
    executedAt: Date;
}
