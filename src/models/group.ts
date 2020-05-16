export type OperatorAvg = {
    _avg: string;
};

export type OperatorMin = {
    _min: string;
};

export type OperatorMax = {
    _max: string;
};

export type OperatorSum = {
    _sum: number | string;
};

export type OperatorStdDevPop = {
    _stdDevPop: string;
};

export type OperatorStdDevSample = {
    _stdDevSample: string;
};

export type Operator = OperatorAvg | OperatorMax | OperatorMin | OperatorSum | OperatorStdDevPop | OperatorStdDevSample;

export type Group = {
    [key: string]: Operator
}
