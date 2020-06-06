import { connect, getAndSetupDatabase } from './database';
import { buildServer } from './server';
import { buildEventTypesService } from './services/event-types-service';
import { buildTargetsService } from './services/targets-service';
import { buildRulesService } from './services/rules-services';
import { buildEngine } from './engine';
import { buildEventsService } from './services/events-service';
import { buildRulesExecutionsService } from './services/rules-executions-service';
import { buildSchedulerService } from './services/scheduler-service';
import { buildInternalServer } from './internal-server';
import { FastifyInstance } from 'fastify';
import { Db } from 'mongodb';

export type AppOptions = {
    databaseUrl: string,
    databaseName: string,
    trustProxy: boolean,
    enableCors: boolean,
    scheduler: {
        protocol: string;
        host: string;
        port: number;
    },
    internalHttp: {
        protocol: string;
        host: string;
        port: number;
    }
};

export type App = {
    close(): Promise<void>;
    getServer(): FastifyInstance;
    getInternalServer(): FastifyInstance;
    getDatabase(): Db
}

export async function buildApp(options: AppOptions): Promise<App> {
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
    const internalServer = buildInternalServer(engine);
    const server = buildServer({ trustProxy, enableCors },
        eventTypesService, targetsService, rulesService, eventsService, rulesExecutionsService, engine);
    return {
        async close() {
            await server.close();
            await internalServer;
            await dbClient.close();
        },
        getServer() {
            return server;
        },
        getInternalServer() {
            return internalServer;
        },
        getDatabase() {
            return db;
        }
    };
}
