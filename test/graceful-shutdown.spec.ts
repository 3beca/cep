import gracefulShutdown from '../src/graceful-shutdown';
import { App } from '../src/app';

describe('graceful-shutdown', () => {

    afterEach(() => {
        jest.clearAllMocks();
        jest.resetAllMocks();
    });

    it('should call app.close and process exit 0', async () => {
        const app = {
            close: jest.fn(() => Promise.resolve())
        } as unknown as App;
        const exitStub = jest.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as (code?: number) => never);

        await gracefulShutdown(app)();

        expect(app.close).toHaveBeenCalledTimes(1);
        expect(exitStub).toHaveBeenCalledTimes(1);
        expect(exitStub).toHaveBeenCalledWith(0);
    });

    it('should call app.close and process exit 1 when app.close throw an error', async () => {
        const app = {
            close: jest.fn(() => Promise.reject('Oops, an error'))
        } as unknown as App;
        const exitStub = jest.spyOn(process, 'exit').mockImplementation((() => {}) as unknown as (code?: number) => never);

        await gracefulShutdown(app)();

        expect(app.close).toHaveBeenCalledTimes(1);
        expect(exitStub).toHaveBeenCalledTimes(1);
        expect(exitStub).toHaveBeenCalledWith(1);
    });
});
