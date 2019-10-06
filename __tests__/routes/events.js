import { buildServer } from '../../src/server';

describe('admin', () => {
    let server;

    beforeEach(() => {
        server = buildServer();
    });

    afterEach(async () => {
        await server.close();
    });

    describe('events', () => {
        it('should return 200 with array of events', () => {
            server.inject({
                method: 'GET',
                url: '/admin/events'
            }, (err, response) => {
                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify([]));
            });
        });
    });
});
