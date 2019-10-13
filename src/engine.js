import eventTypesService from './services/event-types-service';
import NotFoundError from './errors/not-found-error';
import rulesService from './services/rules-services';
import Filter from './filters/filter';
import targetsService from './services/targets-service';
import request from 'request-promise-native';

const engine = {
    async processEvent(id, eventPayload) {
        const eventType = await eventTypesService.getById(id);
        if (!eventType) {
            throw new NotFoundError();
        }

        const rules = await rulesService.getByEventTypeId(eventType.id);
        const matchesTargetIds = rules.filter(r => new Filter(r.filters).match(eventPayload)).map(r => r.targetId);
        if (matchesTargetIds.length === 0) {
            return;
        }
        const targets = await targetsService.getByRuleIds(matchesTargetIds);
        await Promise.all(targets.map(t => request.post(t.url, {
            json: true,
            body: eventPayload
        })));
    }
};
export default engine;
