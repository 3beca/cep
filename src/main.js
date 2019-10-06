import { buildServer } from './server';
import config from './config';
import 'make-promises-safe';

async function main() {
    const { port, host } = config.http;
    const server = await buildServer().listen(port, host);

    process.on('SIGTERM', async () => {
        try {
            console.log('SIGTERM signal recieved, graceful shuttingdown...');
            await server.close();
            console.log('graceful shutdown complete.');
            process.exit(0);
        } catch (error) {
            console.error('error while gracefull shuttingdown', error);
            process.exit(1);
        }
    });
}

main().catch(error => {
    console.error('error while starting up', error);
    process.exit(1);
});
