import fastify, { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import packageInfo from '../package.json';
import fastifySwagger from 'fastify-swagger';
import config from './config';
import { buildEventsRoutes } from './routes/events';
import NotFoundError from './errors/not-found-error';
import ConflictError from './errors/conflict-error';
import { getExternalUrl } from './utils/url';
import FilterError from './filters/filter-error';
import InvalidOperationError from './errors/invalid-operation-error';
import { buildAdminRoutes } from './routes/admin/admin';
import fastifyCors from 'fastify-cors';
import fastifyMetrics from 'fastify-metrics';
import logger from './logger';
import AjvErrors from 'ajv-errors';
import Ajv from 'ajv';
import { RulesExecutionsService } from './services/rules-executions-service';
import { Engine } from './engine';
import { EventsService } from './services/events-service';
import { EventTypesService } from './services/event-types-service';
import { TargetsService } from './services/targets-service';
import { RulesService } from './services/rules-services';
import { Server } from 'http';
import GroupError from './windowing/group-error';
import { Metrics } from './metrics';

export type ServerOptions = {
	trustProxy: boolean;
	enableCors: boolean;
};

export function buildServer(options: ServerOptions,
	eventTypesService: EventTypesService,
	targetsService: TargetsService,
	rulesService: RulesService,
	eventsService: EventsService,
	rulesExecutionsService: RulesExecutionsService,
	engine: Engine,
	metrics: Metrics): FastifyInstance {

	const app = fastify({
		logger,
		trustProxy: options.trustProxy
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
				{ name: 'events', description: 'Processed events log related end-points' },
				{ name: 'event processing', description: 'Event processing related end-points' }
			],
			host: `${config.externalHttp.host}:${config.externalHttp.port}`,
			schemes: [config.externalHttp.protocol],
			consumes: ['application/json'],
			produces: ['application/json']
		}
	});

	app.register(fastifyMetrics, {
		enableDefaultMetrics: false,
		register: metrics.getRegister(),
		prefix: 'cep_server_'
	});

	if (options.enableCors) {
		app.register(fastifyCors, {
			origin: true,
			methods: ['GET', 'POST', 'DELETE', 'PUT' ],
			allowedHeaders: ['Content-Type']
		});
	}

	// End points
	app.register(buildAdminRoutes(
		eventTypesService, rulesService, targetsService,
		rulesExecutionsService, eventsService), { prefix: '/admin' });
	app.register(buildEventsRoutes(engine));

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
			reply.header('Location', getExternalUrl(`${request.url}/${error.id}`));
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
