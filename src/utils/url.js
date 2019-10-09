import config from '../config';
import url from 'url';

const { externalHttp } = config;

function removeEndSlash(path) {
    if (path[path.length - 1] === '/') {
        return path.slice(0, -1);
    }
    return path;
}

export function getExternalUrl(path) {
    const { protocol, host, port } = externalHttp;
    return `${protocol}://${host}${port ? ':' + port : ''}${path ? removeEndSlash(path) : ''}`;
}

export function getPrevLink(request) {
    const { page, pageSize } = request.query;
    const path = url.parse(request.raw.url).pathname;
    return page !== 1 ? `${getExternalUrl()}${path}?page=${page - 1}&pageSize=${pageSize}` : undefined;
}

export function getNextLink(request, results) {
    const { page, pageSize } = request.query;
    const path = url.parse(request.raw.url).pathname;
    return results.length === pageSize ? `${getExternalUrl()}${path}?page=${page + 1}&pageSize=${pageSize}` : undefined;
}
