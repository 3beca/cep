jest.mock('pino');
import { buildServer } from '../src/server';

describe('builServer', () => {
    let server;

    beforeEach(() => {
        server = buildServer();
    });

    afterEach(async () => {
        await server.close();
    });

    it('should return 404 for no existing endpoint', async () => {
      const response = await server.inject({
          method: 'GET',
          url: '/not-existing-route'
        });
        expect(response.statusCode).toBe(404);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(response.payload).toBe(JSON.stringify({ message: 'Resource not found' }));
    });

    it('should return 200 for swagger endpoint', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/documentation/static/index.html'
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toBe('text/html; charset=UTF-8');
    });

    it('should return 200 for swagger json endpoint', async () => {
        const response = await server.inject({
          method: 'GET',
          url: '/documentation/json'
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    });

    it('should return 500 when unhandled errors happened', async () => {
        server.register(
            function(fastify, opts, next) {
                fastify.get('/', opts, async () => {
                    throw new Error('Something bad');
                });
                next();
            }, { prefix: '/error' }
        );

        const response = await server.inject({
            method: 'GET',
            url: '/error'
        });

        expect(response.statusCode).toBe(500);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
    });
});
