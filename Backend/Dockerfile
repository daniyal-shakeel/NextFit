# Base image
FROM node:25-alpine

# Work directory
WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy full project
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 4000

# Run production build
CMD ["npm", "run", "start"]