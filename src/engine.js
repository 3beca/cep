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
            const rulesMustBeSkipped = [];
            if (matchesRules.some(r => r.skipOnConsecutivesMatches)) {
                const lastEvent = await eventsService.getLastEvent(eventType.id);
                const lastEventMatchesRulesIds = ((lastEvent || {}).rules || []).map(r => r.id);

                rulesMustBeSkipped.push.apply(
                    rulesMustBeSkipped,
                    matchesRules
                        .filter(r => r.skipOnConsecutivesMatches)
                        .filter(r => lastEventMatchesRulesIds.includes(r.id)));
            }
            const finalMatchesRules = matchesRules.filter(r => !rulesMustBeSkipped.includes(r));
            if (finalMatchesRules.length === 0) {
                await eventsService.create(eventType, eventPayload, requestId, matchesRules);
                return;
            }
            const targetIds = finalMatchesRules.map(r => r.targetId);
            const targets = await targetsService.getByIds(targetIds);
            const targetsResponse = await Promise.all(finalMatchesRules.map(r => {
                const target = targets.find(t => t.id === r.targetId);
                return request.post(target.url, {
                    json: true,
                    body: eventPayload,
                    headers: {
                        'request-id': requestId
                    },
                    resolveWithFullResponse: true
                }).catch(error => error);
            }));
            await eventsService.create(eventType, eventPayload, requestId, matchesRules, targets, targetsResponse);
        }
    };
}
