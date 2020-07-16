import convict from 'convict';

const config = convict({
    env: {
        doc: 'The application environment.',
        format: ['production', 'development', 'test'],
        default: 'development',
        env: 'NODE_ENV'
    },
    eventProcessingHttp: {
        host: {
            doc: 'The host ip address to bind the event processsing http api.',
            format: String,
            default: 'localhost',
            env: 'CEP_EVENT_PROCESSING_HTTP_HOST',
        },
        port: {
            doc: 'The port to bind the event processing http api.',
            format: 'port',
            default: 8888,
            env: 'CEP_EVENT_PROCESSING_HTTP_PORT',
        },
        enableSwagger: {
            doc: 'It indicates if Swagger UI is enabled for the event processing http api.',
            format: Boolean,
            default: false,
            env: 'CEP_EVENT_PROCESSING_HTTP_ENABLE_SWAGGER'
        },
        trustProxy: {
            doc: 'It indicates if the event processing http api is served behind a trusted proxy.',
            format: Boolean,
            default: false,
            env: 'CEP_EVENT_PROCESSING_HTTP_TRUST_PROXY',
        }
    },
    adminHttp: {
        host: {
            doc: 'The host ip address to bind the admin http api.',
            format: String,
            default: 'localhost',
            env: 'CEP_ADMIN_HTTP_HOST',
        },
        port: {
            doc: 'The port to bind the admin http api.',
            format: 'port',
            default: 8888,
            env: 'CEP_ADMIN_HTTP_PORT',
        },
        trustProxy: {
            doc: 'It indicates if the admin http api is served behind a trusted proxy.',
            format: Boolean,
            default: false,
            env: 'CEP_ADMIN_HTTP_TRUST_PROXY',
        },
        enableCors: {
            doc: 'It indicates if cors requests are enabled for the admin http api.',
            format: Boolean,
            default: false,
            env: 'CEP_ADMIN_HTTP_ENABLE_CORS'
        },
        enableSwagger: {
            doc: 'It indicates if Swagger UI is enabled for the admin http api.',
            format: Boolean,
            default: false,
            env: 'CEP_ADMIN_HTTP_ENABLE_SWAGGER'
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
            format: 'port',
            default: 8889,
            env: 'INTERNAL_HTTP_PORT',
        }
    },
    metricsHttp: {
        host: {
            doc: 'The host ip address to bind the metrics http api.',
            format: String,
            default: 'localhost',
            env: 'CEP_METRICS_HTTP_HOST',
        },
        port: {
            doc: 'The port to bind the metrics http api.',
            format: 'port',
            default: 8890,
            env: 'CEP_METRICS_HTTP_PORT',
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
            format: 'port',
            default: 8890,
            env: 'TRIBECA_SCHEDULER_SERVICE_PORT',
        }
    },
    mongodb: {
        databaseUrl: {
            doc: 'The MongoDB connection string url.',
            format: String,
            default: 'mongodb://localhost:27017',
            env: 'CEP_MONGODB_URL',
        },
        databaseName: {
            doc: 'The MongoDB database name.',
            format: String,
            default: 'tribeca-cep',
            env: 'CEP_MONGODB_DATABASE_NAME'
        }
    }
});

config.validate({ allowed: 'strict' });

export default config.getProperties();
