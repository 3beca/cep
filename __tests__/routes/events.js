import { buildServer } from '../../src/server';
import eventTypesService from '../../src/services/event-types-service';
import { ObjectId } from 'bson';

describe('events', () => {
    let server;

    beforeEach(() => {
        server = buildServer();
    });

    afterEach(async () => {
        await server.close();
        await eventTypesService.purge();
    });

    describe('post an event', () => {

        it('should return 404 when event type does not exists', async () => {
            const response = await server.inject({
                method: 'POST',
                url: '/events/' + new ObjectId()
            });
            expect(response.statusCode).toBe(404);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            expect(response.payload).toBe(JSON.stringify({ message: 'Resource not found' }));
        });

        it('should return 204 when event type exists', async () => {
            const createResponse = await server.inject({
                method: 'POST',
                url: '/admin/event-types',
                body: {
                    name: 'an event type'
                }
            });
            expect(createResponse.statusCode).toBe(201);
            expect(createResponse.headers['content-type']).toBe('application/json; charset=utf-8');
            const createdEvent = JSON.parse(createResponse.payload);

            const response = await server.inject({
                method: 'POST',
                url: '/events/' + createdEvent.id,
                body: {
                    value: 5
                }
            });
            expect(response.statusCode).toBe(204);
        });
    });
});
