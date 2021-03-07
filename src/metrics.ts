import promClient, { Registry } from 'prom-client';

export type Metrics = {
    metrics(): Promise<string>;
    getRegister(): Registry;
}

export function buildMetrics(): Metrics {
    const register = new Registry();
    const collectDefaultMetrics = promClient.collectDefaultMetrics;
    collectDefaultMetrics({ register });

    return {
        metrics(): Promise<string> {
            return register.metrics();
        },
        getRegister(): Registry {
            return register;
        }
    };
}
