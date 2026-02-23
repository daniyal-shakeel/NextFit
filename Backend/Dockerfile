# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Run stage
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Copy runtime files if your app needs them
COPY --from=builder /app/firebase-service-account.json ./firebase-service-account.json

# If you use uploads at runtime, we’ll mount a volume in compose
EXPOSE 3001
CMD ["node", "dist/app.js"]