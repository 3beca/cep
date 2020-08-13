import fastify, { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import packageInfo from '../package.json';
import fastifySwagger from 'fastify-swagger';
import NotFoundError from './errors/not-found-error';
import ConflictError from './errors/conflict-error';
import FilterError from './filters/filter-error';
import InvalidOperationError from './errors/invalid-operation-error';
import { buildCheckHealthRoutes } from './routes/admin/check-health';
import fastifyCors from 'fastify-cors';
import fastifyMetrics from 'fastify-metrics';
import bearerAuthPlugin from 'fastify-bearer-auth';
import logger from './logger';
import AjvErrors from 'ajv-errors';
import Ajv from 'ajv';
import { RulesExecutionsService } from './services/rules-executions-service';
import { EventsService } from './services/events-service';
import { EventTypesService } from './services/event-types-service';
import { TargetsService } from './services/targets-service';
import { RulesService } from './services/rules-services';
import { Server } from 'http';
import GroupError from './windowing/group-error';
import { Metrics } from './metrics';
import { buildEventTypesRoutes } from './routes/admin/event-types';
import { buildTargetsRoutes } from './routes/admin/targets';
import { buildRulesRoutes } from './routes/admin/rules';
import { buildRulesExecutionsRoutes } from './routes/admin/rules-executions';
import { buildVersionRoutes } from './routes/admin/version';
import { buildEventsRoutes } from './routes/admin/events';
import { Config } from './config';
import { getUrl } from './utils/url';

declare module 'fastify' {
	interface FastifyRequest {
		protocol: 'http' | 'https'
	}
}

export function buildAdminServer(
	config: Config['adminHttp'] & { eventProcessingHttpBaseUrl: string },
	eventTypesService: EventTypesService,
	targetsService: TargetsService,
	rulesService: RulesService,
	eventsService: EventsService,
	rulesExecutionsService: RulesExecutionsService,
	metrics: Metrics): FastifyInstance {

	const { trustProxy, enableCors, enableSwagger, apiKeys } = config;
	const keys = new Set(apiKeys.split(' ').filter(k => k));
	const enableSecurity = keys.size > 0;

	const app = fastify({
		logger,
		trustProxy
	});

	const ajv = new Ajv({
		removeAdditional: true,
		useDefaults: true,
		coerceTypes: true,
		allErrors: true,
		nullable: true,
		jsonPointers: true
	});
	AjvErrors(ajv);
	app.setValidatorCompiler(({ schema }) => ajv.compile(schema));

	// Fastify currently does not expose req.protocol in request object.
	// Also it does not have support for X-Forwarded-Proto when trustProxy.
	// Added code below inspired by https://github.com/fastify/fastify/pull/1805
	if (trustProxy) {
		app.decorateRequest('protocol', {
			getter() {
				return (this.headers['x-forwarded-proto'] ?? 'http').startsWith('https') ? 'https' : 'http';
			}
		});
	} else {
		app.decorateRequest('protocol', {
			getter() {
				// we only provide https support using a reverse proxy.
				return 'http';
			}
		});
	}

	if (enableSwagger) {
		app.register(fastifySwagger, {
			routePrefix: '/documentation',
			exposeRoute: true,
			swagger: {
				info: {
					title: packageInfo.name,
					description: packageInfo.description,
					version: packageInfo.version
				},
				externalDocs: {
					url: packageInfo.homepage,
					description: 'Find more info here'
				},
				tags: [
					{ name: 'system', description: 'System related end-points' },
					{ name: 'event types', description: 'Event Types related end-points' },
					{ name: 'targets', description: 'Targets related end-points' },
					{ name: 'rules', description: 'Rules related end-points' },
					{ name: 'events', description: 'Processed events log related end-points' }
				],
				consumes: ['application/json'],
				produces: ['application/json'],
				...(enableSecurity ? {
					securityDefinitions: {
						apiKeyHeader: {
							type: 'apiKey',
							in: 'header',
							name: 'Authorization'
						}
					},
					security: [{
						apiKeyHeader: []
					}]
				} : {})
			}
		});
	}

	if (enableSecurity) {
		app.register(bearerAuthPlugin, { keys, bearerType: 'apiKey' });
	}

	app.register(fastifyMetrics, {
		enableDefaultMetrics: false,
		register: metrics.getRegister(),
		prefix: 'cep_admin_server_'
	});

	if (enableCors) {
		app.register(fastifyCors, {
			origin: true,
			methods: ['GET', 'POST', 'DELETE', 'PUT'],
			allowedHeaders: ['Content-Type']
		});
	}

	// End points
	app.register(buildCheckHealthRoutes());
	app.register(buildVersionRoutes());
	app.register(buildEventTypesRoutes(eventTypesService, config.eventProcessingHttpBaseUrl), { prefix: '/event-types' });
	app.register(buildTargetsRoutes(targetsService), { prefix: '/targets' });
	app.register(buildRulesRoutes(targetsService, eventTypesService, rulesService), { prefix: '/rules' });
	app.register(buildEventsRoutes(eventsService), { prefix: '/events' });
	app.register(buildRulesExecutionsRoutes(rulesExecutionsService), { prefix: '/rules-executions' });

	app.setNotFoundHandler(function(request, reply: FastifyReply<Server>) {
		// Default not found handler with preValidation and preHandler hooks
		reply.code(404).send({ message: 'Resource not found' });
	});

	app.setErrorHandler((error, request: FastifyRequest, reply: FastifyReply<Server>) => {
		if (error instanceof NotFoundError) {
			request.log.info(error);
			reply.status(404).send({ message: 'Resource not found' });
			return;
		}
		if (error instanceof ConflictError) {
			request.log.info(error);
			reply.header('Location', getUrl(request, `${request.url}/${error.id}`));
			reply.status(409).send({ message: error.message });
			return;
		}
		if (error instanceof FilterError ||
			error instanceof InvalidOperationError ||
			error instanceof GroupError ||
			error.validation) {
			request.log.info(error);
			reply.status(400).send(error);
			return;
		}
		if (error.statusCode && error.statusCode < 500) {
			request.log.info(error);
		} else {
			request.log.error(error);
		}
		reply.status(error.statusCode ?? 500).send(error);
	});

	return app;
}
