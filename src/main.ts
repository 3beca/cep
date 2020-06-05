import config from './config';
import gracefulShutdown from './graceful-shutdown';
import 'make-promises-safe';
import logger from './logger';
import { buildApp } from './app';

async function main() {
    const { port, host } = config.http;
    const { databaseUrl, databaseName } = config.mongodb;
    const { trustProxy, enableCors, scheduler, internalHttp } = config;

    logger.info('starting cep service');

    const options = { databaseUrl, databaseName, trustProxy, enableCors, scheduler, internalHttp };
    const app = await buildApp(options);

    await app.getInternalServer().listen(internalHttp.port, host);
    logger.info('started cep internal service. Listening at port', internalHttp.port);

    await app.getServer().listen(port, host);
    logger.info('started cep public service. Listening at port', port);

    process.on('SIGTERM', gracefulShutdown(app));
    process.on('SIGINT', gracefulShutdown(app));
}

main().catch(error => {
    console.error('error while starting up', error);
    process.exit(1);
});
