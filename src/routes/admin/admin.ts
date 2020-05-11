import { buildEventTypesRoutes } from './event-types';
import { buildTargetsRoutes } from './targets';
import { buildRulesRoutes } from './rules';
import packageInfo from '../../../package.json';
import { buildEventsRoutes } from './events';
import { RulesExecutionsService } from '../../services/rules-executions-service';
import { buildRulesExecutionsRoutes } from './rules-executions';
import { EventsService } from '../../services/events-service';
import { EventTypesService } from '../../services/event-types-service';
import { TargetsService } from '../../services/targets-service';
import { RulesService } from '../../services/rules-services';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ServerResponse } from 'http';

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

export function buildAdminRoutes(
    eventTypesService: EventTypesService,
    rulesService: RulesService,
    targetsService: TargetsService,
    rulesExecutionsService: RulesExecutionsService,
    eventsService: EventsService) {

    function checkHealth(request: FastifyRequest, reply: FastifyReply<ServerResponse>) {
        reply.code(204).res.end();
    }

    async function version() {
        return { version: packageInfo.version };
    }

    return function(fastify: FastifyInstance, opts, next) {
        fastify.get('/check-health', { ...opts, ...{ logLevel: 'warn', schema: checkHealthSchema } }, checkHealth);
        fastify.get('/version', { ...opts, ...{ logLevel: 'warn', schema: versionSchema } }, version);
        fastify.register(buildEventTypesRoutes(eventTypesService), { prefix: '/event-types' });
        fastify.register(buildTargetsRoutes(targetsService), { prefix: '/targets' });
        fastify.register(buildRulesRoutes(rulesService), { prefix: '/rules' });
        fastify.register(buildEventsRoutes(eventsService), { prefix: '/events' });
        fastify.register(buildRulesExecutionsRoutes(rulesExecutionsService), { prefix: 'rules-executions' });
        next();
    };
}
