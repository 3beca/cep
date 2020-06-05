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
    internalHttp: {
        protocol: {
            doc: 'The internal protocol.',
            format: ['http', 'https'],
            default: 'http',
            env: 'INTERNAL_HTTP_PROTOCOL',
        },
        host: {
            doc: 'The internal host.',
            format: String,
            default: 'localhost',
            env: 'INTERNAL_HTTP_HOST',
        },
        port: {
            doc: 'The internal port.',
            format: String,
            default: '8889',
            env: 'INTERNAL_HTTP_PORT',
        }
    },
    scheduler: {
        protocol: {
            doc: 'The tribeca scheduler service protocol.',
            format: ['http', 'https'],
            default: 'http',
            env: 'TRIBECA_SCHEDULER_SERVICE_PROTOCOL',
        },
        host: {
            doc: 'The tribeca scheduler service host.',
            format: String,
            default: 'localhost',
            env: 'TRIBECA_SCHEDULER_SERVICE_HOST',
        },
        port: {
            doc: 'The tribeca scheduler service port.',
            format: String,
            default: '8890',
            env: 'TRIBECA_SCHEDULER_SERVICE_PORT',
        }
    },
    trustProxy: {
        doc: 'indicates if the application is served behind a reverse proxy.',
        format: Boolean,
        default: false,
        env: 'TRUST_PROXY',
    },
    enableCors: {
        doc: 'indicates if the application supports cors requests.',
        format: Boolean,
        default: false,
        env: 'ENABLE_CORS'
    },
    mongodb: {
        databaseUrl: {
            doc: 'Mongodb connection string url.',
            format: String,
            default: 'mongodb://localhost:27017',
            env: 'MONGODB_URL',
        },
        databaseName: {
            doc: 'Mongodb database name.',
            format: String,
            default: 'tribeca-cep',
            env: 'MONGODB_DATABASE_NAME'
        }
    },
});

config.validate({ allowed: 'strict' });

export default config.getProperties();
