import fastify, { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import logger from './logger';
import { Server } from 'http';
import { Metrics } from './metrics';

export function buildMetricsServer(metrics: Metrics): FastifyInstance {

	const app = fastify({ logger });

    app.get('/metrics', { logLevel: 'warn' }, (request, reply) => {
		const data = metrics.metrics();
        reply.type('text/plain').send(data);
    });

	app.setErrorHandler((error, request: FastifyRequest, reply: FastifyReply<Server>) => {
		request.log.error(error);
		reply.status(500).send(error);
	});

	return app;
}
