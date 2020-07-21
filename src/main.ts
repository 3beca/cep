import { buildConfig } from './config';
import gracefulShutdown from './graceful-shutdown';
import 'make-promises-safe';
import logger from './logger';
import { buildApp } from './app';

async function main() {
    logger.info('Starting cep service');

    const config = buildConfig();
    const { adminHttp, metricsHttp, eventProcessingHttp } = config;
    const app = await buildApp(config);

    await app.getMetricsServer().listen(metricsHttp.port, metricsHttp.host);
    logger.info(`Started cep metrics http server. Listening at port ${metricsHttp.port}`);

    await app.getScheduler().start();
    logger.info('Started cep scheduler');

    await app.getEventProcessingServer().listen(eventProcessingHttp.port, eventProcessingHttp.host);
    logger.info(`Started cep event processing http server. Listening at port ${eventProcessingHttp.port}`);

    await app.getAdminServer().listen(adminHttp.port, adminHttp.host);
    logger.info(`Started cep admin http server. Listening at port ${adminHttp.port}`);

    process.on('SIGTERM', gracefulShutdown(app));
    process.on('SIGINT', gracefulShutdown(app));
}

main().catch(error => {
    logger.error('Error while starting up - ' + error.message);
    process.exit(1);
});
