FROM node:23 AS production-stage

WORKDIR /app

COPY package.json package-lock.json *.js ./

RUN npm install

EXPOSE 3001

CMD ["npm", "run", "start"]

