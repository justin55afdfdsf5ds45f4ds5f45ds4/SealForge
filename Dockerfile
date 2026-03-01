FROM node:20-slim

WORKDIR /app

COPY scripts/package.json scripts/package-lock.json ./
RUN npm ci

COPY scripts/src ./src
COPY scripts/deployed.json ./

CMD ["node", "--import", "tsx", "src/sealforge-agent.ts", "auto"]
