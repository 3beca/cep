import NearFilter from './near-filter';

/**
* This method has been adapted from:
* http://stackoverflow.com/questions/6491463/accessing-nested-javascript-objects-with-string-key
*
* @method getObjectByKey
* @param {Object} object object
* @param {String} key the key name of the property or nested property
* @return {Object} Returns the specified object if found, undefined otherwise
*/
function getObjectByKey(object, key) {
    const keyConvertedIndexProperty = key.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
    const keyStippedLeadingDot = keyConvertedIndexProperty.replace(/^\./, ''); // strip a leading dot
    const a = keyStippedLeadingDot.split('.');
    let result = object;
    for (let i = 0, n; i < a.length; i++) {
        n = a[i];
        if (n in result) {
            result = result[n];
        } else {
            return undefined;
        }
    }
    return result;
}

function matchFilter(data, filterField, filterOperator) {
    const dataValue = getObjectByKey(data, filterField);
    if (!dataValue) {
        return false;
    }

    if (typeof filterOperator !== 'object'){
        return dataValue === filterOperator;
    }

    return Object.keys(filterOperator).every(key => {
        const filterValue = filterOperator[key];
        switch (key) {
            case '_eq' : {
                return dataValue === filterValue;
            }
            case '_gt' : {
                return dataValue > filterValue;
            }
            case '_gte' : {
                return dataValue >= filterValue;
            }
            case '_lt' : {
                return dataValue < filterValue;
            }
            case '_lte' : {
                return dataValue <= filterValue;
            }
            case '_near' : {
                const nearFilter = new NearFilter(filterValue);
                return nearFilter.match(dataValue);
            }
            default : {
                throw new Error(key + ' is not a valid filter operator');
            }
        }
    });
}

function matchFilters(data, filters) {
    return Object.keys(filters).every(function(key) {
        switch (key.toLowerCase()) {
            case '_or' : {
                return matchOrFilters(data, filters[key]);
            }
            case '_and' : {
                return matchAndFilters(data, filters[key]);
            }
            default : {
                const filterOperator = filters[key];
                return matchFilter(data, key, filterOperator);
            }
        }
    });
}

function matchAndFilters(data, filtersArray) {
    if (!(filtersArray instanceof Array)) {
        throw new Error('_and filter needs an array as value');
    }
    return filtersArray.every(filter => matchFilters(data, filter));
}

function matchOrFilters(data, filtersArray) {
    if (!(filtersArray instanceof Array)) {
        throw new Error('_or filter needs an array as value');
    }
    return filtersArray.some(filter => matchFilters(data, filter));
}

export default class Filter {
    constructor(filters) {
        this.filters = filters;
        this.match = function match(data) {
            if (!data){
                return false;
            }
            if (!this.filters) {
                return true;
            }
            return matchFilters(data, this.filters);
        };
    }
}
