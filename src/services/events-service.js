import { ObjectId } from 'bson';
import ConflictError from '../errors/name-conflict-error';

let events = [];

const eventService = {
    async list(page, pageSize) {
        return events.slice((page - 1) * pageSize, page * pageSize);
    },
    async create(event) {
        const existingEvent = events.find(e => e.name === event.name);
        if (existingEvent) {
            throw new ConflictError(`Event name must be unique and is already taken by event with id ${existingEvent.id}`, existingEvent.id);
        }
        const eventToCreate = {
            ...event,
            id: new ObjectId(),
            createdAt: new Date(),
            updatedAt: new Date()
        };
        events.push(eventToCreate);
        return eventToCreate;
    },
    async getById(id) {
        return events.find(e => e.id.toString() === id);
    },
    async purge() {
        events = [];
    }
};
export default eventService;
