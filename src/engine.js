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
                await storeEvent(eventType, eventPayload, requestId);
                return;
            }
            const targets = await targetsService.getByIds(matchesTargetIds);
            const targetsResponse = await Promise.all(targets.map(t => request.post(t.url, {
                json: true,
                body: eventPayload,
                headers: {
                    'request-id': requestId
                },
                resolveWithFullResponse: true
            }).catch(error => error)));
            await storeEvent(eventType, eventPayload, requestId, matchesRules, targets, targetsResponse);
        }
    };

    function storeEvent(eventType, payload, requestId, rules = [], targets = [], targetsResponse = []) {
        return eventsService.create({
            payload,
            requestId,
            eventTypeId: eventType.id,
            eventTypeName: eventType.name,
            rules: rules.map(r => ({ id: r.id, name: r.name, targetId: r.targetId })),
            targets: targets.map((t, index) => {
                const { statusCode, body } = targetsResponse[index];
                return { id: t.id, name: t.name, response: { statusCode, body } };
            })
        });
    }
}
