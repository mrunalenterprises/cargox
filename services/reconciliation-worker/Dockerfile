FROM node:22-alpine
WORKDIR /app
COPY services/reconciliation-worker/worker.mjs ./worker.mjs
USER node
CMD ["node","worker.mjs"]
