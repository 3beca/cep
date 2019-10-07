
async function list() {
    return { items: [] };
}

function create(request, reply) {
    const { name } = request.body;
    reply.status(201).send({ name });
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
    response: {
        200: {
            type: 'object',
            properties: {
                items: {
                    type: 'array',
                    items: eventSchema
                }
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

