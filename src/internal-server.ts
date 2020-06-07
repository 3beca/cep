import fastify, { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import packageInfo from '../package.json';
import fastifySwagger from 'fastify-swagger';
import config from './config';
import NotFoundError from './errors/not-found-error';
import InvalidOperationError from './errors/invalid-operation-error';
import logger from './logger';
import AjvErrors from 'ajv-errors';
import Ajv from 'ajv';
import { ServerResponse } from 'http';
import { Engine } from './engine';
import { buildExecuteRuleRoutes } from './routes/internal/execute-rule';

export function buildInternalServer(engine: Engine): FastifyInstance {

	const app = fastify({
		logger
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
	app.setSchemaCompiler(schema => ajv.compile(schema));

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
				{ name: 'rules', description: 'Rules related end-points' }
			],
			host: `${config.internalHttp.host}:${config.internalHttp.port}`,
			schemes: [config.internalHttp.protocol],
			consumes: ['application/json'],
			produces: ['application/json']
		}
	});

	// End points
	app.register(buildExecuteRuleRoutes(engine));

	app.setNotFoundHandler(function(request, reply: FastifyReply<ServerResponse>) {
		// Default not found handler with preValidation and preHandler hooks
		reply.code(404).send({ message: 'Resource not found' });
	});

	app.setErrorHandler((error, request: FastifyRequest, reply: FastifyReply<ServerResponse>) => {
		if (error instanceof NotFoundError) {
			request.log.info(error);
			reply.status(404).send({ message: 'Resource not found' });
			return;
		}
		if (error instanceof InvalidOperationError ||
			error.validation) {
			request.log.info(error);
			reply.status(400).send(error);
			return;
		}
		request.log.error(error);
		reply.status(error.statusCode ?? 500).send(error);
	});

	return app;
}
