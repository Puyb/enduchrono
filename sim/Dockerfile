FROM node:23 AS vue-build-stage

ENV NODE_OPTIONS=--openssl-legacy-provider

WORKDIR /app

COPY ui ./

RUN npm install

RUN npm run build

FROM node:23 AS production-stage

WORKDIR /app

COPY package.json package-lock.json *.js ./

COPY --from=vue-build-stage /app/dist ./ui

RUN npm install

EXPOSE 3002

CMD ["npm", "run", "start"]
