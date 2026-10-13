FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY services/portal-api/worker.mjs ./worker.mjs
EXPOSE 8790
CMD ["node","worker.mjs"]
