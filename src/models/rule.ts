import { ObjectId } from 'mongodb';
import { Group } from './group';
import { WindowSize } from './window-size';

export type RuleTypes = 'realtime' | 'sliding' | 'tumbling';

type BaseRule = {
    id: ObjectId;
    name: string;
    type: RuleTypes;
    eventTypeId: ObjectId;
    targetId: ObjectId;
    filters?: any;
    skipOnConsecutivesMatches: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export type RealTimeRule = {
    type: 'realtime';
} & BaseRule;

export type SlidingRule = {
    type: 'sliding';
    group: Group;
    windowSize: WindowSize;
} & BaseRule;

export type TumblingRule = {
    type: 'tumbling';
    group: Group;
    windowSize: WindowSize;
    jobId: ObjectId;
} & BaseRule;

export type Rule = RealTimeRule | SlidingRule | TumblingRule;
