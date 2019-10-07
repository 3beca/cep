import { buildServer } from '../src/server';

describe('builServer', () => {
    let server;

    beforeEach(() => {
        server = buildServer();
    });

    afterEach(async () => {
        await server.close();
    });

    it('should return 404 for no existing endpoint', () => {
        server.inject({
            method: 'GET',
            url: '/not-existing-route'
          }, (err, response) => {
            expect(response.statusCode).toBe(404);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            expect(response.payload).toBe(JSON.stringify({ message: 'Resource not found' }));
          });
    });

    it('should return 200 for swagger endpoint', () => {
        server.inject({
            method: 'GET',
            url: '/documentation/static/index.html'
          }, (err, response) => {
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('text/html; charset=UTF-8');
          });
    });

    it('should return 200 for swagger json endpoint', () => {
        server.inject({
            method: 'GET',
            url: '/documentation/json'
          }, (err, response) => {
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
          });
    });
});
