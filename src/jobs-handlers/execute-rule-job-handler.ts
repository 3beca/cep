import { Engine } from '../engine';

export default function buildExecuteRuleJobHandler(engine: Engine): (data) => Promise<void> {
    return function executeRuleJobHandler(data) {
        return engine.executeRule(data.ruleId, 'TODO');
    };
}
