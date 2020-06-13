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
import { buildMetricsServer } from './metrics-server';
import { buildMetrics } from './metrics';

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
    getMetricsServer(): FastifyInstance;
    getDatabase(): Db
}

export async function buildApp(options: AppOptions): Promise<App> {
    const { databaseName, databaseUrl, trustProxy, enableCors, scheduler, internalHttp } = options;
    const dbClient = await connect(databaseUrl);
    const db = await getAndSetupDatabase(dbClient, databaseName);
    const metrics = buildMetrics();
    const eventTypesService = buildEventTypesService(db);
    const targetsService = buildTargetsService(db);
    const schedulerService = buildSchedulerService(scheduler);
    const rulesService = buildRulesService(db, internalHttp, targetsService, eventTypesService, schedulerService);
    const eventsService = buildEventsService(db);
    const rulesExecutionsService = buildRulesExecutionsService(db);
    const engine = buildEngine(eventTypesService, rulesService, targetsService, eventsService, rulesExecutionsService);
    const metricsServer = buildMetricsServer(metrics);
    const internalServer = buildInternalServer(engine);
    const server = buildServer({ trustProxy, enableCors },
        eventTypesService, targetsService, rulesService, eventsService, rulesExecutionsService, engine);
    return {
        async close() {
            await server.close();
            await internalServer.close();
            await metricsServer.close();
            await dbClient.close();
        },
        getServer() {
            return server;
        },
        getInternalServer() {
            return internalServer;
        },
        getMetricsServer() {
            return metricsServer;
        },
        getDatabase() {
            return db;
        }
    };
}
