import { ObjectId } from 'mongodb';
import ConflictError from '../errors/conflict-error';
import Filter from '../filters/filter';
import InvalidOperationError from '../errors/invalid-operation-error';

export function buildRulesService(targetsService, eventTypesService) {

    let rules = [];

    targetsService.registerOnBeforeDelete(id => {
        const results = rules.filter(r => r.targetId.toString() === id);
        if (results.length > 0) {
            throw new InvalidOperationError(`Target cannot be deleted as in use by rules [${results.map(r => `"${r.id}"`).join(', ')}]`);
        }
    });

    eventTypesService.registerOnBeforeDelete(id => {
        const results = rules.filter(r => r.eventTypeId.toString() === id);
        if (results.length > 0) {
            throw new InvalidOperationError(`Event type cannot be deleted as in use by rules [${results.map(r => `"${r.id}"`).join(', ')}]`);
        }
    });

    return {
        async list(page, pageSize) {
            return rules.slice((page - 1) * pageSize, page * pageSize);
        },
        async create(rule) {
            const { filters, name, eventTypeId, targetId } = rule;

            Filter.assertIsValid(filters);

            const eventType = await eventTypesService.getById(eventTypeId);
            if (!eventType) {
                throw new InvalidOperationError(`event type with identifier ${eventTypeId} does not exists`);
            }
            const target = await targetsService.getById(targetId);
            if (!target) {
                throw new InvalidOperationError(`target with identifier ${targetId} does not exists`);
            }
            const existingRule = rules.find(r => r.name === name);
            if (existingRule) {
                throw new ConflictError(`Rule name must be unique and is already taken by rule with id ${existingRule.id}`, existingRule.id);
            }
            const ruleToCreate = {
                name,
                targetId: new ObjectId(targetId),
                eventTypeId: new ObjectId(eventTypeId),
                filters,
                id: new ObjectId(),
                createdAt: new Date(),
                updatedAt: new Date()
            };
            rules.push(ruleToCreate);
            return ruleToCreate;
        },
        async getById(id) {
            return rules.find(r => r.id.toString() === id);
        },
        async deleteById(id) {
            rules = rules.filter(r => r.id.toString() !== id);
        },
        async getByEventTypeId(eventTypeId) {
            return rules.filter(r => r.eventTypeId.toString() === eventTypeId.toString());
        },
        async purge() {
            await eventTypesService.purge();
            await targetsService.purge();
            rules = [];
        }
    };
}
