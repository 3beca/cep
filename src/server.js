import fastify from 'fastify';
import packageInfo from '../package.json';
import fastifySwagger from 'fastify-swagger';
import config from './config';
import adminRoute from './routes/admin/admin';
import NotFoundError from './errors/not-found-error.js';

export function buildServer() {
	const app = fastify({
		logger: false
	});

	app.register(fastifySwagger, {
		routePrefix: '/documentation',
		exposeRoute: true,
		swagger: {
			info: {
				title: packageInfo.title,
				description: packageInfo.description,
				version: packageInfo.version
			},
			externalDocs: {
				url: packageInfo.homepage,
				description: 'Find more info here'
			},
			host: config.externalHttp.host + (config.externalHttp.port ? ':' + config.externalHttp.port : ''),
			schemes: ['http'],
			consumes: ['application/json'],
			produces: ['application/json']
		}
	});

	// End points
	app.register(adminRoute, { prefix: '/admin' });

	app.setNotFoundHandler({
		preValidation: (req, reply, next) => {
			// your code
			next();
		},
		preHandler: (req, reply, next) => {
			// your code
			next();
		}
	}, function(request, reply) {
		// Default not found handler with preValidation and preHandler hooks
		reply.code(404).send({ message: 'Resource not found' });
	});

	app.setErrorHandler((error, request, reply) => {
		if (error instanceof NotFoundError) {
			reply.status(404).send({ message: 'Resource not found' });
		}
		if (error.validation) {
			reply.status(400).send(error);
		}
		reply.status(500).send({ message: 'Ups, something goes wrong' });
	});

	return app;
}
