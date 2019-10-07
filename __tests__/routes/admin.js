import { buildServer } from '../../src/server';

describe('admin', () => {
    let server;

    beforeEach(() => {
        server = buildServer();
    });

    afterEach(async () => {
        await server.close();
    });

    describe('check-health', () => {

        it('should return 204', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/admin/check-health'
            });
            expect(response.statusCode).toBe(204);
        });
    });
});
