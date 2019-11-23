import { ObjectId } from 'mongodb';
import { toDto } from '../utils/dto';

export function buildEventsService(db) {

    const collection = db.collection('events');

    return {
        async list() {
            const events = await collection.find({}).toArray();
            return events.map(toDto);
        }
    };
}
