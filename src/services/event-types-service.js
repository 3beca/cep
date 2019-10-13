import { ObjectId } from 'bson';
import ConflictError from '../errors/conflict-error';

let eventTypes = [];
const beforeDeleting = [];

const eventTypesService = {
    async list(page, pageSize) {
        return eventTypes.slice((page - 1) * pageSize, page * pageSize);
    },
    async create(eventType) {
        const existingEventType = eventTypes.find(e => e.name === eventType.name);
        if (existingEventType) {
            throw new ConflictError(`Event type name must be unique and is already taken by event type with id ${existingEventType.id}`, existingEventType.id);
        }
        const eventTypeToCreate = {
            ...eventType,
            id: new ObjectId(),
            createdAt: new Date(),
            updatedAt: new Date()
        };
        eventTypes.push(eventTypeToCreate);
        return eventTypeToCreate;
    },
    async getById(id) {
        return eventTypes.find(e => e.id.toString() === id);
    },
    async deleteById(id) {
        for (const beforeDelete of beforeDeleting) {
            await beforeDelete(id);
        }
        eventTypes = eventTypes.filter(e => e.id.toString() !== id);
    },
    async purge() {
        eventTypes = [];
    },
    registerOnBeforeDeleting(beforeDelete) {
        beforeDeleting.push(beforeDelete);
    }
};
export default eventTypesService;
