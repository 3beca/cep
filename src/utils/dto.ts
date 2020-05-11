import { ObjectId } from 'mongodb';

export function toDto(item: { _id: ObjectId } & any): { id: ObjectId } & any {
    if (!item) {
        return item;
    }
    const { _id, ...rest } = item;
    return { ...rest, id: _id };
}

export function toSafeObjectId(value: string | undefined): ObjectId | undefined {
    if (value === undefined) {
        return value;
    }
    return ObjectId.createFromHexString(value);
}
