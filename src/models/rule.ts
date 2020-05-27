import { ObjectId } from 'mongodb';

export type RuleTypes = 'realTime';

export type Rule = {
    id: ObjectId;
    name: string;
    type: RuleTypes;
    eventTypeId: ObjectId;
    targetId: ObjectId;
    filters: any;
    skipOnConsecutivesMatches: boolean;
    createdAt: Date;
    updatedAt: Date;
}
