FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY client/package.json ./client/

RUN npm install

COPY server ./server
COPY shared ./shared

RUN mkdir -p /app/data

VOLUME /app/data

ENV PORT=3001
EXPOSE 3001

CMD ["npm", "run", "start", "--workspace=server"]
