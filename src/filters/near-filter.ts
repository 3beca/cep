import * as geolib from 'geolib';
import FilterMatchError from './filter-match-error';
import FilterError from './filter-error';

/**
* This method checks if the input value
* is a valid location: [ <longitude>, <latitude> ]
*
* @method isLocation
* @param {Object} value value
* @return true if is a location object, false otherwise
*/
function isLocation(value) {
    if (!value ||
        !(value instanceof Array) ||
        value.length !== 2) {
        return false;
    }
    const longitude = value[0];
    const latitude = value[1];

    return longitude >= -180.0 && longitude <= 180.0 &&
        latitude >= -90.0 && latitude <= 90.0;
}

/**
* This method assert the valid state of the near filter
* It throws an Error if not valid
*
* @method assertIsValid
* @param {Object} filter filter
*/
function assertIsValid(filter) {
    const geometry = filter._geometry;
    if (!geometry) {
        throw new FilterError('_near filter must have defined the _geometry object');
    }

    if (!geometry.type) {
        throw new FilterError('_near filter must have defined the _geometry.type field');
    }

    if (geometry.type !== 'Point') {
        throw new FilterError('_near filter does not support \'' + geometry.type + '\' _geometry.type');
    }

    if (!isLocation(geometry.coordinates)) {
        throw new FilterError('_near filter _geometry.coordinates must be a valid location array');
    }

    const minDistance = filter._minDistance;
    const maxDistance = filter._maxDistance;

    if (minDistance === undefined && maxDistance === undefined) {
        throw new FilterError('_near filter must have defined _maxDistance and/or _minDistance');
    }

    if (minDistance !== undefined && isNaN(minDistance)) {
        throw new FilterError('_near filter is invalid. _minDistance must be a number');
    }

    if (maxDistance !== undefined && isNaN(maxDistance)) {
        throw new FilterError('_near filter is invalid. _maxDistance must be a number');
    }
}

class NearFilter {
    static assertIsValid;

    private filter;

    public match(location) {
        if (!isLocation(location)){
            throw new FilterMatchError('_near filter must be applied on a location value. This must be an array with 2 values: longitude and latitude');
        }

        const coord1 = {
            longitude: location[0],
            latitude: location[1]
        };

        const geometry = this.filter._geometry;
        const coord2 = {
            longitude: geometry.coordinates[0],
            latitude: geometry.coordinates[1]
        };

        const distance = geolib.getDistance(coord1, coord2);

        const minDistance = this.filter._minDistance || 0;
        const maxDistance = this.filter._maxDistance || Number.MAX_VALUE;

        return distance >= minDistance && distance <= maxDistance;
    }

    constructor(filter) {
        assertIsValid(filter);
        this.filter = filter;
    }
}
NearFilter.assertIsValid = assertIsValid;
export default NearFilter;
