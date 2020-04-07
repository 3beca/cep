import { connect, getAndSetupDatabase } from './database';
import { buildServer } from './server';
import { buildEventTypesService } from './services/event-types-service';
import { buildTargetsService } from './services/targets-service';
import { buildRulesService } from './services/rules-services';
import { buildEngine } from './engine';
import { buildEventsService } from './services/events-service';

export type AppOptions = {
    databaseUrl: string,
    databaseName: string,
    trustProxy: boolean,
    enableCors: boolean
};

export async function buildApp(options: AppOptions) {
    const { databaseName, databaseUrl, trustProxy, enableCors } = options;
    const dbClient = await connect(databaseUrl);
    const db = await getAndSetupDatabase(dbClient, databaseName);
    const eventTypesService = buildEventTypesService(db);
    const targetsService = buildTargetsService(db);
    const rulesService = buildRulesService(db, targetsService, eventTypesService);
    const eventsService = buildEventsService(db);
    const engine = buildEngine(eventTypesService, rulesService, targetsService, eventsService);
    const server = buildServer({ trustProxy, enableCors }, eventTypesService, targetsService, rulesService, eventsService, engine);
    return {
        async close() {
            await server.close();
            await dbClient.close();
        },
        getServer() {
            return server;
        },
        getDatabase() {
            return db;
        }
    };
}
