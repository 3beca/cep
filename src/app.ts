import { connect, getAndSetupDatabase } from './database';
import { buildServer } from './server';
import { buildEventTypesService } from './services/event-types-service';
import { buildTargetsService } from './services/targets-service';
import { buildRulesService } from './services/rules-services';
import { buildEngine } from './engine';
import { buildEventsService } from './services/events-service';
import { buildRulesExecutionsService } from './services/rules-executions-service';
import { buildSchedulerService } from './services/scheduler-service';

export type AppOptions = {
    databaseUrl: string,
    databaseName: string,
    trustProxy: boolean,
    enableCors: boolean,
    scheduler: {
        protocol: string;
        host: string;
        port: string;
    },
    internalHttp: {
        protocol: string;
        host: string;
        port: string;
    }
};

export async function buildApp(options: AppOptions) {
    const { databaseName, databaseUrl, trustProxy, enableCors, scheduler, internalHttp } = options;
    const dbClient = await connect(databaseUrl);
    const db = await getAndSetupDatabase(dbClient, databaseName);
    const eventTypesService = buildEventTypesService(db);
    const targetsService = buildTargetsService(db);
    const schedulerService = buildSchedulerService(scheduler);
    const rulesService = buildRulesService(db, internalHttp, targetsService, eventTypesService, schedulerService);
    const eventsService = buildEventsService(db);
    const rulesExecutionsService = buildRulesExecutionsService(db);
    const engine = buildEngine(eventTypesService, rulesService, targetsService, eventsService, rulesExecutionsService);
    const server = buildServer({ trustProxy, enableCors },
        eventTypesService, targetsService, rulesService, eventsService, rulesExecutionsService, engine);
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
