import { ObjectId } from 'bson';

let events = [];

const eventService = {
    async list(page, pageSize) {
        return events.slice((page - 1) * pageSize, page * pageSize);
    },
    async create(event) {
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
