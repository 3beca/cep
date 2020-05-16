import { assertIsValid } from '../../src/windowing/group';
import { Group } from '../../src/models/group';

describe('group', () => {

    describe('assertIsValid', () => {

        it('should throw an error if Group is undefined', () => {
            const act = () => assertIsValid(undefined as unknown as Group);
            expect(act).toThrow('Group cannot be null nor undefined');
        });

        it('should throw an error if Group is not an object', () => {
            const act = () => assertIsValid('this is a string' as unknown as Group);
            expect(act).toThrow('Group must be an object');
        });

        it('should throw an error if Group has no fields', () => {
            const act = () => assertIsValid({});
            expect(act).toThrow('Group must have at least a grouping operator field');
        });

        ['.', '_', '$'].forEach(symbol => {
            it(`should throw an error if Group has a field with reserved symbol '${symbol}'`, () => {
                const group = {};
                group[`${symbol}myfield`] = { '_avg': '_data' };
                const act = () => assertIsValid(group);
                expect(act).toThrow(`Group field '${symbol}myfield' contains reserved symbol '${symbol}'`);
            });
        });

        it('should throw an error if grouping operator field is undefined', () => {
            const act = () => assertIsValid({
                field: undefined
            } as unknown as Group);
            expect(act).toThrow('Group field \'field\' cannot be undefined');
        });

        it('should throw an error if grouping operator field is not an object', () => {
            const act = () => assertIsValid({
                field: 'string'
            } as unknown as Group);
            expect(act).toThrow('Group field \'field\' must be an object');
        });

        it('should throw an error if grouping operator field has no operators', () => {
            const act = () => assertIsValid({
                field: {}
            } as unknown as Group);
            expect(act).toThrow('Group field \'field\' must have one operator');
        });

        it('should throw an error if grouping operator field has more than one operators', () => {
            const act = () => assertIsValid({
                field: {
                    _avg: 'a',
                    _min: 'b'
                }
            } as unknown as Group);
            expect(act).toThrow('Group field \'field\' must have one operator');
        });

        it('should throw an error if grouping operator field is unsupported', () => {
            const act = () => assertIsValid({
                field: { '_unsupported': 'a' }
            } as unknown as Group);
            expect(act).toThrow('Group field \'field\' has got an unknown and not supported operator \'_unsupported\'');
        });

        [{
            operator: '_avg',
            types: ['string'],
            value: 1
        }, {
            operator: '_min',
            types: ['string'],
            value: new Date()
        }, {
            operator: '_max',
            types: ['string'],
            value: 10
        }, {
            operator: '_sum',
            types: ['string', 'number'],
            value: new Date()
        }, {
            operator: '_stdDevPop',
            types: ['string'],
            value: 20
        }, {
            operator: '_stdDevSamp',
            types: ['string'],
            value: 30
        }].forEach(testCase => {
            it(`should throw an error if grouping operator field with operator ${testCase.operator} has no value of types ${testCase.types.join(' or ')}`, () => {
                const operator = {};
                operator[testCase.operator] = testCase.value;
                const act = () => assertIsValid({
                    field: operator
                } as unknown as Group);
                expect(act).toThrow(`Group field 'field' has got operator '${testCase.operator}' with invalid type '${typeof testCase.value}'`);
            });
        });

        it('should throw an error if grouping operator field value do not start with _ symbol', () => {
            const act = () => assertIsValid({
                field: { '_avg': 'a' }
            } as unknown as Group);
            expect(act).toThrow('Group field \'field\' operator value must start with \'_\' symbol');
        });

        it('should not throw an error if group is valid', () => {
            const act = () => assertIsValid({
                avgPrice: { '_avg': '_price' },
                count: { '_sum': 1 },
                countQuantity: { '_sum': '_quantity' },
                minQuantity: { '_min': '_quantity' },
                maxQuantity: { '_max': '_quantity' },
                stdDevPopQuantity: { '_stdDevPop': '_quantity' },
                stdDevSampleQuantity: { '_stdDevSamp': '_quantity' }
            } as unknown as Group);
            expect(act).not.toThrow();
        });
    });
});
