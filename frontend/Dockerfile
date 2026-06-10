FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_TLS_REJECT_UNAUTHORIZED=0
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./

RUN npm config set strict-ssl false \
    && npm install --no-audit --no-fund

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]