import { ObjectId } from 'bson';
import ConflictError from '../errors/conflict-error';
import eventTypesService from './event-types-service';
import targetsService from './targets-service';
import Filter from '../filters/filter';

let rules = [];

const rulesService = {
    async list(page, pageSize) {
        return rules.slice((page - 1) * pageSize, page * pageSize);
    },
    async create(rule) {
        const { filters, name } = rule;

        Filter.assertIsValid(filters);

        const existingRule = rules.find(e => e.name === name);
        if (existingRule) {
            throw new ConflictError(`Rule name must be unique and is already taken by rule with id ${existingRule.id}`, existingRule.id);
        }
        const ruleToCreate = {
            ...rule,
            id: new ObjectId(),
            createdAt: new Date(),
            updatedAt: new Date()
        };
        rules.push(ruleToCreate);
        return ruleToCreate;
    },
    async getById(id) {
        return rules.find(e => e.id.toString() === id);
    },
    async deleteById(id) {
        rules = rules.filter(e => e.id.toString() !== id);
    },
    async purge() {
        await eventTypesService.purge();
        await targetsService.purge();
        rules = [];
    }
};
export default rulesService;
