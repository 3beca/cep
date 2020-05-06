import { getNextLink, getPrevLink, getExternalUrl } from '../../utils/url';
import NotFoundError from '../../errors/not-found-error';

const ruleschema = {
    type: 'object',
    properties: {
        name: { type: 'string' },
        id: { type: 'string' },
        targetId: { type: 'string' },
        eventTypeId: { type: 'string' },
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

export function buildRulesRoutes(rulesService) {

    async function list(request) {
        const { page, pageSize, search } = request.query;
        const results = await rulesService.list(page, pageSize, search);
        return {
            results,
            next: getNextLink(request, results),
            prev: getPrevLink(request)
        };
    }

    async function getById(request) {
        const { id } = request.params;
        const rule = await rulesService.getById(id);
        if (!rule) {
            throw new NotFoundError(`Rule ${id} cannot be found`);
        }
        return rule;
    }

    async function deleteById(request, reply) {
        const { id } = request.params;
        await rulesService.deleteById(id);
        reply.status(204).send();
    }

    async function create(request, reply) {
        const rule = await rulesService.create(request.body);
        reply.header('Location', `${getExternalUrl(request.raw.originalUrl)}/${rule.id}`);
        reply.status(201).send(rule);
    }

    return function(fastify, opts, next) {
        fastify.get('/', { ...opts, schema: listSchema }, list);
        fastify.get('/:id', { ...opts, schema: getSchema }, getById);
        fastify.delete('/:id', { ...opts, schema: deleteSchema }, deleteById);
        fastify.post('/', { ...opts, schema: createSchema }, create);
        next();
    };
}
