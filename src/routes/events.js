import engine from '../engine';

const processEventSchema = {
    tags: ['event processing'],
    params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'event identifier'
          }
        }
    },
    response: {
        204: {
            type: 'object'
        }
    }
};

export function buildEventsRoutes(engine) {

    async function processEvent(request, reply) {
        const { body, params, id: requestId } = request;
        const { id } = params;
        await engine.processEvent(id, body, requestId);
        reply.status(204).send();
    }

    return function(fastify, opts, next) {
        fastify.post('/events/:id', { ...opts, schema: processEventSchema }, processEvent);
        next();
    };
}
