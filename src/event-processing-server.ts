import fastify, { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import packageInfo from '../package.json';
import fastifySwagger from 'fastify-swagger';
import NotFoundError from './errors/not-found-error';
import fastifyMetrics from 'fastify-metrics';
import logger from './logger';
import AjvErrors from 'ajv-errors';
import Ajv from 'ajv';
import { Server } from 'http';
import { Metrics } from './metrics';
import { Engine } from './engine';
import { buildEventProcessingRoutes } from './routes/events';

export type ServerOptions = {
	trustProxy: boolean;
	enableCors: boolean;
	enableSwagger: boolean;
};

export function buildEventProcessingServer(options: ServerOptions,
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

	if (options.enableSwagger) {
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
		reply.code(404).send({ message: 'Resource not found' });
	});

	app.setErrorHandler((error, request: FastifyRequest, reply: FastifyReply<Server>) => {
		if (error instanceof NotFoundError) {
			request.log.info(error);
			reply.status(404).send({ message: 'Resource not found' });
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
