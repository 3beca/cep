import NotFoundError from './errors/not-found-error';
import Filter from './filters/filter';
import fetch from 'node-fetch';
import { RulesExecutionsService } from './services/rules-executions-service';

export function buildEngine(
    eventTypesService,
    rulesService,
    targetsService,
    eventsService,
    rulesExecutionsService: RulesExecutionsService) {
    return {
        async processEvent(id, eventPayload, requestId) {
            const eventType = await eventTypesService.getById(id);
            if (!eventType) {
                throw new NotFoundError(`Event type ${id} cannot found`);
            }

            const executedAt = new Date();
            const rules = await rulesService.getByEventTypeId(eventType.id);
            const skipOnConsecutivesMatches = rules.some(r => r.skipOnConsecutivesMatches);
            const rulesMatchResults = rules.map(r => ({
                rule: r,
                match: new Filter(r.filters).match(eventPayload)
            }));
            const matchesRules = rulesMatchResults.filter(r => r.match).map(r => r.rule);
            const rulesMustBeSkipped: any[] = [];
            if (skipOnConsecutivesMatches) {
                const lastEvent = await eventsService.getLastEvent(eventType.id);
                const lastEventMatchesRulesIds = ((lastEvent || {}).rules || []).map(r => r.id);

                rulesMustBeSkipped.push.apply(
                    rulesMustBeSkipped,
                    matchesRules
                        .filter(r => r.skipOnConsecutivesMatches)
                        .filter(r => lastEventMatchesRulesIds.includes(r.id))
                        .map(r => r.id));
            }
            const finalMatchesRules = matchesRules.filter(r => !rulesMustBeSkipped.includes(r.id));
            if (finalMatchesRules.length === 0) {
                const { id: eventId } = await eventsService.create(eventType, eventPayload, requestId, matchesRules);
                if (rulesMatchResults.length > 0) {
                    await rulesExecutionsService.createMany(rulesMatchResults.map(r => ({
                        executedAt,
                        requestId,
                        eventId,
                        eventTypeId: eventType.id,
                        eventTypeName: eventType.name,
                        ruleId: r.rule.id,
                        ruleName: r.rule.name,
                        match: r.match,
                        skip: rulesMustBeSkipped.includes(r.rule.id)
                    })));
                }
                return;
            }
            const targetIds = finalMatchesRules.map(r => r.targetId);
            const targets = await targetsService.getByIds(targetIds);
            const ruleTargetResult = {};
            const targetsResponse = await Promise.all(finalMatchesRules.map(async rule => {
                const target = targets.find(t => t.id === rule.targetId);
                const response = await fetch(target.url, {
                    method: 'POST',
                    body: JSON.stringify(eventPayload),
                    headers: {
                        'Content-Type': 'application/json',
                        'request-id': requestId,
                        'X-Rule-Id': rule.id,
                        'X-Rule-Name': rule.name,
                        'X-Target-Id': target.id,
                        'X-Target-Name': target.name
                    }
                });
                ruleTargetResult[rule.id] = {
                    ok: response.ok,
                    statusCode: response.status,
                };
                return {
                    statusCode: response.status,
                    body: response.headers.get('Content-Type')?.includes('application/json') ? await response.json() : undefined
                };
            }));
            const { id: eventId } = await eventsService.create(eventType, eventPayload, requestId, matchesRules, targets, targetsResponse);
            await rulesExecutionsService.createMany(rulesMatchResults.map(r => ({
                executedAt,
                requestId,
                eventId,
                eventTypeId: eventType.id,
                eventTypeName: eventType.name,
                ruleId: r.rule.id,
                ruleName: r.rule.name,
                match: r.match,
                skip: rulesMustBeSkipped.includes(r.rule.id),
                ... (
                    ruleTargetResult[r.rule.id] ? {
                        targetId: r.rule.targetId,
                        targetName: r.rule.targetName,
                        targetSuccess: ruleTargetResult[r.rule.id].ok,
                        targetStatusCode: ruleTargetResult[r.rule.id].statusCode,
                    } : {}
                )
            })));
        }
    };
}
