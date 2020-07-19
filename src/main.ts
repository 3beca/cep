import { buildAppConfig } from './config';
import gracefulShutdown from './graceful-shutdown';
import 'make-promises-safe';
import logger from './logger';
import { buildApp } from './app';

async function main() {
    logger.info('starting cep service');

    const config = buildAppConfig();
    const { adminHttp, metricsHttp, eventProcessingHttp } = config;
    const app = await buildApp(config);

    await app.getMetricsServer().listen(metricsHttp.port, metricsHttp.host);
    logger.info('started cep metrics http server. Listening at port', metricsHttp.port);

    await app.getScheduler().start();
    logger.info('started cep scheduler');

    await app.getEventProcessingServer().listen(eventProcessingHttp.port, eventProcessingHttp.host);
    logger.info('started cep event processing http server. Listening at port', eventProcessingHttp.port);

    await app.getAdminServer().listen(adminHttp.port, adminHttp.host);
    logger.info('started cep admin http server. Listening at port', adminHttp.port);

    process.on('SIGTERM', gracefulShutdown(app));
    process.on('SIGINT', gracefulShutdown(app));
}

main().catch(error => {
    logger.error('error while starting up', error);
    process.exit(1);
});
