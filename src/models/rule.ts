import { ObjectId } from 'mongodb';

export type Rule = {
    id: ObjectId;
    name: string;
    eventTypeId: ObjectId;
    targetId: ObjectId;
    filters: any;
    skipOnConsecutivesMatches: boolean;
    createdAt: Date;
    updatedAt: Date;
}
