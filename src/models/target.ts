import { ObjectId } from 'mongodb';

export type Target = {
    id: ObjectId;
    name: string;
    url: string;
    createdAt: Date;
    updatedAt: Date;
}
