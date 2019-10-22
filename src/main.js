import { buildServer } from './server';
import config from './config';
import gracefulShutdown from './graceful-shutdown';
import 'make-promises-safe';
import { buildEventTypesService } from './services/event-types-service';
import { buildTargetsService } from './services/targets-service';
import { buildRulesService } from './services/rules-services';
import { buildEngine } from './engine';
import { connect, getAndSetupDatabase } from './database';
import logger from './logger';

async function main() {
    const { port, host } = config.http;
    const { url, databaseName } = config.mongodb;

    logger.info('starting cep service');

    const dbClient = await connect(url);
    const db = await getAndSetupDatabase(dbClient, databaseName);
    const eventTypesService = buildEventTypesService(db);
    const targetsService = buildTargetsService(db);
    const rulesService = buildRulesService(db, targetsService, eventTypesService);
    const engine = buildEngine(eventTypesService, rulesService, targetsService);
    const server = buildServer(eventTypesService, targetsService, rulesService, engine);
    await server.listen(port, host);

    logger.info('started cep service. Listening at port', port);

    process.on('SIGTERM', gracefulShutdown(server, dbClient));
    process.on('SIGINT', gracefulShutdown(server, dbClient));
}

main().catch(error => {
    console.error('error while starting up', error);
    process.exit(1);
});
