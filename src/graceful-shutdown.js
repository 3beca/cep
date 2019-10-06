export function gracefulShutdown(server) {
    return async () => {
        try {
            console.log('starting graceful shutdown.');
            await server.close();
            console.log('graceful shutdown complete.');
            process.exit(0);
        } catch (error) {
            console.error('error while graceful shuttingdown.', error);
            process.exit(1);
        }
    };
}
