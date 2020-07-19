import { connect, getAndSetupDatabase } from './database';
import { buildAdminServer } from './admin-server';
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
import { buildEventProcessingServer } from './event-processing-server';
import { AppConfig } from './config';

export type App = {
    close(): Promise<void>;
    getAdminServer(): FastifyInstance;
    getEventProcessingServer(): FastifyInstance;
    getMetricsServer(): FastifyInstance;
    getDatabase(): Db
    getScheduler(): Scheduler;
}

export async function buildApp(config: AppConfig): Promise<App> {
    const dbClient = await connect(config.mongodb.url);
    const db = await getAndSetupDatabase(dbClient, config.mongodb.databaseName);
    const metrics = buildMetrics();
    const scheduler = buildScheduler(db);
    const eventTypesService = buildEventTypesService(db);
    const targetsService = buildTargetsService(db);
    const rulesService = buildRulesService(db, targetsService, eventTypesService, scheduler);
    const eventsService = buildEventsService(db);
    const rulesExecutionsService = buildRulesExecutionsService(db);
    const engine = buildEngine(eventTypesService, rulesService, targetsService, eventsService, rulesExecutionsService);
    const metricsServer = buildMetricsServer(metrics);
    const adminServer = buildAdminServer(config.adminHttp,
        eventTypesService, targetsService, rulesService, eventsService, rulesExecutionsService, metrics);
    const eventProcessingServer = buildEventProcessingServer(config.eventProcessingHttp, engine, metrics);
    scheduler.setJobHandler('execute-rule', buildExecuteRuleJobHandler(engine));
    return {
        async close() {
            await adminServer.close();
            await eventProcessingServer.close();
            await scheduler.stop();
            await metricsServer.close();
            await dbClient.close();
        },
        getAdminServer() {
            return adminServer;
        },
        getEventProcessingServer() {
            return eventProcessingServer;
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
