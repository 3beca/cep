import { ObjectId } from 'mongodb';

export type EventType = {
    id: ObjectId;
    name: string;
    createdAt: Date;
    updatedAt: Date;
}
