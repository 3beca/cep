import Filter from '../../src/filters/filter';

describe('Filter', () => {

    describe('match', () => {

        it('should return true when filters are null or undefined', () => {
            const data = { level: 10 },
                filters = null,
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(true);
        });

        it('should return false when data payload is null or undefined', () => {
            const data = null,
                filters = { level: { '_eq': 10 } },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(false);
        });

        it('should throw an Error when filter contains an invalid operator', () => {
            const data = {level: 10 },
                filters = { level: { '_invalidOperator': 10 } },
                filter = new Filter(filters);

            const act = () => filter.match(data);

            expect(act).toThrow('_invalidOperator is not a valid filter operator');
        });

        it('should return false when filters are defined on a field that does not exist', () => {
            const data = { level: 10 },
                filters = { 'notExistField': { '_eq': 10 } },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(false);
        });

        it('should return true when equal filter matches the data field value', () => {
            const data = { level: 10 },
                filters = { level: 10 },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(true);
        });

        it('should return false when equal filter does not the data field value', () => {
            const data = { level: 10 },
                filters = { level: 11 },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(false);
        });

        it('should return true when equal filter with _eq sintaxis matches the data field value', () => {
            const data = { level: 10 },
                filters = { level: { '_eq': 10 } },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(true);
        });

        it('should return false when equal filter with _eq sintaxis does not the data field value', () => {
            const data = { level: 10 },
                filters = { level: { '_eq': 11 } },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(false);
        });

        it('should return true when greater than filter matches the data field value', () => {
            const data = { level: 10 },
                filters = { level: { '_gt': 9 } },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(true);
        });

        it('should return false when greater than filter does not the data field value', () => {
            const data = { level: 10 },
                filters = { level: { '_gt': 10 } },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(false);
        });

        it('should return true when greater than equal filter matches the data field value', () => {
            const data = { level: 10 },
                filters = { level: { '_gte': 10 } },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(true);
        });

        it('should return false when greater than equal filter does not the data field value', () => {
            const data = { level: 10 },
                filters = { level: { '_gte': 11 } },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(false);
        });


        it('should return true when less than filter matches the data field value', () => {
            const data = { level: 10 },
                filters = { level: { '_lt': 11 } },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(true);
        });

        it('should return false when less than filter does not the data field value', () => {
            const data = { level: 10 },
                filters = { level: { '_lt': 10 } },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(false);
        });

        it('should return true when less than equal filter matches the data field value', () => {
            const data = { level: 10 },
                filters = { level: { '_lte': 10 } },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(true);
        });

        it('should return false when less than equal filter does not the data field value', () => {
            const data = { level: 10 },
                filters = { level: { '_lte': 9 } },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(false);
        });

        it('should return true when all multiple filters on a field the data field value', () => {
            const data = { level: 10 },
                filters = { level: { '_lte': 11, '_gte': 9 } },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(true);
        });

        it('should return false when any of multiple filters on a field does not the data field value', () => {
            const data = { level: 10 },
                filters = { level: { '_lte': 11, '_gte': 11 } },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(false);
        });

        it('should return true when filter on nested object does not the data field value', () => {
            const data = { 'child': { 'childChild': { level: 5 } } },
                filters = { 'child.childChild.level': 5 },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(true);
        });

        it('should return false when filter on nested object does not the data field value', () => {
            const data = { level: 10, 'nestedObject': { 'level2': 5 } },
                filters = { 'nestedObject.level2': 9 },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(false);
        });

        it('should return true when all AND filters the data field values', () => {
            const data = { 'a': 10, 'child': { 'b': 5 }, 'c': 9 },
                filters = { 'child.b': 5, 'a': { '_lte': 10 }, 'c': { '_gt': 8 } },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(true);
        });

        it('should return false when any AND filters does not the data field value', () => {
            const data = { 'a': 10, 'child': { 'b': 5 }, 'c': 9 },
                filters = { 'child.b': 5, 'a': { '_lte': 9 }, 'c': { '_gt': 8 } },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(false);
        });

        it('should return false when all AND filters does not the data field value', () => {
            const data = { 'a': 10, 'child': { 'b': 1 }, 'c': 5 },
                filters = { 'child.b': 5, 'a': { '_lte': 9 }, 'c': { '_gt': 8 } },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(false);
        });

        it('should throw an Error when _or filter it is not an array', () => {
            const data = { 'a': 10, 'child': { 'b': 1 }, 'c': 5 },
                filters = { '_or': {'a': 5} },
                filter = new Filter(filters);

            const act = () => filter.match(data);

            expect(act).toThrow('_or filter needs an array as value');
        });

        it('should return false when all _or filters does not the data field value', () => {
            const data = { 'a': 10, 'child': { 'b': 1 }, 'c': 5 },
                filters = { '_or': [{'child.b': 5}, {'a': { '_lte': 9 }}, {'c': { '_gt': 8 } } ] },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(false);
        });

        it('should return true when all _or filters the data field value', () => {
            const data = { 'a': 10, 'child': { 'b': 1 }, 'c': 5 },
                filters = { '_or': [{'child.b': 1}, {'a': { '_lte': 10 }}, {'c': { '_gt': 4 } } ] },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(true);
        });

        it('should throw an Error when _and filter it is not an array', () => {
            const data = { 'a': 10, 'child': { 'b': 1 }, 'c': 5 },
                filters = { '_and': {'a': 5} },
                filter = new Filter(filters);

            const act = () => filter.match(data);

            expect(act).toThrow('_and filter needs an array as value');
        });

        it('should return false when any _and filter does not the data field value', () => {
            const data = { 'a': 10, 'child': { 'b': 1 }, 'c': 5 },
                filters = { '_and': [{'child.b': 1}, {'a': { '_lte': 10 }}, {'c': { '_gt': 5 } } ] },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(false);
        });

        it('should return true when all _and filters the data field value', () => {
            const data = { 'a': 10, 'child': { 'b': 1 }, 'c': 5 },
                filters = { '_and': [{'child.b': 1}, {'a': { '_lte': 10 }}, {'c': { '_gt': 4 } } ] },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(true);
        });

        it('should return true when _or with _and filters the data field value', () => {
            const data = { 'a': 10, 'child': { 'b': 1 }, 'c': 5 },
                filters = { '_or': [{'_and': [{'child.b': 1}, {'a': 10}]}, {'c': { '_gt': 100 } } ] },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(true);
        });

        it('should return false when _or with _and filters do not the data field value', () => {
            const data = { 'a': 10, 'child': { 'b': 1 }, 'c': 5 },
                filters = { '_or': [{'_and': [{'child.b': 1}, {'a': 9}]}, {'c': { '_gt': 100 } } ] },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(false);
        });

        it('should return true when _and with _or filters do not the data field value', () => {
            const data = { 'a': 10, 'child': { 'b': 1 }, 'c': 5 },
                filters = { '_and': [{'_or': [{'child.b': 1}, {'a': 9}]}, {'c': { '_gt': 4 } } ] },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(true);
        });

        it('should return false when _and with _or filters do not the data field value', () => {
            const data = { 'a': 10, 'child': { 'b': 1 }, 'c': 5 },
                filters = { '_and': [{'_or': [{'child.b': 10}, {'a': 9}]}, {'c': { '_gt': 4 } } ] },
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(false);
        });

        it('should throw an Error when _near filter it is applied to a non location value', () => {
            const expectedError = '_near filter must be applied on a location value. This must be an array with 2 values: longitude and latitude',
                filters = { 'a':
                    { '_near':
                        {
                            '_geometry': { 'type': 'Point', 'coordinates': [ 1, 1 ] },
                            '_maxDistance': 10, '_minDistance': 10
                        }
                    }},
                filter = new Filter(filters);

            expect(() => filter.match({ 'a': 10 })).toThrow(expectedError);
            expect(() => filter.match({ 'a': 'test' })).toThrow(expectedError);
            expect(() => filter.match({ 'a': ['test', 'test'] })).toThrow(expectedError);
            expect(() => filter.match({ 'a': [10] })).toThrow(expectedError);
            expect(() => filter.match({ 'a': { 'b': 10 } })).toThrow(expectedError);
            // Longitude outside valid range values
            expect(() => filter.match({ 'a': [180.1, 10] })).toThrow(expectedError);
            expect(() => filter.match({ 'a': [-180.1, 10] })).toThrow(expectedError);
            // Latitude outside valid range values
            expect(() => filter.match({ 'a': [10, 90.1] })).toThrow(expectedError);
            expect(() => filter.match({ 'a': [10, -90.1] })).toThrow(expectedError);
        });

        it('should throw an Error when _near filter does not specify _geometry object in query', () => {
            const data = { 'a': [10, 10] },
                filters = { 'a':
                    { '_near':
                        {
                            '_maxDistance': 10, '_minDistance': 10
                        }
                    }},
                filter = new Filter(filters);

            const act = () => filter.match(data);

            expect(act).toThrow('_near filter must have defined the _geometry object');
        });

        it('should throw an Error when _near filter does not specify _geometry.type', () => {
            const data = { 'a': [10, 10] },
                filters = { 'a':
                    { '_near':
                        {
                            '_geometry': { },
                            '_maxDistance': 10, '_minDistance': 10
                        }
                    }},
                filter = new Filter(filters);

            const act = () => filter.match(data);

            expect(act).toThrow('_near filter must have defined the _geometry.type field');
        });

        it('should throw an Error when _near filter does not support _geometry.type', () => {
            const data = { 'a': [10, 10] },
                unknownType = 'unknown' + Math.random(),
                filters = { 'a':
                    { '_near':
                        {
                            '_geometry': { 'type': unknownType },
                            '_maxDistance': 10, '_minDistance': 10
                        }
                    }},
                filter = new Filter(filters);

            const act = () => filter.match(data);

            expect(act).toThrow('_near filter does not support \'' + unknownType + '\' _geometry.type');
        });

        it('should throw an Error when _near filter with _geometry.type = Point has a non location _geometry.coordinates value', () => {
            const data = { 'a': [10, 10] },
                filters = { 'a':
                    { '_near':
                        {
                            '_geometry': { 'type': 'Point', 'coordinates': [ 10 ] },
                            '_maxDistance': 10, '_minDistance': 10
                        }
                    }},
                filter = new Filter(filters);

            const act = () => filter.match(data);

            expect(act).toThrow('_near filter _geometry.coordinates must be a valid location array');
        });

        it('should throw an Error when _near filter does not define _maxDistance or _minDistance', () => {
            const data = { 'a': [10, 10] },
                filters = { 'a':
                    { '_near':
                        {
                            '_geometry': { 'type': 'Point', 'coordinates': [ 10, 10 ] }
                        }
                    }},
                filter = new Filter(filters);

            const act = () => filter.match(data);

            expect(act).toThrow('_near filter must have defined _maxDistance and/or _minDistance');
        });

        it('should throw an Error when _near filter define a non numeric _maxDistance', () => {
            const data = { 'a': [10, 10] },
                filters = { 'a':
                    { '_near':
                        {
                            '_geometry': { 'type': 'Point', 'coordinates': [ 10, 10 ] },
                            '_maxDistance': 'nonNumeric'
                        }
                    }},
                filter = new Filter(filters);

            const act = () => filter.match(data);

            expect(act).toThrow('_near filter is invalid. _maxDistance must be a number');
        });

        it('should throw an Error when _near filter define a non numeric _minDistance', () => {
            const data = { 'a': [10, 10] },
                filters = { 'a':
                    { '_near':
                        {
                            '_geometry': { 'type': 'Point', 'coordinates': [ 10, 10 ] },
                            '_minDistance': 'nonNumeric'
                        }
                    }},
                filter = new Filter(filters);

            const act = () => filter.match(data);

            expect(act).toThrow('_near filter is invalid. _minDistance must be a number');
        });
        it('should return true when _near filter with _minDistance condition is satisfied', () => {
            const data = { 'a': [37.992240, -1.130654] },
                filters = { 'a':
                    { '_near':
                        {
                            '_geometry': { 'type': 'Point', 'coordinates': [ 37.992340, -1.130654 ] },
                            '_minDistance': 10
                        }
                    }},
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(true);
        });

        it('should return false when _near filter with _minDistance condition is not satisfied', () => {
            const data = { 'a': [37.992240, -1.130654] },
                filters = { 'a':
                    { '_near':
                        {
                            '_geometry': { 'type': 'Point', 'coordinates': [ 37.992340, -1.130654 ] },
                            '_minDistance': 12
                        }
                    }},
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(false);
        });

        it('should return true when _near filter with _maxDistance condition is satisfied', () => {
            const data = { 'a': [37.992240, -1.130654] },
                filters = { 'a':
                    { '_near':
                        {
                            '_geometry': { 'type': 'Point', 'coordinates': [ 37.992340, -1.130654 ] },
                            '_maxDistance': 12
                        }
                    }},
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(true);
        });

        it('should return false when _near filter with _maxDistance condition is not satisfied', () => {
            const data = { 'a': [37.992240, -1.130654] },
                filters = { 'a':
                    { '_near':
                        {
                            '_geometry': { 'type': 'Point', 'coordinates': [ 37.992340, -1.130654 ] },
                            '_maxDistance': 10
                        }
                    }},
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(false);
        });

        it('should return true when _near filter with _minDistance and _maxDistance conditions are satisfied', () => {
            const data = { 'a': [37.992240, -1.130654] },
                filters = { 'a':
                    { '_near':
                        {
                            '_geometry': { 'type': 'Point', 'coordinates': [ 37.992340, -1.130654 ] },
                            '_minDistance': 10, '_maxDistance': 12
                        }
                    }},
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(true);
        });

        it('should return true when _near filter with _minDistance and _maxDistance conditions are equal to distance', () => {
            const coord1 = [11.791456, 44.155631];
            const coord2 = [11.791460, 44.154640];
            const distance = 110;
            const data = { 'a': coord1 },
                filters = { 'a':
                    { '_near':
                        {
                            '_geometry': { 'type': 'Point', 'coordinates': coord2 },
                            '_minDistance': distance, '_maxDistance': distance
                        }
                    }},
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(true);
        });

        it('should return false when _near filter with _minDistance and _maxDistance conditions are not satisfied', () => {
            const data = { 'a': [37.992240, -1.130654] },
                filters = { 'a':
                    { '_near':
                        {
                            '_geometry': { 'type': 'Point', 'coordinates': [ 37.992340, -1.130654 ] },
                            '_minDistance': 12, '_maxDistance': 15
                        }
                    }},
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(false);
        });

        it('should return false when _near filter with _minDistance and _maxDistance conditions are not satisfied', () => {
            const coord1 = [44.157579, 11.793344];
            const coord2 = [44.154631, 11.791456];
            const distance = 360;
            const data = { 'a': coord1 },
                filters = { 'a':
                    { '_near':
                        {
                            '_geometry': { 'type': 'Point', 'coordinates': coord2 },
                            '_minDistance': distance - 2, '_maxDistance': distance - 1
                        }
                    }},
                filter = new Filter(filters);

            const result = filter.match(data);

            expect(result).toBe(false);
        });
    });
});
