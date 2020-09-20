import Agenda, { JobAttributesData, Job } from 'agenda';
import { Db, ObjectId } from 'mongodb';
import * as os from 'os';
import { JobHandler } from './jobs-handlers/job-handler';
import { JobData } from './jobs-handlers/job-data';
import logger from './logger';

export type Scheduler = {
    start(): Promise<void>;
    stop(): Promise<void>;
    setJobHandler(name: string, jobHandler: JobHandler): void;
    getJobHandler(name: string): JobHandler;
    scheduleJob(interval: string, name: string, data: JobData): Promise<ObjectId>;
    cancelJob(id: ObjectId): Promise<void>;
    onJobComplete(fn: (id: ObjectId, name: string, data: JobData) => void): void;
    onJobError(fn: (id: ObjectId, name: string, data: JobData, error: Error) => void): void
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
            agenda.define(name, (job: Job<JobAttributesData>, done: (err?: Error) => void) => {
                jobHandler(job.attrs.data)
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
        async scheduleJob(interval: string, name: string, data: JobData): Promise<ObjectId> {
            const job = agenda.create(name, data);
            job.repeatEvery(interval);
            await job.save();
            return job.attrs._id;
        },
        async cancelJob(id: ObjectId): Promise<void> {
            await agenda.cancel({ _id: id });
        },
        onJobComplete(fn: (id: ObjectId, name: string, data: JobData) => void): void {
            agenda.on('complete', (job: Job) => {
                fn(job.attrs._id, job.attrs.name, job.attrs.data);
            });
        },
        onJobError(fn: (id: ObjectId, name: string, data: JobData, error: Error) => void): void {
            agenda.on('fail', (err: Error, job: Job) => {
                fn(job.attrs._id, job.attrs.name, job.attrs.data, err);
            });
        }
    };
}
