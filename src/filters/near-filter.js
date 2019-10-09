import * as geolib from 'geolib';

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
* This method validates the near filter and throws
* an Error if is not valid
*
* @method validate
* @param {Object} filter filter
*/
function validate(filter) {
    const geometry = filter._geometry;
    if (!geometry) {
        throw new Error('_near filter must have defined the _geometry object');
    }

    if (!geometry.type) {
        throw new Error('_near filter must have defined the _geometry.type field');
    }

    if (geometry.type !== 'Point') {
        throw new Error('_near filter does not support \'' + geometry.type + '\' _geometry.type');
    }

    if (!isLocation(geometry.coordinates)) {
        throw new Error('_near filter _geometry.coordinates must be a valid location array');
    }

    const minDistance = filter._minDistance;
    const maxDistance = filter._maxDistance;

    if (minDistance === undefined && maxDistance === undefined) {
        throw new Error('_near filter must have defined _maxDistance and/or _minDistance');
    }

    if (minDistance !== undefined && isNaN(minDistance)) {
        throw new Error('_near filter is invalid. _minDistance must be a number');
    }

    if (maxDistance !== undefined && isNaN(maxDistance)) {
        throw new Error('_near filter is invalid. _maxDistance must be a number');
    }
}

export default class NearFilter {
    constructor(filter) {
        validate(filter);
        this.filter = filter;
        this.match = function match(location) {
            if (!isLocation(location)){
                throw new Error('_near filter must be applied on a location value. This must be an array with 2 values: longitude and latitude');
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
        };
    }
}
