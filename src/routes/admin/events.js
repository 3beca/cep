import eventService from '../../services/events-service';

async function list() {
    const results = await eventService.list();
    return {
        results
    };
}

async function create(request, reply) {
    const { name } = request.body;
    const event = await eventService.create({ name });
    reply.status(201).send(event);
}

const eventSchema = {
    type: 'object',
    properties: {
        name: { type: 'string' },
        id: { type: 'string' },
        url: { type: 'string' },
        createAt: { type: 'string' }
    }
};

const listSchema = {
    querystring: {
        page: { type: 'integer', minimum: 1 },
        pageSize: { type: 'integer', minimum: 1, maximum: 100 }
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

