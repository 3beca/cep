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

async function processEvent(request, reply) {
    const { body, params } = request;
    const { id } = params;
    await engine.processEvent(id, body);
    reply.status(204).send();
}

export default function(fastify, opts, next) {
    fastify.post('/events/:id', { ...opts, schema: processEventSchema }, processEvent);
    next();
}
