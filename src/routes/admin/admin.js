import eventRoutes from './events';

function checkHealth(request, reply) {
    reply.code(204).res.end();
}

const schema = {
    response: {
        204: {
            description: 'Health check successufull',
            type: 'object'
        }
    }
};

export default function(fastify, opts, next) {
    fastify.get('/check-health', { ...opts, ...{ logLevel: 'warn', schema } }, checkHealth);
    fastify.register(eventRoutes, { prefix: '/events' });
    next();
}

