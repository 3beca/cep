import convict from 'convict';

const config = convict({
    env: {
        doc: 'The application environment.',
        format: ['production', 'development', 'test'],
        default: 'development',
        env: 'NODE_ENV'
    },
    http: {
        host: {
            doc: 'The host ip address to bind.',
            format: 'ipaddress',
            default: '127.0.0.1',
            env: 'HTTP_HOST',
        },
        port: {
            doc: 'The port to bind.',
            format: 'port',
            default: 8888,
            env: 'HTTP_PORT',
        }
    }
});

config.validate({ allowed: 'strict' });

export default config.getProperties();
