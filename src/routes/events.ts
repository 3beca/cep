import { Engine } from '../engine';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Server } from 'http';
import { ObjectId } from 'mongodb';

const processEventSchema = {
    tags: ['event processing'],
    params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'event identifier',
            pattern: '^[a-f0-9]{24}$'
          }
        },
        errorMessage: 'event type id must be a valid ObjectId'
    },
    response: {
        204: {
            type: 'object'
        }
    }
};

export function buildEventProcessingRoutes(engine: Engine) {

    async function processEvent(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply<Server>): Promise<void> {
        const { body, params, id: requestId } = request;
        const { id } = params;
        const eventTypeId = ObjectId.createFromHexString(id);
        await engine.processEvent(eventTypeId, body, requestId);
        reply.status(204).send();
    }

    return function(fastify: FastifyInstance, opts, next) {
        fastify.post('/events/:id', { ...opts, schema: processEventSchema }, processEvent);
        next();
    };
}
