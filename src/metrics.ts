import promClient, { Registry } from 'prom-client';

export type Metrics = {
    metrics(): string;
    getRegister(): Registry;
}

export function buildMetrics(): Metrics {
    const register = new Registry();
    const collectDefaultMetrics = promClient.collectDefaultMetrics;
    collectDefaultMetrics({ register });

    return {
        metrics(): string {
            return register.metrics();
        },
        getRegister(): Registry {
            return register;
        }
    };
}
