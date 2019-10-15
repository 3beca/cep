import { buildServer } from './server';
import config from './config';
import gracefulShutdown from './graceful-shutdown';
import 'make-promises-safe';
import { buildEventTypesService } from './services/event-types-service';
import { buildTargetsService } from './services/targets-service';
import { buildRulesService } from './services/rules-services';
import { buildEngine } from './engine';

async function main() {
    const { port, host } = config.http;

    const eventTypesService = buildEventTypesService();
    const targetsService = buildTargetsService();
    const rulesService = buildRulesService(targetsService, eventTypesService);
    const engine = buildEngine(eventTypesService, rulesService, targetsService);
    const server = buildServer(eventTypesService, targetsService, rulesService, engine);

    await server.listen(port, host);

    process.on('SIGTERM', gracefulShutdown(server));
    process.on('SIGINT', gracefulShutdown(server));
}

main().catch(error => {
    console.error('error while starting up', error);
    process.exit(1);
});
