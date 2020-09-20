import { ObjectId } from 'mongodb';
import ConflictError from './conflict-error';

function capitalize(value: string): string {
    return value[0].toUpperCase() + value.substring(1);
}

export async function handleConflictError(error, getConflictItem: () => Promise<{ _id: ObjectId } | null>, itemOptions: {
    itemName: string;
    resources: string;
}): Promise<object> {
    if (error.name === 'MongoError' && error.code === 11000) {
        const existingItem = await getConflictItem();
        if (existingItem) {
            const { itemName, resources } = itemOptions;
            return new ConflictError(`${capitalize(itemName)} name must be unique and is already taken by ${itemName} with id ${existingItem._id}`, existingItem._id.toHexString(), resources);
        }
    }
    return error;
}
