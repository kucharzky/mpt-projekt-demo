FROM node:24.22.2-bookworm-slim AS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN chown node:node /app
USER node
ENV SCARF_ANALYTICS=false
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node apps/api/package.json ./apps/api/package.json
COPY --chown=node:node apps/web/package.json ./apps/web/package.json
RUN npm ci --no-audit --no-fund

FROM dependencies AS source
COPY --chown=node:node . .
RUN npm run db:generate

FROM source AS check
RUN npm run build

FROM source AS migration
CMD ["npm", "run", "db:migrate"]

FROM source AS api-development
ENV API_HOST=0.0.0.0
EXPOSE 3001
CMD ["npm", "run", "dev:api"]

FROM check AS runtime-dependencies
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:24.22.2-bookworm-slim AS production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production API_HOST=0.0.0.0
COPY --from=runtime-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=check --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=check --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=check --chown=node:node /app/apps/web/dist ./apps/web/dist
COPY --from=check --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]

FROM source AS development
EXPOSE 5173
CMD ["npm", "run", "dev", "--workspace", "@smartuni/web", "--", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
