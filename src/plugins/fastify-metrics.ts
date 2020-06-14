import { FastifyInstance, Plugin } from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import promClient, {
    HistogramConfiguration,
    SummaryConfiguration,
} from 'prom-client';
import { IncomingMessage, ServerResponse, Server } from 'http';

export type PluginOptions = {
    register: promClient.Registry;
    prefix: string;
}

/**
 * This plugin is inspired by https://github.com/SkeLLLa/fastify-metrics.
 * Due to the issue https://github.com/SkeLLLa/fastify-metrics/issues/8 we cannot use the plugin.
 * The issue is fixed in fastify v3.0, so when fastify v3.0 will be officially released
 * we will remove it and use directly the fastify-metrics plugin.
 */
const fastifyMetricsPlugin: Plugin<
  Server,
  IncomingMessage,
  ServerResponse,
  PluginOptions
> = function fastifyMetrics(
  fastify: FastifyInstance,
  options: PluginOptions,
  next: fastifyPlugin.nextCallback
) {
    const { register, prefix } = options;
    const histogram: HistogramConfiguration<string> = {
        name: `${prefix}http_request_duration_seconds`,
        help: 'request duration in seconds',
        labelNames: ['status_code', 'method', 'route'],
        buckets: [0.05, 0.1, 0.25, 0.5, 1, 3, 5, 10],
        registers: [register]
    };
    const summary: SummaryConfiguration<string> = {
        name: `${prefix}http_request_summary_seconds`,
        help: 'request duration in seconds summary',
        labelNames: ['status_code', 'method', 'route'],
        percentiles: [0.5, 0.9, 0.95, 0.99],
        registers: [register]
    };

    const routeHist = new promClient.Histogram(histogram);
    const routeSum = new promClient.Summary(summary);

    fastify.addHook('onRequest', (request, _, next) => {
        (request as any).metrics = {
            hist: routeHist.startTimer(),
            sum: routeSum.startTimer(),
        };
        next();
    });

    fastify.addHook('onResponse', function(request, reply, next) {
        const { statusCode } = reply.res;
        const { method, url: routeId } = request.req;

        (request as any).metrics.sum({
            method,
            route: routeId,
            status_code: statusCode,
        });
        (request as any).metrics.hist({
            method,
            route: routeId,
            status_code: statusCode,
        });
        next();
    });

    fastify.decorate('metrics', {});
    next();
};

export default fastifyPlugin(fastifyMetricsPlugin, {
  fastify: '>=2.0.0',
  name: 'fastify-metrics',
});
