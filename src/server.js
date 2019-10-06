import fastify from 'fastify';

export function buildServer() {
	const app = fastify({
		logger: true
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
