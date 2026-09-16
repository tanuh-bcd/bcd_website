FROM node:22-alpine
WORKDIR /app
# The public API bridge uses only Node built-ins and needs no DB credentials.
COPY backend/portal-proxy.js ./portal-proxy.mjs
ENV HOST=0.0.0.0
EXPOSE 3001
CMD ["node", "portal-proxy.mjs"]
