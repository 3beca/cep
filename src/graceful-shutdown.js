export default function gracefulShutdown(server, dbClient) {
    return async () => {
        try {
            console.log('starting graceful shutdown.');
            await server.close();
            await dbClient.close();
            console.log('graceful shutdown complete.');
            process.exit(0);
        } catch (error) {
            console.error('error while graceful shuttingdown.', error);
            process.exit(1);
        }
    };
}
