import { getExternalUrl } from '../../src/utils/url';

describe('url', () => {

    describe('getExternalUrl()', () => {

        it('should remove end slash if present', () => {
            const result = getExternalUrl('/my-path/');
            expect(result).toBe('http://localhost:8888/my-path');
        });

        it('should not modify path if end slash is not present', () => {
            const result = getExternalUrl('/my-path');
            expect(result).toBe('http://localhost:8888/my-path');
        });

        it('should return external url when path is undefined', () => {
            const result = getExternalUrl(undefined);
            expect(result).toBe('http://localhost:8888');
        });
    });
});
