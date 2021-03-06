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
import fastifyBearerAuth from 'fastify-bearer-auth';
import logger from './logger';
import AjvErrors from 'ajv-errors';
import addFormats from 'ajv-formats';
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
		allowUnionTypes: true
	});
	addFormats(ajv);
	AjvErrors(ajv);
	app.setValidatorCompiler(({ schema }) => ajv.compile(schema));

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

	app.register(fastifyMetrics, {
		enableDefaultMetrics: false,
		register: metrics.getRegister(),
		prefix: 'cep_admin_server_'
	});

	if (enableCors) {
		app.register(fastifyCors, {
			origin: true,
			methods: ['GET', 'POST', 'DELETE', 'PUT'],
			allowedHeaders: ['Content-Type', ...(enableSecurity ? ['Authorization'] : []) ]
		});
	}

	app.register(async function routes(app: FastifyInstance) {

		if (enableSecurity) {
			app.register(fastifyBearerAuth, {
				keys,
				bearerType: 'apiKey',
				errorResponse: (err: Error) => ({
					statusCode: 401,
					error: 'Unauthorized',
					message: err.message
				})
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
			reply.code(404).send({
				statusCode: 404,
				error: 'Not Found',
				message: 'Resource not found'
			});
		});
	});

	app.setErrorHandler((error, request: FastifyRequest, reply: FastifyReply<Server>) => {
		if (error instanceof NotFoundError) {
			request.log.info(error.message);
			reply.status(404).send({
				statusCode: 404,
				error: 'Not Found',
				message: 'Resource not found'
			});
			return;
		}
		if (error instanceof ConflictError) {
			request.log.info(error.message);
			reply.header('Location', getUrl(request, `/${error.resources}/${error.id}`));
			reply.status(409).send({
				statusCode: 409,
				error: 'Conflict',
				message: error.message
			});
			return;
		}
		if (error instanceof FilterError ||
			error instanceof InvalidOperationError ||
			error instanceof GroupError ||
			error.validation ||
			error.statusCode === 400) {
			request.log.info(error.message);
			reply.status(400).send({
				statusCode: 400,
				error: 'Bad Request',
				message: error.message
			});
			return;
		}
		request.log.error(error.message);
		reply.status(500).send({
			statusCode: 500,
			error: 'Internal Server Error',
			message: 'Ups, something goes wrong.'
		});
	});

	return app;
}
