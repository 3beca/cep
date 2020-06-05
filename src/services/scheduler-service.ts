import fetch from 'node-fetch';
import { Job } from '../models/job';
import { ObjectId } from 'mongodb';

export type SchedulerService = {
    create(job: Omit<Job, 'id'>): Promise<Job>;
    delete(jobId: ObjectId): Promise<void>;
}

export type SchedulerOptions = {
    protocol: string;
    host: string;
    port: string;
};

export function buildSchedulerService(options: SchedulerOptions): SchedulerService {
    const { protocol, host, port } = options;
    const schedulerApiBaseUrl = `${protocol}://${host}:${port}`;

    return {
        async create(job: Omit<Job, 'id'>): Promise<Job> {
            const response = await fetch(`${schedulerApiBaseUrl}/jobs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(job)
            });
            if (!response.ok) {
                throw new Error(response.statusText);
            }
            const { id, ...rest } = await response.json();
            return {
                id: ObjectId.createFromHexString(id),
                ...rest
            };
        },
        async delete(jobId: ObjectId): Promise<void> {
            const response = await fetch(`${schedulerApiBaseUrl}/jobs/${jobId}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                throw new Error(response.statusText);
            }
        }
    };
}
