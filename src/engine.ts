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
import { Rule, SlidingRule, TumblingRule } from './models/rule';
import { Target } from './models/target';
import InvalidOperationError from './errors/invalid-operation-error';
import { EventType } from './models/event-type';
import { TemplateEngine } from './template-engine';

export type Engine = {
    processEvent(eventTypeId: ObjectId, eventPayload: any, requestId: string): Promise<void>;
    executeRule(ruleId: ObjectId, requestId: string): Promise<void>;
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
    rulesExecutionsService: RulesExecutionsService,
    templateEngine: TemplateEngine): Engine {

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
        const targets = await targetsService.getByIds(targetIds);
        return targets.reduce((previous, current) => {
            previous[current.id.toHexString()] = current;
            return previous;
        }, {});
    }

    async function getRulesMatchResults(rules: Rule[], event: Event) {
        const matchResults: MatchResult[] = [];
        for (const rule of rules) {
            switch (rule.type) {
                case 'sliding': {
                    matchResults.push(await matchWindowingRule(rule));
                    break;
                }
                case 'realtime':
                default: {
                    matchResults.push(await matchRealtimeRule(rule, event));
                    break;
                }
            }
        }
        return matchResults;
    }

    async function matchWindowingRule(rule: SlidingRule | TumblingRule): Promise<MatchResult> {
        const result = await eventsService.aggregate(rule.eventTypeId, rule.windowSize, rule.group);
        return {
            rule,
            match: new Filter(rule.filters).match(result),
            skip: false,
            payload: result
        };
    }

    function matchRealtimeRule(rule: Rule, event: Event): Promise<MatchResult> {
        return Promise.resolve({
            rule,
            match: new Filter(rule.filters).match(event.payload),
            skip: false,
            payload: event.payload
        });
    }

    async function executeRuleMatchResults(matchResults: MatchResult[], eventType: EventType, requestId: string, event?: Event): Promise<void> {
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
                const { rule, payload } = matchResult;
                const target = targets[rule.targetId.toHexString()];
                const { url, headers, body: bodyTemplate } = target;
                const body = bodyTemplate ? await templateEngine.render(bodyTemplate, {
                    eventType: {
                        id: eventType.id.toHexString(),
                        name: eventType.name
                    },
                    rule: {
                        id: rule.id.toHexString(),
                        name: rule.name
                    },
                    event: payload
                }) : payload;
                const response = await fetch(url, {
                    method: 'POST',
                    body: JSON.stringify(body),
                    headers: {
                        ...(headers ?? {}),
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
            eventId: event ? event.id : undefined,
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

    return {
        async processEvent(eventTypeId: ObjectId, eventPayload, requestId: string): Promise<void> {
            const eventType = await eventTypesService.getById(eventTypeId);
            if (!eventType) {
                throw new NotFoundError(`Event type ${eventTypeId} cannot found`);
            }
            const event = await createEvent(eventType, eventPayload, requestId);
            const rules = await rulesService.getByEventTypeId(eventTypeId, ['realtime', 'sliding']);
            const matchResults = await getRulesMatchResults(rules, event);
            await executeRuleMatchResults(matchResults, eventType, requestId, event);
        },
        async executeRule(ruleId: ObjectId, requestId: string): Promise<void> {
            const rule = await rulesService.getById(ruleId);
            if (!rule) {
                throw new NotFoundError(`Rule ${ruleId} cannot be found`);
            }
            if (rule.type !== 'tumbling') {
                throw new InvalidOperationError(`Cannot execute rule of type '${rule.type}'. Only rule of type tumbling are supported.`);
            }
            const eventType = await eventTypesService.getById(rule.eventTypeId);
            const matchResult = await matchWindowingRule(rule);
            await executeRuleMatchResults([matchResult], eventType, requestId);
        }
    };
}
