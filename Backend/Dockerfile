# syntax=docker/dockerfile:1

# =========================
# BUILD STAGE
# =========================
FROM node:22-alpine AS builder

WORKDIR /app

# dependency files (LOCK FILE REQUIRED)
COPY package.json ./
COPY package-lock.json ./

# install deps using lock file
RUN npm ci

# copy source code
COPY . .

# build TS → JS
RUN npm run build


# =========================
# PRODUCTION STAGE
# =========================
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# install only production deps (again using lock file)
COPY package.json ./
COPY package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# copy compiled output only
COPY --from=builder /app/dist ./dist

# security: non-root user
USER node

EXPOSE 4000

CMD ["node", "dist/app.js"]