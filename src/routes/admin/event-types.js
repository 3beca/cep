import { getNextLink, getPrevLink, getExternalUrl } from '../../utils/url';
import NotFoundError from '../../errors/not-found-error';

const eventTypeSchema = {
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
    tags: ['event types'],
    querystring: {
        page: { type: 'integer', minimum: 1, default: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 10 }
    },
    response: {
        200: {
            type: 'object',
            properties: {
                results: {
                    type: 'array',
                    items: eventTypeSchema
                },
                next: { type: 'string' },
                prev: { type: 'string' }
            }
        }
    }
};

const getSchema = {
    tags: ['event types'],
    params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'event type identifier'
          }
        }
    },
    response: {
        200: eventTypeSchema
    }
};

const deleteSchema = {
    tags: ['event types'],
    params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'event type identifier'
          }
        }
    },
    response: {
        204: {
            type: 'object'
        }
    }
};

const createSchema = {
    tags: ['event types'],
    body: {
        type: 'object',
        required: ['name'],
        properties: {
            name: { type: 'string', maxLength: 100 }
        }
    },
    response: {
        201: eventTypeSchema
    }
};

function toEventTypeResponse(eventType) {
    return { ...eventType, url: `${getExternalUrl('/events')}/${eventType.id}` };
}

export function buildEventTypesRoutes(eventTypesService) {

    async function list(request) {
        const { page, pageSize } = request.query;
        const eventTypes = await eventTypesService.list(page, pageSize);
        const results = eventTypes.map(toEventTypeResponse);
        return {
            results,
            next: getNextLink(request, results),
            prev: getPrevLink(request)
        };
    }

    async function getById(request) {
        const { id } = request.params;
        const eventType = await eventTypesService.getById(id);
        if (!eventType) {
            throw new NotFoundError();
        }
        return toEventTypeResponse(eventType);
    }

    async function deleteById(request, reply) {
        const { id } = request.params;
        await eventTypesService.deleteById(id);
        reply.status(204).send();
    }

    async function create(request, reply) {
        const { name } = request.body;
        const eventType = await eventTypesService.create({ name });
        reply.header('Location', `${getExternalUrl(request.raw.originalUrl)}/${eventType.id}`);
        reply.status(201).send(toEventTypeResponse(eventType));
    }

    return function(fastify, opts, next) {
        fastify.get('/', { ...opts, schema: listSchema }, list);
        fastify.get('/:id', { ...opts, schema: getSchema }, getById);
        fastify.delete('/:id', { ...opts, schema: deleteSchema }, deleteById);
        fastify.post('/', { ...opts, schema: createSchema }, create);
        next();
    };
}
