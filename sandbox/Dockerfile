FROM node:24-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production

COPY sandbox/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund

COPY sandbox/worker.mjs ./worker.mjs

USER node
ENTRYPOINT ["node", "/app/worker.mjs"]
