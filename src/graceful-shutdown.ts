import logger from './logger';
import { App } from './app';

export default function gracefulShutdown(app: App) {
    return async () => {
        try {
            logger.info('starting graceful shutdown.');
            await app.close();
            logger.info('graceful shutdown complete.');
            process.exit(0);
        } catch (error) {
            logger.error('error while graceful shutting down.', error);
            process.exit(1);
        }
    };
}
