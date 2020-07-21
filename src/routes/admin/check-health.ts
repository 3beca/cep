import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Server } from 'http';

const checkHealthSchema = {
    tags: ['system'],
    response: {
        204: {
            description: 'Health check successfull',
            type: 'object'
        }
    }
};

export function buildCheckHealthRoutes() {

    function checkHealth(request: FastifyRequest, reply: FastifyReply<Server>) {
        reply.code(204).send();
    }

    return function(fastify: FastifyInstance, opts, next) {
        fastify.get('/check-health', { ...opts, ...{ logLevel: 'warn', schema: checkHealthSchema } }, checkHealth);
        next();
    };
}
