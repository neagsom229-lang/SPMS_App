FROM node:26-alpine

# Install ODBC dependencies
RUN apk add --no-cache \
    unixodbc \
    unixodbc-dev \
    g++ \
    make \
    python3 \
    curl \
    tzdata

# For SQL Server ODBC driver
RUN apk add --no-cache --virtual .build-deps curl && \
    curl -O https://download.microsoft.com/download/e/4/e/e4e67866-dffd-428c-aac7-8d28ddafb39b/msodbcsql17_17.10.4.1-1_amd64.apk && \
    apk add --allow-untrusted msodbcsql17_17.10.4.1-1_amd64.apk && \
    rm msodbcsql17_17.10.4.1-1_amd64.apk

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./backend/

# Install backend dependencies
RUN cd backend && \
    npm ci --only=production --no-audit && \
    npm cache clean --force

# Copy backend source code
COPY backend/ ./backend/

# Copy database
COPY database/ ./database/

WORKDIR /app/backend

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 5000

CMD ["node", "server.js"]