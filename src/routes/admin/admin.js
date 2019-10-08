import eventRoutes from './events';
import packageInfo from '../../../package.json';

const checkHealthSchema = {
    tags: ['system'],
    response: {
        204: {
            description: 'Health check successfull',
            type: 'object'
        }
    }
};

function checkHealth(request, reply) {
    reply.code(204).res.end();
}

const versionSchema = {
    tags: ['system'],
    response: {
        200: {
            description: 'cep version',
            type: 'object',
            properties: {
                version: { type: 'string' }
            }
        }
    }
};

async function version() {
    return { version: packageInfo.version };
}

export default function(fastify, opts, next) {
    fastify.get('/check-health', { ...opts, ...{ logLevel: 'warn', schema: checkHealthSchema } }, checkHealth);
    fastify.get('/version', { ...opts, ...{ logLevel: 'warn', schema: versionSchema } }, version);
    fastify.register(eventRoutes, { prefix: '/events' });
    next();
}

