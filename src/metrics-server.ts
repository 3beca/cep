import fastify, { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import logger from './logger';
import { ServerResponse } from 'http';

export function buildMetricsServer(): FastifyInstance {

	const app = fastify({ logger });

    app.get('/metrics', { logLevel: 'warn' }, (request, reply) => {
        reply.type('text/plain').send('metrics');
    });

	app.setErrorHandler((error, request: FastifyRequest, reply: FastifyReply<ServerResponse>) => {
		request.log.error(error);
		reply.status(500).send(error);
	});

	return app;
}
