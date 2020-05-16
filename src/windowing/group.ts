import GroupError from './group-error';
import { Group, Operator } from '../models/group';

const reseveredSymbols = ['.', '$', '_'];
const operatorSupportedValueTypes = {
    '_avg': ['string'],
    '_min': ['string'],
    '_max': ['string'],
    '_sum': ['string', 'number'],
    '_stdDevPop': ['string'],
    '_stdDevSample': ['string']
};
const supportedOperators = Object.keys(operatorSupportedValueTypes);

function assertKeyDoNotContainReservedSymbols(key: string): void {
    for (const symbol of reseveredSymbols) {
        if (key.includes(symbol)) {
            throw new GroupError(`Group field '${key}' contains reserved symbol '${symbol}'`);
        }
    }
}

function assertIsValidOperator(fieldName: string, operator: Operator): void {
    if (!operator) {
        throw new GroupError(`Group field '${fieldName}' cannot be undefined`);
    }
    if (typeof operator !== 'object') {
        throw new GroupError(`Group field '${fieldName}' must be an object`);
    }
    const keys = Object.keys(operator);
    if (keys.length !== 1) {
        throw new GroupError(`Group field '${fieldName}' must have one operator`);
    }
    const key = keys[0];
    if (!supportedOperators.includes(key)) {
        throw new GroupError(`Group field '${fieldName}' has got an unknown and not supported operator '${key}'`);
    }
    const value = operator[key];
    const typeOfValue = typeof value;
    if (!operatorSupportedValueTypes[key].includes(typeOfValue)) {
        throw new GroupError(`Group field '${fieldName}' has got operator '${key}' with invalid type '${typeOfValue}'`);
    }

    if (typeOfValue === 'string' && value[0] !== '_') {
        throw new GroupError(`Group field '${fieldName}' operator value must start with '_' symbol`);
    }
}

export function assertIsValid(options: Group): void {
    if (!options) {
        throw new GroupError('Group cannot be null nor undefined');
    }
    if (typeof options !== 'object') {
        throw new GroupError('Group must be an object');
    }
    const keys = Object.keys(options);
    if (keys.length === 0) {
        throw new GroupError('Group must have at least a grouping operator field');
    }
    keys.forEach(key => {
        assertKeyDoNotContainReservedSymbols(key);
        assertIsValidOperator(key, options[key]);
    });
}
