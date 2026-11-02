FROM node:20-alpine AS base
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/ics-parser/package.json packages/ics-parser/

RUN npm install --workspace=@mpt/api --include-workspace-root=false || npm install

COPY packages ./packages
COPY apps/api ./apps/api

WORKDIR /app/apps/api
RUN npx prisma generate || true
RUN npm run build || true

EXPOSE 3000
CMD ["node", "dist/main.js"]
