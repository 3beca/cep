import { Engine } from '../../engine';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Server } from 'http';
import { ObjectId } from 'mongodb';

const executeRuleSchema = {
    tags: ['rules'],
    params: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'rule identifier',
            pattern: '^[a-f0-9]{24}$'
          }
        },
        errorMessage: 'rule id must be a valid ObjectId'
    },
    response: {
        204: {
            type: 'object'
        }
    }
};

export function buildExecuteRuleRoutes(engine: Engine) {

    async function executeRule(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply<Server>): Promise<void> {
        const { params, id: requestId } = request;
        const { id } = params;
        const ruleId = ObjectId.createFromHexString(id);
        await engine.executeRule(ruleId, requestId);
        reply.status(204).send();
    }

    return function(fastify: FastifyInstance, opts, next) {
        fastify.post('/execute-rule/:id', { ...opts, schema: executeRuleSchema }, executeRule);
        next();
    };
}
