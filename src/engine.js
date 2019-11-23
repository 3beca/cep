import NotFoundError from './errors/not-found-error';
import Filter from './filters/filter';
import request from 'request-promise-native';

export function buildEngine(
    eventTypesService,
    rulesService,
    targetsService,
    eventsService) {
    return {
        async processEvent(id, eventPayload, requestId) {
            const eventType = await eventTypesService.getById(id);
            if (!eventType) {
                throw new NotFoundError();
            }

            const rules = await rulesService.getByEventTypeId(eventType.id);
            const matchesRules = rules.filter(r => new Filter(r.filters).match(eventPayload));
            const matchesTargetIds = matchesRules.map(r => r.targetId);
            if (matchesTargetIds.length === 0) {
                await eventsService.create({
                    payload: eventPayload,
                    requestId: requestId,
                    eventTypeId: eventType.id,
                    eventTypeName: eventType.name
                });
                return;
            }
            const targets = await targetsService.getByIds(matchesTargetIds);
            await Promise.all(targets.map(t => request.post(t.url, {
                json: true,
                body: eventPayload,
                headers: {
                    'request-id': requestId
                }
            })));
        }
    };
}
