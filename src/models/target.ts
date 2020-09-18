import { ObjectId } from 'mongodb';

export type Target = {
    id: ObjectId;
    name: string;
    url: string;
    headers?: {
        [key: string]: string;
    };
    body?: any;
    createdAt: Date;
    updatedAt: Date;
}
