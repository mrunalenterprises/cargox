FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY services/notification-worker/worker.mjs ./worker.mjs
CMD ["node","worker.mjs"]
