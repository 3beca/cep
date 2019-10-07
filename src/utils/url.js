import config from '../config';

const { externalHttp } = config;

export function getExternalUrl(request) {
    const { protocol, host, port } = externalHttp;
    return `${protocol}://${host}${port ? ':' + port : ''}${request.originalUrl}`;
}
