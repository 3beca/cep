import { ObjectId } from 'mongodb';

export type Event = {
    id: ObjectId;
    eventTypeId: ObjectId;
    eventTypeName: string;
    requestId: string;
    payload: any;
    createdAt: Date;
}
