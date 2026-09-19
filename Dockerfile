FROM node:18-slim

# Install Git
RUN apt-get update \
    && apt-get install -y git \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the backend
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Production environment
ENV NODE_ENV=production

# Your backend port
EXPOSE 8080

# Start backend
CMD ["node", "src/server.js"]