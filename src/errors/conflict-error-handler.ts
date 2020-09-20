import { ObjectId } from 'mongodb';
import ConflictError from './conflict-error';

export async function handleConflictError(error, getConflictItem: () => Promise<{ _id: ObjectId } | null>, itemOptions: {
    message: string;
    resources: string;
}): Promise<object> {
    if (error.name === 'MongoError' && error.code === 11000) {
        const existingItem = await getConflictItem();
        if (existingItem) {
            const { message, resources } = itemOptions;
            return new ConflictError(message.replace('[ID]', existingItem._id.toHexString()), existingItem._id.toHexString(), resources);
        }
    }
    return error;
}
