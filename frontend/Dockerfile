FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm config set strict-ssl false \
    && npm install --no-audit --no-fund

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]