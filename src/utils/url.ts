import config from '../config';
import * as url from 'url';

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

function getPagedLink(path, page, pageSize) {
    return `${getExternalUrl(path)}?page=${page}&pageSize=${pageSize}`;
}

export function getPrevLink(request) {
    const { page, pageSize } = request.query;
    const path = url.parse(request.raw.url).pathname;
    return page !== 1 ? getPagedLink(path, page - 1, pageSize) : undefined;
}

export function getNextLink(request, results) {
    const { page, pageSize } = request.query;
    const path = url.parse(request.raw.url).pathname;
    return results.length === pageSize ? getPagedLink(path, page + 1, pageSize) : undefined;
}
