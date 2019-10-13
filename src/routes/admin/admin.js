import eventTypesRoutes from './event-types';
import targetsRoutes from './targets';
import rulesRoutes from './rules';
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

async function testProxy(request) {
    return {
        ip: request.ip,
        ips: request.ips,
        hostName: request.hostname,
        headers: request.headers,
        protocol: request.raw.protocol
    };
}

export default function(fastify, opts, next) {
    fastify.get('/check-health', { ...opts, ...{ logLevel: 'warn', schema: checkHealthSchema } }, checkHealth);
    fastify.get('/version', { ...opts, ...{ logLevel: 'warn', schema: versionSchema } }, version);
    fastify.get('/testProxy', { ...opts }, testProxy);
    fastify.register(eventTypesRoutes, { prefix: '/event-types' });
    fastify.register(targetsRoutes, { prefix: '/targets' });
    fastify.register(rulesRoutes, { prefix: '/rules' });
    next();
}

