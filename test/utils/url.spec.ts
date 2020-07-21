import { getUrl } from '../../src/utils/url';

describe('url', () => {

    const request = {
        urlData() {
            return {
                port: 80,
                host: 'localhost'
            };
        },
        protocol: 'http'
    } as any;

    describe('getUrl()', () => {

        it('should remove end slash if present', () => {
            const result = getUrl(request, '/my-path/');
            expect(result).toBe('http://localhost:80/my-path');
        });

        it('should not modify path if end slash is not present', () => {
            const result = getUrl(request, '/my-path');
            expect(result).toBe('http://localhost:80/my-path');
        });

        it('should return url when path is null', () => {
            const result = getUrl(request, null);
            expect(result).toBe('http://localhost:80');
        });

        it('should return url without port if not set', () => {
            const result = getUrl({
                urlData: function() {
                    return {
                        host: 'example.org'
                    };
                },
                protocol: 'https'
            } as any, null);
            expect(result).toBe('https://example.org');
        });
    });
});
