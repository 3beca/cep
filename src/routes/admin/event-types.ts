import { getNextLink, getPrevLink, getExternalUrl } from '../../utils/url';
import NotFoundError from '../../errors/not-found-error';
import { FastifyReply, FastifyInstance, FastifyRequest } from 'fastify';
import { Server } from 'http';
import { ObjectId } from 'mongodb';
import { EventTypesService } from '../../services/event-types-service';
import listQuerystringSchema from '../../schemas/list-querystring-schema.json';
import { ListQuerystringSchema as ListQuerystringSchemaInterface } from '../../types/list-querystring-schema';
import eventTypeListResponseSchema from '../../schemas/event-types-list-response-schema.json';
import { EventTypesListResponseSchema as EventTypesListResponseSchemaInterface } from '../../types/event-types-list-response-schema';
import eventTypesGetResponseSchema from '../../schemas/event-types-get-response-schema.json';
import { EventTypesGetResponseSchema as EventTypesGetResponseSchemaInterface } from '../../types/event-types-get-response-schema';
import { EventType } from '../../models/event-type';
import idParamsSchema from '../../schemas/id-params-schema.json';
import { IdParamsSchema as IdParamsSchemaInterface } from '../../types/id-params-schema';
import eventTypesCreateBodyRequestSchema from '../../schemas/event-types-create-body-request-schema.json';
import { EventTypesCreateBodyRequestSchema as EventTypesCreateBodyRequestSchemaInterface } from '../../types/event-types-create-body-request-schema';

const listSchema = {
    tags: ['event types'],
    querystring: listQuerystringSchema,
    response: {
        200: eventTypeListResponseSchema
    }
};

const getSchema = {
    tags: ['event types'],
    params: idParamsSchema,
    response: {
        200: eventTypesGetResponseSchema
    }
};

const deleteSchema = {
    tags: ['event types'],
    params: idParamsSchema,
    response: {
        204: {
            type: 'object'
        }
    }
};

const createSchema = {
    tags: ['event types'],
    body: eventTypesCreateBodyRequestSchema,
    response: {
        201: eventTypesGetResponseSchema
    }
};

function toEventTypeResponse(eventType: EventType): EventTypesGetResponseSchemaInterface {
    const { id, name, createdAt, updatedAt } = eventType;
    return {
        id: id.toHexString(),
        name,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        url: `${getExternalUrl('/events')}/${eventType.id}`
    };
}

export function buildEventTypesRoutes(eventTypesService: EventTypesService) {

    async function list(request: FastifyRequest<{ Querystring: ListQuerystringSchemaInterface }>): Promise<EventTypesListResponseSchemaInterface> {
        const { page, pageSize, search } = request.query;
        const eventTypes = await eventTypesService.list(page, pageSize, search);
        const results = eventTypes.map(toEventTypeResponse);
        return {
            results,
            next: getNextLink(request, results),
            prev: getPrevLink(request)
        };
    }

    async function getById(request: FastifyRequest<{ Params: IdParamsSchemaInterface }>): Promise<EventTypesGetResponseSchemaInterface> {
        const { id } = request.params;
        const eventTypeId = ObjectId.createFromHexString(id);
        const eventType = await eventTypesService.getById(eventTypeId);
        if (!eventType) {
            throw new NotFoundError(`Event type ${id} cannot be found`);
        }
        return toEventTypeResponse(eventType);
    }

    async function deleteById(request: FastifyRequest<{ Params: IdParamsSchemaInterface }>, reply: FastifyReply<Server>): Promise<void> {
        const { id } = request.params;
        const eventTypeId = ObjectId.createFromHexString(id);
        await eventTypesService.deleteById(eventTypeId);
        reply.status(204).send();
    }

    async function create(request: FastifyRequest<{ Body: EventTypesCreateBodyRequestSchemaInterface>, reply: FastifyReply<Server>): Promise<EventTypesGetResponseSchemaInterface> {
        const { name } = request.body;
        const eventType = await eventTypesService.create({ name });
        reply.header('Location', `${getExternalUrl(request.url)}/${eventType.id}`);
        reply.status(201);
        return toEventTypeResponse(eventType);
    }

    return function(fastify: FastifyInstance, opts, next) {
        fastify.get('/', { ...opts, schema: listSchema }, list);
        fastify.get('/:id', { ...opts, schema: getSchema }, getById);
        fastify.delete('/:id', { ...opts, schema: deleteSchema }, deleteById);
        fastify.post('/', { ...opts, schema: createSchema }, create);
        next();
    };
}
