import config from '../src/config';

describe('config', () => {
    it('should have default values', () => {
        expect(config).toStrictEqual({
            env: 'test',
            http: {
                host: 'localhost',
                port: 8888
            },
            externalHttp: {
                protocol: 'http',
                host: 'localhost',
                port: '8888'
            }
        });
    });
});
