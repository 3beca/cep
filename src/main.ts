import config from './config';
import gracefulShutdown from './graceful-shutdown';
import 'make-promises-safe';
import logger from './logger';
import { buildApp } from './app';

async function main() {
    const { port, host } = config.http;
    const { databaseUrl, databaseName } = config.mongodb;
    const { trustProxy, enableCors, metricsHttp } = config;

    logger.info('starting cep service');

    const options = { databaseUrl, databaseName, trustProxy, enableCors };
    const app = await buildApp(options);

    await app.getMetricsServer().listen(metricsHttp.port, metricsHttp.host);
    logger.info('started cep metrics service. Listening at port', metricsHttp.port);

    await app.getScheduler().start();
    logger.info('started cep scheduler');

    await app.getServer().listen(port, host);
    logger.info('started cep public service. Listening at port', port);

    process.on('SIGTERM', gracefulShutdown(app));
    process.on('SIGINT', gracefulShutdown(app));
}

main().catch(error => {
    logger.error('error while starting up', error);
    process.exit(1);
});
