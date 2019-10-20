import { buildServer } from '../../../src/server';
import { buildEventTypesService } from '../../../src/services/event-types-service';
import { buildTargetsService } from '../../../src/services/targets-service';
import { buildRulesService } from '../../../src/services/rules-services';
import { buildEngine } from '../../../src/engine';

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

    describe('version', () => {

        it('should return 200 with cep version', async () => {
            const response = await server.inject({
                method: 'GET',
                url: '/admin/version'
            });
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            expect(response.payload).toBe(JSON.stringify({ version: '0.0.1' }));
        });
    });
});
