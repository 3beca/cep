import fastify from 'fastify';
import packageInfo from '../package.json';
import fastifySwagger from 'fastify-swagger';
import config from './config';
import adminRoute from './routes/admin/admin';
import eventsRoute from './routes/events';
import NotFoundError from './errors/not-found-error';
import ConflictError from './errors/conflict-error';
import { getExternalUrl } from './utils/url.js';

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
			tags: [
				{ name: 'system', description: 'System related end-points' },
				{ name: 'event types', description: 'Event Types related end-points' },
				{ name: 'targets', description: 'Targets related end-points' },
				{ name: 'rules', description: 'Rules related end-points' },
				{ name: 'event processing', description: 'Event processing related end-points' }
			],
			host: config.externalHttp.host + (config.externalHttp.port ? ':' + config.externalHttp.port : ''),
			schemes: [config.externalHttp.protocol],
			consumes: ['application/json'],
			produces: ['application/json']
		}
	});

	// End points
	app.register(adminRoute, { prefix: '/admin' });
	app.register(eventsRoute);

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
			return;
		}
		if (error instanceof ConflictError) {
			reply.header('Location', getExternalUrl(`${request.raw.originalUrl}/${error.id}`));
			reply.status(409).send({ message: error.message });
			return;
		}
		if (error.validation) {
			reply.status(400).send(error);
			return;
		}
		reply.status(500).send({ message: 'Ups, something goes wrong' });
	});

	return app;
}
