import Agenda from 'agenda';
import { Db } from 'mongodb';
import * as os from 'os';

export type Scheduler = {
    start(): Promise<void>;
    stop(): Promise<void>;
}

export function buildScheduler(db: Db): Scheduler {
    const agenda = new Agenda({
        processEvery: 1000,
        mongo: db,
        name: `${os.hostname}-${process.pid}`
    });
    return {
        start() {
            return agenda.start();
        },
        stop() {
            return agenda.stop();
        }
    };
}