import fastify from 'fastify';
import packageInfo from '../package.json';
import fastifySwagger from 'fastify-swagger';

export function buildServer() {
	const app = fastify({
		logger: true
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
			host: 'localhost',
			schemes: ['http'],
			consumes: ['application/json'],
			produces: ['application/json']
		}
	});

	// End points
	app.register(function test(fastify, options, next) {
		fastify.post('/test', options, () => {
			return { success: true };
		});
		next();
	});

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

	return app;
}
