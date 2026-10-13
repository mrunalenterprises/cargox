FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY services/payment-worker/worker.mjs ./worker.mjs
EXPOSE 8788
CMD ["node","worker.mjs"]
