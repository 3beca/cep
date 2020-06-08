import { ObjectId } from 'mongodb';

export type Job = {
    id: ObjectId;
    type: 'every';
    interval: string;
    target: {
        method: 'POST';
        url: string;
    };
};
