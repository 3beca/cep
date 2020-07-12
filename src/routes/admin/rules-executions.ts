import { getNextLink, getPrevLink } from '../../utils/url';
import { RulesExecutionsService } from '../../services/rules-executions-service';
import { toSafeObjectId } from '../../utils/dto';
import { FastifyInstance, FastifyRequest } from 'fastify';

const ruleExecutionSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        requestId: { type: 'string' },
        eventId: { type: 'string' },
        eventTypeId: { type: 'string' },
        eventTypeName: { type: 'string' },
        targetId: { type: 'string' },
        targetName: { type: 'string' },
        targetSuccess: { type: 'boolean' },
        targetStatusCode: { type: 'number' },
        ruleId: { type: 'string' },
        ruleName: { type: 'string' },
        executedAt: { type: 'string' },
        match: { type: 'boolean' },
        skip: { type: 'boolean' }
    }
};

const listSchema = {
    tags: ['rules'],
    querystring: {
        page: { type: 'integer', minimum: 1, default: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
        eventTypeId: { type: 'string', pattern: '^[a-f0-9]{24}$', errorMessage: 'should be a valid ObjectId' },
        ruleId: { type: 'string', pattern: '^[a-f0-9]{24}$', errorMessage: 'should be a valid ObjectId' }
    },
    response: {
        200: {
            type: 'object',
            properties: {
                results: {
                    type: 'array',
                    items: ruleExecutionSchema
                },
                next: { type: 'string' },
                prev: { type: 'string' }
            }
        }
    }
};

export function buildRulesExecutionsRoutes(rulesExecutionsService: RulesExecutionsService) {

    async function list(request: FastifyRequest<{ Querystring: { page: number, pageSize: number, eventTypeId: string, ruleId: string } }>) {
        const { page, pageSize, eventTypeId, ruleId } = request.query;
        const events = await rulesExecutionsService.list(page, pageSize,
            toSafeObjectId(eventTypeId),
            toSafeObjectId(ruleId));
        const results = events;
        return {
            results,
            next: getNextLink(request, results),
            prev: getPrevLink(request)
        };
    }

    return function(fastify: FastifyInstance, opts, next) {
        fastify.get('/', { ...opts, schema: listSchema }, list);
        next();
    };
}
