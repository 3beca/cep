import fastify, { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import packageInfo from '../package.json';
import fastifySwagger from 'fastify-swagger';
import NotFoundError from './errors/not-found-error';
import fastifyMetrics from 'fastify-metrics';
import logger from './logger';
import AjvErrors from 'ajv-errors';
import addFormats from 'ajv-formats';
import Ajv from 'ajv';
import { Server } from 'http';
import { Metrics } from './metrics';
import { Engine } from './engine';
import { buildEventProcessingRoutes } from './routes/event-processing/events';
import { Config } from './config';

export function buildEventProcessingServer(
	config: Config['eventProcessingHttp'],
	engine: Engine,
	metrics: Metrics): FastifyInstance {

	const { trustProxy, enableSwagger } = config;

	const app = fastify({
		logger,
		trustProxy
	});

	const ajv = new Ajv({
		removeAdditional: true,
		useDefaults: true,
		coerceTypes: true,
		allErrors: true
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
					{ name: 'event processing', description: 'Event processing related end-points' }
				],
				consumes: ['application/json'],
				produces: ['application/json']
			}
		});
	}

	app.register(fastifyMetrics, {
		enableDefaultMetrics: false,
		register: metrics.getRegister(),
		prefix: 'cep_event_processing_server_'
	});

	// End points
    app.register(buildEventProcessingRoutes(engine), { prefix: '/events' });

	app.setNotFoundHandler(function(request, reply: FastifyReply<Server>) {
		// Default not found handler with preValidation and preHandler hooks
		reply.code(404).send({
			statusCode: 404,
			error: 'Not Found',
			message: 'Resource not found'
		});
	});

	app.setErrorHandler((error, request: FastifyRequest, reply: FastifyReply<Server>) => {
		if (error instanceof NotFoundError) {
			request.log.info(error);
			reply.status(404).send({
				statusCode: 404,
				error: 'Not Found',
				message: 'Resource not found'
			});
			return;
		}
		if (error.validation ||
			error.statusCode === 400) {
			request.log.info(error);
			reply.status(400).send({
				statusCode: 400,
				error: 'Bad Request',
				message: error.message
			});
			return;
		}
		request.log.error(error);
		reply.status(500).send({
			statusCode: 500,
			error: 'Internal Server Error',
			message: 'Ups, something goes wrong.'
		});
	});

	return app;
}
