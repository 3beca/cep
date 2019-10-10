import targetsService from '../../services/targets-service';
import { getNextLink, getPrevLink, getExternalUrl } from '../../utils/url';
import NotFoundError from '../../errors/not-found-error';

async function list(request) {
    const { page, pageSize } = request.query;
    const results = await targetsService.list(page, pageSize);
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
        throw new NotFoundError();
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
        pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 10 }
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

const getSchema = {
    tags: ['targets'],
    params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'target identifier'
          }
        }
    },
    response: {
        200: targetschema
    }
};

const deleteSchema = {
    tags: ['targets'],
    params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'target identifier'
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

export default function(fastify, opts, next) {
    fastify.get('/', { ...opts, schema: listSchema }, list);
    fastify.get('/:id', { ...opts, schema: getSchema }, getById);
    fastify.delete('/:id', { ...opts, schema: deleteSchema }, deleteById);
    fastify.post('/', { ...opts, schema: createSchema }, create);
    next();
}
