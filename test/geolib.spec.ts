import * as geolib from 'geolib';

describe('geolib', function() {

    describe('getDistance', function() {

        it('should return NaN when coordinates inputs are invalid', function() {
            const coord1 = { someOtherInvalidField: 2};
            const coord2 = { someInvalidField: 1};

            const distance = geolib.getDistance(coord1 as any, coord2 as any);

            expect(distance).toBe(NaN);
        });

        it('should thrown an Error when coordinates inputs are null', function() {
            function act() { geolib.getDistance(null as any, null as any); }

            expect(act).toThrow();
        });

        it('should return distance from Murcia to Lorca in meters', function() {
            const coord1 = { latitude: 38.002656, longitude: -1.164551 };
            const coord2 = { latitude: 37.668603, longitude: -1.711121 };

            const distance = geolib.getDistance(coord1, coord2);

            expect(distance).toBe(60761);
        });

        it('should return distance from Murcia to Modigliana in meters', function() {
            const coord1 = { latitude: 38.002656, longitude: -1.164551 };
            const coord2 = { latitude: 44.158537, longitude: 11.792105 };

            const distance = geolib.getDistance(coord1, coord2);

            expect(distance).toBe(1282849);
        });
    });
});
