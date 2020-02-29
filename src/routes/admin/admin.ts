import { buildEventTypesRoutes } from './event-types';
import { buildTargetsRoutes } from './targets';
import { buildRulesRoutes } from './rules';
import packageInfo from '../../../package.json';
import { buildEventsRoutes } from './events';

const checkHealthSchema = {
    tags: ['system'],
    response: {
        204: {
            description: 'Health check successfull',
            type: 'object'
        }
    }
};

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

export function buildAdminRoutes(eventTypesService, rulesService, targetsService, eventsService) {

    function checkHealth(request, reply) {
        reply.code(204).res.end();
    }

    async function version() {
        return { version: packageInfo.version };
    }

    return function(fastify, opts, next) {
        fastify.get('/check-health', { ...opts, ...{ logLevel: 'warn', schema: checkHealthSchema } }, checkHealth);
        fastify.get('/version', { ...opts, ...{ logLevel: 'warn', schema: versionSchema } }, version);
        fastify.register(buildEventTypesRoutes(eventTypesService), { prefix: '/event-types' });
        fastify.register(buildTargetsRoutes(targetsService), { prefix: '/targets' });
        fastify.register(buildRulesRoutes(rulesService), { prefix: '/rules' });
        fastify.register(buildEventsRoutes(eventsService), { prefix: '/events' });
        next();
    };
}
