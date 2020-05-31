import NotFoundError from './errors/not-found-error';
import Filter from './filters/filter';
import fetch from 'node-fetch';
import { RulesExecutionsService } from './services/rules-executions-service';
import { EventsService } from './services/events-service';
import { Event } from './models/event';
import { ObjectId } from 'mongodb';
import { EventTypesService } from './services/event-types-service';
import { TargetsService } from './services/targets-service';
import { RulesService } from './services/rules-services';
import { Rule, SlidingRule } from './models/rule';
import { Target } from './models/target';

export type Engine = {
    processEvent(eventTypeId: ObjectId, eventPayload: any, requestId: string): Promise<void>;
}

type MatchResult = {
    rule: Rule,
    match: boolean,
    skip: boolean,
    targetId?: ObjectId,
    targetName?: string,
    targetSuccess?: boolean,
    targetStatusCode?: number;
    payload: any;
}

export function buildEngine(
    eventTypesService: EventTypesService,
    rulesService: RulesService,
    targetsService: TargetsService,
    eventsService: EventsService,
    rulesExecutionsService: RulesExecutionsService): Engine {

    function createEvent(eventType, payload, requestId: string): Promise<Event> {
        const event = {
            eventTypeId: eventType.id,
            eventTypeName: eventType.name,
            payload,
            requestId,
            createdAt: new Date()
        };
        return eventsService.create(event);
    }

    async function getTargetsDictionary(targetIds: ObjectId[]): Promise<{ [key: string]: Target }> {
        if (targetIds.length === 0) {
            return {};
        }
        const targets = await targetsService.getByIds(targetIds);
        return targets.reduce((previous, current) => {
            previous[current.id.toHexString()] = current;
            return previous;
        }, {});
    }

    async function getSlidingRuleMatchResult(rule: SlidingRule): Promise<MatchResult> {
        const result = await eventsService.aggregate(rule.eventTypeId, rule.windowSize, rule.group);
        return {
            rule,
            match: new Filter(rule.filters).match(result),
            skip: false,
            payload: result
        };
    }

    return {
        async processEvent(eventTypeId: ObjectId, eventPayload, requestId: string): Promise<void> {
            const eventType = await eventTypesService.getById(eventTypeId);
            if (!eventType) {
                throw new NotFoundError(`Event type ${eventTypeId} cannot found`);
            }

            const { id: eventId } = await createEvent(eventType, eventPayload, requestId);

            const rules = await rulesService.getByEventTypeId(eventTypeId, ['realtime', 'sliding']);
            const matchResults: MatchResult[] = [];
            for (const rule of rules) {
                if (rule.type === 'sliding') {
                    matchResults.push(await getSlidingRuleMatchResult(rule));
                } else {
                    matchResults.push({
                        rule,
                        match: new Filter(rule.filters).match(eventPayload),
                        skip: false,
                        payload: eventPayload
                    });
                }
            }
            for (const matchResult of matchResults.filter(r => r.match)) {
                const { rule } = matchResult;
                if (rule.skipOnConsecutivesMatches) {
                    const lastRuleExecution = await rulesExecutionsService.getLastRuleExecution(rule.id);
                    matchResult.skip = lastRuleExecution && lastRuleExecution.match;
                }
            }
            const rulesThatMustInvokeTargets = matchResults.filter(r => r.match && !r.skip);
            if (rulesThatMustInvokeTargets.length > 0) {
                const targetIds = rulesThatMustInvokeTargets.map(r => r.rule.targetId);
                const targets = await getTargetsDictionary(targetIds);
                await Promise.all(rulesThatMustInvokeTargets.map(async matchResult => {
                    const { rule } = matchResult;
                    const target = targets[rule.targetId.toHexString()];
                    const response = await fetch(target.url, {
                        method: 'POST',
                        body: JSON.stringify(matchResult.payload),
                        headers: {
                            'Content-Type': 'application/json',
                            'request-id': requestId,
                            'X-Rule-Id': rule.id.toHexString(),
                            'X-Rule-Name': rule.name,
                            'X-Target-Id': target.id.toHexString(),
                            'X-Target-Name': target.name
                        }
                    });
                    matchResult.targetId = target.id;
                    matchResult.targetName = target.name;
                    matchResult.targetSuccess = response.ok;
                    matchResult.targetStatusCode = response.status;
                }));
            }
            if (matchResults.length === 0) {
                return;
            }
            const executedAt = new Date();
            await rulesExecutionsService.createMany(matchResults.map(r => ({
                executedAt,
                requestId,
                eventId,
                eventTypeId: eventType.id,
                eventTypeName: eventType.name,
                ruleId: r.rule.id,
                ruleName: r.rule.name,
                match: r.match,
                skip: !!r.skip,
                targetId: r.targetId,
                targetName: r.targetName,
                targetSuccess: r.targetSuccess,
                targetStatusCode: r.targetStatusCode
            })));
        }
    };
}
