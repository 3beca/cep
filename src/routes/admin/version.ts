import packageInfo from '../../../package.json';
import { FastifyInstance } from 'fastify';

const versionSchema = {
    tags: ['system'],
    response: {
        200: {
            description: 'cep version',
            type: 'object',
            properties: {
                version: { type: 'string' }
            }
        }
    }
};

export function buildVersionRoutes() {

    async function version() {
        return { version: packageInfo.version };
    }

    return function(fastify: FastifyInstance, opts, next) {
        fastify.get('/version', { ...opts, ...{ logLevel: 'warn', schema: versionSchema } }, version);
        next();
    };
}
