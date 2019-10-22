import logger from './logger';

export default function gracefulShutdown(server, dbClient) {
    return async () => {
        try {
            logger.info('starting graceful shutdown.');
            await server.close();
            await dbClient.close();
            logger.info('graceful shutdown complete.');
            process.exit(0);
        } catch (error) {
            logger.error('error while graceful shuttingdown.', error);
            process.exit(1);
        }
    };
}
