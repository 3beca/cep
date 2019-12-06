import { ObjectId } from 'mongodb';

export function toDto(item) {
    if (!item) {
        return item;
    }
    const { _id, ...rest } = item;
    convertObjectIdToString(rest);
    return { ...rest, id: _id.toString() };
}

function convertObjectIdToString(obj) {
    for (const key of Object.keys(obj)) {
        if (obj[key] instanceof ObjectId) {
            obj[key] = obj[key].toString();
        } else if (Array.isArray(obj[key])) {
            obj[key].forEach(o => convertObjectIdToString(o));
        } else if (typeof obj[key] === 'object') {
            convertObjectIdToString(obj[key]);
        }
    }
}
