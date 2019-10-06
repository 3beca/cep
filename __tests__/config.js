import config from '../src/config';

describe('config', () => {
    it('should have default values', () => {
        expect(config).toStrictEqual({
            env: 'test',
            http: {
                host: '127.0.0.1',
                port: 8888
            }
        });
    });
});
