import { getNextLink, getPrevLink, getUrl } from '../../utils/url';
import NotFoundError from '../../errors/not-found-error';
import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';
import { Server } from 'http';
import { TargetsService } from '../../services/targets-service';
import { Target } from '../../models/target';

const targetSchema = {
    type: 'object',
    properties: {
        name: { type: 'string' },
        id: { type: 'string' },
        url: { type: 'string' },
        headers: {
            type: 'object',
            additionalProperties: { type: 'string' }
        },
        body: {},
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
                    items: targetSchema
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
        200: targetSchema
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
                format: 'uri'
            },
            headers: {
                type: 'object',
                additionalProperties: { type: 'string' }
            },
            body: {
                type: ['object', 'array'],
                additionalProperties: true
            }
        }
    },
    response: {
        201: targetSchema
    }
};


const updateSchema = {
    tags: ['targets'],
    params: targetIdParam,
    body: {
        type: 'object',
        required: ['name', 'url'],
        properties: {
            name: { type: 'string', maxLength: 100 },
            url: {
                type: 'string',
                format: 'uri'
            },
            headers: {
                type: 'object',
                additionalProperties: { type: 'string' }
            },
            body: {
                type: ['object', 'array'],
                additionalProperties: true
            }
        }
    },
    response: {
        200: targetSchema
    }
};

export function buildTargetsRoutes(targetsService: TargetsService) {

    async function list(request: FastifyRequest<{ Querystring: { page: number, pageSize: number, search: string } }>) {
        const { page, pageSize, search } = request.query;
        const results = await targetsService.list(page, pageSize, search);
        return {
            results,
            next: getNextLink(request, results),
            prev: getPrevLink(request)
        };
    }

    async function getById(request: FastifyRequest<{ Params: { id: string } }>): Promise<Target> {
        const { id } = request.params;
        const targetId = ObjectId.createFromHexString(id);
        const target = await targetsService.getById(targetId);
        if (!target) {
            throw new NotFoundError(`Target ${id} cannot be found`);
        }
        return target;
    }

    async function deleteById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply<Server>): Promise<void> {
        const { id } = request.params;
        const targetId = ObjectId.createFromHexString(id);
        await targetsService.deleteById(targetId);
        reply.status(204).send();
    }

    function updateById(request: FastifyRequest<{ Params: { id: string }, Body: { name:string, url: string, headers: { [key:string]: string }, body: object | [] } }>, reply: FastifyReply<Server>): Promise<Target> {
        const { id } = request.params;
        const { name, url, headers, body } = request.body;
        const targetId = ObjectId.createFromHexString(id);
        return targetsService.updateById(targetId, { name, url, headers, body });
    }

    async function create(request: FastifyRequest<{ Body: { name:string, url: string, headers: { [key:string]: string }, body: object | [] } }>, reply: FastifyReply<Server>) {
        const { name, url, headers, body } = request.body;
        const target = await targetsService.create({ name, url, headers, body });
        reply.header('Location', getUrl(request, `/targets/${target.id}`));
        reply.status(201).send(target);
    }

    return function(fastify: FastifyInstance, opts, next) {
        fastify.get('/', { ...opts, schema: listSchema }, list);
        fastify.post('/', { ...opts, schema: createSchema }, create);
        fastify.get('/:id', { ...opts, schema: getSchema }, getById);
        fastify.put('/:id', { ...opts, schema: updateSchema }, updateById);
        fastify.delete('/:id', { ...opts, schema: deleteSchema }, deleteById);
        next();
    };
}
