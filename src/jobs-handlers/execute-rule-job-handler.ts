import { Engine } from '../engine';
import { JobHandler } from './job-handler';
import { JobData } from './job-data';

export default function buildExecuteRuleJobHandler(engine: Engine): JobHandler {
    return function executeRuleJobHandler(data: JobData) {
        return engine.executeRule(data.ruleId, 'TODO');
    };
}
