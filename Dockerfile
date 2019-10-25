FROM node:13.0.1-alpine

ENV NODE_ENV=production

WORKDIR /var/www

COPY ./package*.json ./

RUN npm ci

COPY ./build ./build

CMD ["node", "build/main.js"]