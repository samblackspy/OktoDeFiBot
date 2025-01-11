FROM node:18-slim

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy the rest of the application
COPY . .

# Set Node.js to run in production mode
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=256"

# Add a healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/ || exit 1

# Expose the port your app runs on
EXPOSE 3000

# Start the application with proper error handling
CMD ["node", "-e", "process.on('uncaughtException', err => { console.error('Uncaught Exception:', err); process.exit(1); }); process.on('unhandledRejection', (reason, promise) => { console.error('Unhandled Rejection at:', promise, 'reason:', reason); process.exit(1); }); require('./index.js');"]
