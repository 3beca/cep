import { buildServer } from '../src/server';
import { exportAllDeclaration } from '@babel/types';

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

    it('should return 200 for test endpoint', () => {
        server.inject({
            method: 'POST',
            url: '/test'
          }, (err, response) => {
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            expect(response.payload).toBe(JSON.stringify({ sucess: true }));
          });
    });
});
