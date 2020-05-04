import { getNextLink, getPrevLink, getExternalUrl } from '../../utils/url';
import NotFoundError from '../../errors/not-found-error';

const targetschema = {
    type: 'object',
    properties: {
        name: { type: 'string' },
        id: { type: 'string' },
        url: { type: 'string' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' }
    }
};

const listSchema = {
    tags: ['targets'],
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
                    items: targetschema
                },
                next: { type: 'string' },
                prev: { type: 'string' }
            }
        }
    }
};

const targetIdParam = {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'target identifier',
        pattern: '^[a-f0-9]{24}$'
      }
    },
    errorMessage: 'target id must be a valid ObjectId'
};

const getSchema = {
    tags: ['targets'],
    params: targetIdParam,
    response: {
        200: targetschema
    }
};

const deleteSchema = {
    tags: ['targets'],
    params: targetIdParam,
    response: {
        204: {
            type: 'object'
        }
    }
};

const createSchema = {
    tags: ['targets'],
    body: {
        type: 'object',
        required: ['name', 'url'],
        properties: {
            name: { type: 'string', maxLength: 100 },
            url: {
                type: 'string',
                format: 'url'
            }
        }
    },
    response: {
        201: targetschema
    }
};

export function buildTargetsRoutes(targetsService) {

    async function list(request) {
        const { page, pageSize, search } = request.query;
        const results = await targetsService.list(page, pageSize, search);
        return {
            results,
            next: getNextLink(request, results),
            prev: getPrevLink(request)
        };
    }

    async function getById(request) {
        const { id } = request.params;
        const target = await targetsService.getById(id);
        if (!target) {
            throw new NotFoundError(`Target ${id} cannot be found`);
        }
        return target;
    }

    async function deleteById(request, reply) {
        const { id } = request.params;
        await targetsService.deleteById(id);
        reply.status(204).send();
    }

    async function create(request, reply) {
        const { name, url } = request.body;
        const target = await targetsService.create({ name, url });
        reply.header('Location', `${getExternalUrl(request.raw.originalUrl)}/${target.id}`);
        reply.status(201).send(target);
    }

    return function(fastify, opts, next) {
        fastify.get('/', { ...opts, schema: listSchema }, list);
        fastify.get('/:id', { ...opts, schema: getSchema }, getById);
        fastify.delete('/:id', { ...opts, schema: deleteSchema }, deleteById);
        fastify.post('/', { ...opts, schema: createSchema }, create);
        next();
    };
}
