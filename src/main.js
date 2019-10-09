import { buildServer } from './server';
import config from './config';
import gracefulShutdown from './graceful-shutdown';
import 'make-promises-safe';

async function main() {
    const { port, host } = config.http;
    const server = buildServer();

    await server.listen(port, host);

    process.on('SIGTERM', gracefulShutdown(server));
    process.on('SIGINT', gracefulShutdown(server));
}

main().catch(error => {
    console.error('error while starting up', error);
    process.exit(1);
});
