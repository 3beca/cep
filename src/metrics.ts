import promClient from 'prom-client';

export type Metrics = {
    metrics(): string;
}

export function buildMetrics(): Metrics {
    const register = new promClient.Registry();
    const collectDefaultMetrics = promClient.collectDefaultMetrics;
    collectDefaultMetrics({ register });

    return {
        metrics(): string {
            return register.metrics();
        }
    }
}