
async function list() {
    return [];
}

export default function(fastify, opts, next) {
    fastify.get('/', opts, list);
    next();
}

