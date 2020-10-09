import { Engine } from '../engine';
import { JobHandler } from './job-handler';
import { ExecuteRuleJobData } from './execute-rule-job-data';

export default function buildExecuteRuleJobHandler(engine: Engine): JobHandler {
    let i = 0;
    return function executeRuleJobHandler(data: ExecuteRuleJobData): Promise<void> {
        return engine.executeTumblingRule(data.ruleId, (i++).toString());
    };
}
