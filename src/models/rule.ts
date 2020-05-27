import { ObjectId } from 'mongodb';

export type Rule = {
    id: ObjectId;
    name: string;
    type: 'realTime';
    eventTypeId: ObjectId;
    targetId: ObjectId;
    filters: any;
    skipOnConsecutivesMatches: boolean;
    createdAt: Date;
    updatedAt: Date;
}
