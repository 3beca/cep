FROM node:12.11.1-alpine

ENV NODE_ENV=production

WORKDIR /var/www

COPY ./package*.json ./

RUN npm ci

COPY ./build ./build

CMD ["node", "build/main.js"]