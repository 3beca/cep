import eventService from '../../services/events-service';
import { getNextLink, getPrevLink, getExternalUrl } from '../../utils/url';

function toEventResponse(event) {
    return { ...event, url: `${getExternalUrl('/events')}/${event.id}` };
}

async function list(request) {
    const { page, pageSize } = request.query;
    const events = await eventService.list(page, pageSize);
    const results = events.map(toEventResponse);
    return {
        results,
        next: getNextLink(request, results),
        prev: getPrevLink(request)
    };
}

async function create(request, reply) {
    const { name } = request.body;
    const event = await eventService.create({ name });
    reply.header('Location', `${getExternalUrl(request.raw.originalUrl)}/${event.id}`);
    reply.status(201).send(toEventResponse(event));
}

const eventSchema = {
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

const createSchema = {
    body: {
        type: 'object',
        required: ['name'],
        properties: {
            name: { type: 'string' }
        }
    },
    response: {
        201: eventSchema
    }
};

export default function(fastify, opts, next) {
    fastify.get('/', { ...opts, schema: listSchema }, list);
    fastify.post('/', { ...opts, schema: createSchema }, create);
    next();
}

