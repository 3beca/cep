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
import InvalidOperationError from './errors/invalid-operation-error';
import { EventType } from './models/event-type';
import { TemplateEngine } from './template-engine';
import { RuleExecution } from './models/rule-execution';

export type Engine = {
    processEvent(eventTypeId: ObjectId, eventPayload: any, requestId: string): Promise<void>;
    executeTumblingRule(ruleId: ObjectId, requestId: string): Promise<void>;
}

type MatchResult = {
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

    function storeEvent(eventType, payload, requestId: string): Promise<Event> {
        const event = {
            eventTypeId: eventType.id,
            eventTypeName: eventType.name,
            payload,
            requestId,
            createdAt: new Date()
        };
        return eventsService.create(event);
    }

    function getRuleMatchResult(rule: Rule, event: Event): Promise<MatchResult> {
        switch (rule.type) {
            case 'sliding':
            case 'tumbling':
                return matchWindowingRule(rule);
            case 'realtime':
            default:
                return matchRealtimeRule(rule, event);
        }
    }

    async function matchWindowingRule(rule: SlidingRule | TumblingRule): Promise<MatchResult> {
        const result = await eventsService.aggregate(rule.eventTypeId, rule.windowSize, rule.group);
        return {
            match: new Filter(rule.filters).match(result),
            skip: false,
            payload: result
        };
    }

    function matchRealtimeRule(rule: Rule, event: Event): Promise<MatchResult> {
        return Promise.resolve({
            match: new Filter(rule.filters).match(event.payload),
            skip: false,
            payload: event.payload
        });
    }

    async function executeRule(rule: Rule, eventType: EventType, requestId: string, event?: Event) : Promise<Omit<RuleExecution, 'id'>> {
        let matchResult = await getRuleMatchResult(rule, event as Event);
        if (rule.skipOnConsecutivesMatches) {
            const lastRuleExecution = await rulesExecutionsService.getLastRuleExecution(rule.id);
            matchResult = { ...matchResult, skip: lastRuleExecution?.match };
        }
        if (matchResult.match && !matchResult.skip) {
            const target = await targetsService.getById(rule.targetId);
            const { payload } = matchResult;
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
            matchResult = {
                ...matchResult,
                targetId: target.id,
                targetName: target.name,
                targetSuccess: response.ok,
                targetStatusCode: response.status
            };
        }
        const { match, skip, targetId, targetName, targetSuccess, targetStatusCode } = matchResult;
        return {
            executedAt: new Date(),
            requestId,
            eventId: event ? event.id : undefined,
            eventTypeId: eventType.id,
            eventTypeName: eventType.name,
            ruleId: rule.id,
            ruleName: rule.name,
            match,
            skip: !!skip,
            targetId,
            targetName,
            targetSuccess,
            targetStatusCode
        };
    }

    function storeRuleExecution(ruleExecution: Omit<RuleExecution, 'id'>): Promise<void> {
        return rulesExecutionsService.createMany([ruleExecution]);
    }

    function storeRuleExecutions(ruleExecutions: Omit<RuleExecution, 'id'>[]): Promise<void> {
        if (ruleExecutions.length === 0) {
            return Promise.resolve();
        }
        return rulesExecutionsService.createMany(ruleExecutions);
    }

    function getEventTypeRealTimeAndSlidingRules(eventTypeId: ObjectId): Promise<Rule[]> {
        return rulesService.getByEventTypeId(eventTypeId, ['realtime', 'sliding']);
    }

    function getEventType(eventTypeId: ObjectId): Promise<EventType> {
        return eventTypesService.getById(eventTypeId);
    }

    function getRule(ruleId: ObjectId): Promise<Rule> {
        return rulesService.getById(ruleId);
    }

    return {
        async processEvent(eventTypeId: ObjectId, eventPayload, requestId: string): Promise<void> {
            const eventType = await getEventType(eventTypeId);
            if (!eventType) {
                throw new NotFoundError(`Event type ${eventTypeId} cannot found`);
            }
            const event = await storeEvent(eventType, eventPayload, requestId);
            const rules = await getEventTypeRealTimeAndSlidingRules(eventTypeId);
            const executeRulePromises = rules.map(rule => executeRule(rule, eventType, requestId, event));
            const ruleExecutions = await Promise.all(executeRulePromises);
            await storeRuleExecutions(ruleExecutions);
        },
        async executeTumblingRule(ruleId: ObjectId, requestId: string): Promise<void> {
            const rule = await getRule(ruleId);
            if (!rule) {
                throw new NotFoundError(`Rule ${ruleId} cannot be found`);
            }
            if (rule.type !== 'tumbling') {
                throw new InvalidOperationError(`Cannot execute rule of type '${rule.type}'. Only rule of type tumbling are supported.`);
            }
            const eventType = await getEventType(rule.eventTypeId);
            const ruleExecution = await executeRule(rule, eventType, requestId);
            await storeRuleExecution(ruleExecution);
        }
    };
}
