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
            format: String,
            default: 'localhost',
            env: 'HTTP_HOST',
        },
        port: {
            doc: 'The port to bind.',
            format: 'port',
            default: 8888,
            env: 'HTTP_PORT',
        }
    },
    externalHttp: {
        protocol: {
            doc: 'The external protocol.',
            format: ['http', 'https'],
            default: 'http',
            env: 'EXTERNAL_HTTP_PROTOCOL',
        },
        host: {
            doc: 'The external host.',
            format: String,
            default: 'localhost',
            env: 'EXTERNAL_HTTP_HOST',
        },
        port: {
            doc: 'The external port.',
            format: String,
            default: '8888',
            env: 'EXTERNAL_HTTP_PORT',
        }
    },
    trustedProxy: {
        doc: 'indicates if the application is served behind a reverse proxy.',
        format: Boolean,
        default: false,
        env: 'TRUSTED_PROXY',
    }
});

config.validate({ allowed: 'strict' });

export default config.getProperties();
