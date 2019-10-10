import { ObjectId } from 'bson';
import ConflictError from '../errors/conflict-error';

let targets = [];

const targetsService = {
    async list(page, pageSize) {
        return targets.slice((page - 1) * pageSize, page * pageSize);
    },
    async create(target) {
        const existingTarget = targets.find(e => e.name === target.name);
        if (existingTarget) {
            throw new ConflictError(`Target name must be unique and is already taken by target with id ${existingTarget.id}`, existingTarget.id);
        }
        const targetToCreate = {
            ...target,
            id: new ObjectId(),
            createdAt: new Date(),
            updatedAt: new Date()
        };
        targets.push(targetToCreate);
        return targetToCreate;
    },
    async getById(id) {
        return targets.find(e => e.id.toString() === id);
    },
    async deleteById(id) {
        targets = targets.filter(e => e.id.toString() !== id);
    },
    async purge() {
        targets = [];
    }
};
export default targetsService;
