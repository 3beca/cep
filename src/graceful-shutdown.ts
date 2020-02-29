import logger from './logger';

export default function gracefulShutdown(app) {
    return async () => {
        try {
            logger.info('starting graceful shutdown.');
            await app.close();
            logger.info('graceful shutdown complete.');
            process.exit(0);
        } catch (error) {
            logger.error('error while graceful shuttingdown.', error);
            process.exit(1);
        }
    };
}
