import { getNextLink, getPrevLink } from '../../utils/url';

const eventSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        eventTypeId: { type: 'string' },
        eventTypeName: { type: 'string' },
        payload: { type: 'object', additionalProperties: true },
        requestId: { type: 'string' },
        createdAt: { type: 'string' }
    }
};

const listSchema = {
    tags: ['events'],
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
                    items: eventSchema
                },
                next: { type: 'string' },
                prev: { type: 'string' }
            }
        }
    }
};

export function buildEventsRoutes(eventsService) {

    async function list(request) {
        const { page, pageSize } = request.query;
        const events = await eventsService.list(page, pageSize);
        const results = events;
        return {
            results,
            next: getNextLink(request, results),
            prev: getPrevLink(request)
        };
    }

    return function(fastify, opts, next) {
        fastify.get('/', { ...opts, schema: listSchema }, list);
        next();
    };
}
