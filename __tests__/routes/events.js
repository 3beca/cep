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

        describe('get', () => {
            it('should return 200 with array of events', async () => {
                const response = await server.inject({
                    method: 'GET',
                    url: '/admin/events'
                });
                expect(response.statusCode).toBe(200);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ results: [] }));
            });
        });

        describe('post', () => {
            it('should return 400 when name is undefined', async () => {
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/events',
                    body: {
                        name: undefined
                    }
                });
                expect(response.statusCode).toBe(400);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                expect(response.payload).toBe(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: 'body should have required property \'name\'' }));
            });

            it('should return 201 with created event when request is valid', async () => {
                const response = await server.inject({
                    method: 'POST',
                    url: '/admin/events',
                    body: {
                        name: 'sensor-data'
                    }
                });
                expect(response.statusCode).toBe(201);
                expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
                const event = JSON.parse(response.payload);
                expect(response.headers.location).toBe(`http://localhost:8888/admin/events/${event.id}`);
                expect(event.name).toBe('sensor-data');
            });
        });
    });
});
