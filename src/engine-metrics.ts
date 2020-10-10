import { Metrics } from './metrics';
import { Rule } from './models/rule';
import { Histogram } from 'prom-client';

export type EngineMetrics = {
    logRuleExecution(rule: Rule, match: boolean, skip: boolean, targetSuccess: boolean | undefined, duration: number): void;
}

export function buildEngineMetrics(metrics: Metrics): EngineMetrics {

    const register = metrics.getRegister();
    const ruleExecutionsHistogram = new Histogram({
        name: 'cep_rule_executions_duration_seconds',
        help: 'rule executions duration in seconds',
        labelNames: ['eventTypeId', 'ruleId', 'ruleType', 'match', 'skip', 'targetId', 'targetSuccess'],
        buckets: [0.05, 0.1, 0.5, 1, 3, 5, 10],
        registers: [ register ]
    });

    return {
        logRuleExecution(rule: Rule, match: boolean, skip: boolean, targetSuccess: boolean | undefined, duration: number): void {
            ruleExecutionsHistogram
                .labels(
                    rule.eventTypeId.toHexString(),
                    rule.id.toHexString(),
                    rule.type,
                    match.toString(),
                    skip.toString(),
                    rule.targetId.toHexString(),
                    targetSuccess !== undefined ? targetSuccess.toString() : 'n/a')
                .observe(duration);
        }
    };
}
