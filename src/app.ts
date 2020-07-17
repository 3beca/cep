import { connect, getAndSetupDatabase } from './database';
import { buildServer } from './server';
import { buildEventTypesService } from './services/event-types-service';
import { buildTargetsService } from './services/targets-service';
import { buildRulesService } from './services/rules-services';
import { buildEngine } from './engine';
import { buildEventsService } from './services/events-service';
import { buildRulesExecutionsService } from './services/rules-executions-service';
import { FastifyInstance } from 'fastify';
import { Db } from 'mongodb';
import { buildMetricsServer } from './metrics-server';
import { buildMetrics } from './metrics';
import { buildScheduler, Scheduler } from './scheduler';
import buildExecuteRuleJobHandler from './jobs-handlers/execute-rule-job-handler';

export type AppOptions = {
    databaseUrl: string,
    databaseName: string,
    trustProxy: boolean,
    enableCors: boolean
};

export type App = {
    close(): Promise<void>;
    getServer(): FastifyInstance;
    getMetricsServer(): FastifyInstance;
    getDatabase(): Db
    getScheduler(): Scheduler;
}

export async function buildApp(options: AppOptions): Promise<App> {
    const { databaseName, databaseUrl, trustProxy, enableCors } = options;
    const dbClient = await connect(databaseUrl);
    const db = await getAndSetupDatabase(dbClient, databaseName);
    const metrics = buildMetrics();
    const scheduler = buildScheduler(db);
    const eventTypesService = buildEventTypesService(db);
    const targetsService = buildTargetsService(db);
    const rulesService = buildRulesService(db, targetsService, eventTypesService, scheduler);
    const eventsService = buildEventsService(db);
    const rulesExecutionsService = buildRulesExecutionsService(db);
    const engine = buildEngine(eventTypesService, rulesService, targetsService, eventsService, rulesExecutionsService);
    const metricsServer = buildMetricsServer(metrics);
    const server = buildServer({ trustProxy, enableCors },
        eventTypesService, targetsService, rulesService, eventsService, rulesExecutionsService, engine, metrics);
    scheduler.setJobHandler('execute-rule', buildExecuteRuleJobHandler(engine));
    return {
        async close() {
            await server.close();
            await scheduler.stop();
            await metricsServer.close();
            await dbClient.close();
        },
        getServer() {
            return server;
        },
        getMetricsServer() {
            return metricsServer;
        },
        getDatabase() {
            return db;
        },
        getScheduler() {
            return scheduler;
        }
    };
}
