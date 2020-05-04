import config from '../config';
import * as url from 'url';

const { externalHttp } = config;

function removeEndSlash(path: string): string {
    if (path[path.length - 1] === '/') {
        return path.slice(0, -1);
    }
    return path;
}

export function getExternalUrl(path: string | null): string {
    const { protocol, host, port } = externalHttp;
    return `${protocol}://${host}${port ? ':' + port : ''}${path ? removeEndSlash(path) : ''}`;
}

function getPagedLink(path: string | null, page: number, pageSize: number, queryStrings: { [key:string]: string }): string {
    const appendQueryStrings = Object.keys(queryStrings).map(k => `&${k}=${encodeURIComponent(queryStrings[k])}`).join();
    return `${getExternalUrl(path)}?page=${page}&pageSize=${pageSize}${appendQueryStrings}`;
}

export function getPrevLink(request): string | undefined {
    const { page, pageSize, ...rest } = request.query;
    const path = url.parse(request.raw.url).pathname;
    return page !== 1 ? getPagedLink(path, page - 1, pageSize, rest) : undefined;
}

export function getNextLink(request, results): string | undefined {
    const { page, pageSize, ...rest } = request.query;
    const path = url.parse(request.raw.url).pathname;
    return results.length === pageSize ? getPagedLink(path, page + 1, pageSize, rest) : undefined;
}
