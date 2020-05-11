import { getNextLink, getPrevLink, getExternalUrl } from '../../utils/url';
import NotFoundError from '../../errors/not-found-error';
import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { ServerResponse } from 'http';
import { ObjectId } from 'mongodb';
import { RulesService } from '../../services/rules-services';
import { Rule } from '../../models/rule';
import { TargetsService } from '../../services/targets-service';
import { EventTypesService } from '../../services/event-types-service';
import { Target } from '../../models/target';
import { EventType } from '../../models/event-type';

const ruleschema = {
    type: 'object',
    properties: {
        name: { type: 'string' },
        id: { type: 'string' },
        targetId: { type: 'string' },
        eventTypeId: { type: 'string' },
        targetName: { type: 'string' },
        eventTypeName: { type: 'string' },
        skipOnConsecutivesMatches: { type: 'boolean' },
        filters: { type: 'object', additionalProperties: true },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' }
    }
};

const listSchema = {
    tags: ['rules'],
    querystring: {
        page: { type: 'integer', minimum: 1, default: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
        search: { type: 'string' }
    },
    response: {
        200: {
            type: 'object',
            properties: {
                results: {
                    type: 'array',
                    items: ruleschema
                },
                next: { type: 'string' },
                prev: { type: 'string' }
            }
        }
    }
};

const ruleIdParam = {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'rule identifier',
        pattern: '^[a-f0-9]{24}$'
      }
    },
    errorMessage: 'rule id must be a valid ObjectId'
};

const getSchema = {
    tags: ['rules'],
    params: ruleIdParam,
    response: {
        200: ruleschema
    }
};

const deleteSchema = {
    tags: ['rules'],
    params: ruleIdParam,
    response: {
        204: {
            type: 'object'
        }
    }
};

const createSchema = {
    tags: ['rules'],
    body: {
        type: 'object',
        required: ['name', 'eventTypeId', 'targetId'],
        properties: {
            name: { type: 'string', maxLength: 100 },
            targetId: { type: 'string' },
            eventTypeId: { type: 'string' },
            skipOnConsecutivesMatches: { type: 'boolean' },
            filters: { type: 'object' }
        }
    },
    response: {
        201: ruleschema
    }
};

export function buildRulesRoutes(
    targetsService: TargetsService,
    eventTypesService: EventTypesService,
    rulesService: RulesService) {

    function reduceToDictionary<T extends { id: ObjectId }>(dictionary: {[key:string]: T }, current: T): {[key:string]: T } {
        dictionary[current.id.toHexString()] = current;
        return dictionary;
    }

    async function getEventTypesDictionaryByIds(ids: ObjectId[]): Promise<{[key: string]: EventType }> {
        const eventTypes = await eventTypesService.getByIds(ids);
        return eventTypes.reduce(reduceToDictionary, {});
    }

    async function getTargetsDictionaryByIds(ids: ObjectId[]): Promise<{[key: string]: Target }> {
        const targets = await targetsService.getByIds(ids);
        return targets.reduce(reduceToDictionary, {});
    }

    async function toRuleDto(rule: Rule): Promise<Rule & { eventTypeName: string, targetName: string }> {
        const { eventTypeId, targetId } = rule;
        const eventTypes = await getEventTypesDictionaryByIds([eventTypeId]);
        const targets = await getTargetsDictionaryByIds([targetId]);
        return denormalizeRule(rule, eventTypes, targets);
    }

    async function toRulesDtos(rules: Rule[]): Promise<(Rule & { eventTypeName: string, targetName: string })[]> {
        const eventTypesIds = rules.map(r => r.eventTypeId);
        const targetsIds = rules.map(r => r.targetId);
        const eventTypes = await getEventTypesDictionaryByIds(eventTypesIds);
        const targets = await getTargetsDictionaryByIds(targetsIds);
        return rules.map(rule => denormalizeRule(rule, eventTypes, targets));
    }

    function denormalizeRule(rule: Rule, eventTypes: {[key:string]: EventType}, targets: {[key:string]: Target}): Rule & { eventTypeName: string, targetName: string } {
        const { eventTypeId, targetId } = rule;
        const { name: eventTypeName } = eventTypes[eventTypeId.toHexString()];
        const { name: targetName } = targets[targetId.toHexString()];
        return { ...rule, eventTypeName, targetName };
    }

    async function list(request: FastifyRequest) {
        const { page, pageSize, search } = request.query;
        const results = await rulesService.list(page, pageSize, search);
        return {
            results: await toRulesDtos(results),
            next: getNextLink(request, results),
            prev: getPrevLink(request)
        };
    }

    async function getById(request: FastifyRequest) {
        const { id } = request.params;
        const ruleId = ObjectId.createFromHexString(id);
        const rule = await rulesService.getById(ruleId);
        if (!rule) {
            throw new NotFoundError(`Rule ${id} cannot be found`);
        }
        return await toRuleDto(rule);
    }

    async function deleteById(request: FastifyRequest, reply: FastifyReply<ServerResponse>) {
        const { id } = request.params;
        const ruleId = ObjectId.createFromHexString(id);
        await rulesService.deleteById(ruleId);
        reply.status(204).send();
    }

    async function create(request: FastifyRequest, reply: FastifyReply<ServerResponse>) {
        const { name, filters, skipOnConsecutivesMatches, eventTypeId, targetId } = request.body;
        const ruleToCreate = {
            name,
            filters,
            skipOnConsecutivesMatches,
            eventTypeId: ObjectId.createFromHexString(eventTypeId),
            targetId: ObjectId.createFromHexString(targetId),
        };
        const rule = await rulesService.create(ruleToCreate);
        reply.header('Location', `${getExternalUrl((request.raw as any).originalUrl)}/${rule.id}`);
        reply.status(201).send(await toRuleDto(rule));
    }

    return function(fastify: FastifyInstance, opts, next) {
        fastify.get('/', { ...opts, schema: listSchema }, list);
        fastify.get('/:id', { ...opts, schema: getSchema }, getById);
        fastify.delete('/:id', { ...opts, schema: deleteSchema }, deleteById);
        fastify.post('/', { ...opts, schema: createSchema }, create);
        next();
    };
}
