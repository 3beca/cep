import convict from 'convict';

export type Config = {
    env: 'production' | 'development' | 'test',
    eventProcessingHttp: {
        host: string,
        port: number,
        enableSwagger: boolean,
        trustProxy: boolean,
        baseUrl: string
    },
    adminHttp: {
        host: string,
        port: number,
        enableSwagger: boolean,
        enableCors: boolean,
        trustProxy: boolean,
        apiKeys: string
    },
    metricsHttp: {
        host: string,
        port: number
    },
    mongodb: {
        url: string,
        databaseName: string
    }
}

export function buildConfig() {
    const config = convict<Config>({
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
                default: 8889,
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
            },
            baseUrl: {
                doc: 'The base url of the event processing http api. This info is used to build the event processing url of a given event type.',
                format: String,
                default: 'http://localhost:8889',
                env: 'CEP_EVENT_PROCESSING_HTTP_BASE_URL',
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
            },
            apiKeys: {
                doc: 'When set it enables admin http api security via Authorization: apiKey [APIKEY]. Api keys can be multiple separated by blank space character.',
                format: String,
                default: '',
                env: 'CEP_ADMIN_HTTP_API_KEYS'
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
        mongodb: {
            url: {
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
    return config.getProperties();
}
