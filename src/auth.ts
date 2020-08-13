// this code is inspired by https://github.com/fastify/fastify-bearer-auth
// currently the plugin is not used as there is not an easy way to exclude routes
// from the auth check: see https://github.com/fastify/fastify-bearer-auth/issues/47.

import { FastifyRequest, FastifyReply } from "fastify";

export type ApiKeyOptions = {
    keys: Set<string>,
    excludeRoutes: string[]
};

export function apiKeyAuth(options: ApiKeyOptions) {
  const { keys, excludeRoutes } = options;

  function apiKeyAuthHook(req: FastifyRequest, res: FastifyReply, next) {
    if (excludeRoutes.some(r => req.url.startsWith(r))) {
        next();
        return;
    }

    const header = req.raw.headers.authorization;
    if (!header) {
      const noHeaderError = Error('missing authorization header');
      req.log.error('unauthorized: %s', noHeaderError.message);
      res.code(401).send({ error: noHeaderError.message });
      return;
    }

    const key = header.substring('apiKey'.length).trim();
    const result = authenticate(keys, key);
    if (!result) {
        const invalidKeyError = Error('invalid authorization header');
        req.log.error('invalid authorization header: `%s`', header);
        res.code(401).send({ error:  invalidKeyError.message });
        return;
    }
    next();
  }
  return apiKeyAuthHook;
}

function authenticate(keys: Set<string>, key) {
  return Array.from(keys).findIndex(a => a === key) !== -1;
}
