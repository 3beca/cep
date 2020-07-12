import { getNextLink, getPrevLink, getExternalUrl } from '../../utils/url';
import NotFoundError from '../../errors/not-found-error';
import { FastifyReply, FastifyInstance, FastifyRequest } from 'fastify';
import { Server } from 'http';
import { ObjectId } from 'mongodb';
import { EventTypesService } from '../../services/event-types-service';

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
        pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
        search: { type: 'string' }
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

const eventTypeIdParam = {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'event type identifier',
        pattern: '^[a-f0-9]{24}$'
      }
    },
    errorMessage: 'event type id must be a valid ObjectId'
};

const getSchema = {
    tags: ['event types'],
    params: eventTypeIdParam,
    response: {
        200: eventTypeSchema
    }
};

const deleteSchema = {
    tags: ['event types'],
    params: eventTypeIdParam,
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

export function buildEventTypesRoutes(eventTypesService: EventTypesService) {

    async function list(request: FastifyRequest<{ Querystring: { page: number, pageSize: number, search: string } }>) {
        const { page, pageSize, search } = request.query;
        const eventTypes = await eventTypesService.list(page, pageSize, search);
        const results = eventTypes.map(toEventTypeResponse);
        return {
            results,
            next: getNextLink(request, results),
            prev: getPrevLink(request)
        };
    }

    async function getById(request: FastifyRequest<{ Params: { id: string } }>) {
        const { id } = request.params;
        const eventTypeId = ObjectId.createFromHexString(id);
        const eventType = await eventTypesService.getById(eventTypeId);
        if (!eventType) {
            throw new NotFoundError(`Event type ${id} cannot be found`);
        }
        return toEventTypeResponse(eventType);
    }

    async function deleteById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply<Server>): Promise<void> {
        const { id } = request.params;
        const eventTypeId = ObjectId.createFromHexString(id);
        await eventTypesService.deleteById(eventTypeId);
        reply.status(204).send();
    }

    async function create(request: FastifyRequest<{ Body: { name: string }}>, reply: FastifyReply<Server>) {
        const { name } = request.body;
        const eventType = await eventTypesService.create({ name });
        reply.header('Location', `${getExternalUrl((request.raw as any).originalUrl)}/${eventType.id}`);
        reply.status(201).send(toEventTypeResponse(eventType));
    }

    return function(fastify: FastifyInstance, opts, next) {
        fastify.get('/', { ...opts, schema: listSchema }, list);
        fastify.get('/:id', { ...opts, schema: getSchema }, getById);
        fastify.delete('/:id', { ...opts, schema: deleteSchema }, deleteById);
        fastify.post('/', { ...opts, schema: createSchema }, create);
        next();
    };
}
