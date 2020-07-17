import Agenda, { JobAttributesData } from 'agenda';
import { Db, ObjectId } from 'mongodb';
import * as os from 'os';
import logger from './logger';
import { JobHandler } from './jobs-handlers/job-handler';
import { JobData } from './jobs-handlers/job-data';

export type Scheduler = {
    start(): Promise<void>;
    stop(): Promise<void>;
    setJobHandler(name: string, jobHandler: JobHandler): void;
    getJobHandler(name: string): JobHandler;
    scheduleJob(when: string, name: string, data: JobData): Promise<ObjectId>;
    cancelJob(id: ObjectId): Promise<void>;
}

export function buildScheduler(db: Db): Scheduler {
    const agenda = new Agenda({
        processEvery: 1000,
        mongo: db,
        name: `${os.hostname}-${process.pid}`
    });
    const jobHandlers: { [key:string]: JobHandler } = {};
    return {
        start() {
            return agenda.start();
        },
        stop() {
            return agenda.stop();
        },
        setJobHandler(name: string, jobHandler: JobHandler): void {
            jobHandlers[name] = jobHandler;
            agenda.define(name, (jobData: JobAttributesData, done: (err?: Error) => void) => {
                jobHandler(jobData)
                    .then(() => done())
                    .catch(error => {
                        logger.error(error);
                        done(error);
                    });
            });
        },
        getJobHandler(name: string): JobHandler {
            return jobHandlers[name];
        },
        async scheduleJob(when: string, name: string, data: JobData): Promise<ObjectId> {
            const job = await agenda.schedule(when, name, data);
            return job.attrs._id;
        },
        async cancelJob(id: ObjectId): Promise<void> {
            await agenda.cancel({ _id: id });
        }
    };
}
