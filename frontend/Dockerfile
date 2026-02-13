# ============================================
# MasterUz — Frontend Dockerfile
# Агент 5 (DevOps-инженер)
# ============================================

FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Build
FROM deps AS builder
COPY . .
ARG VITE_API_URL=/api
ARG VITE_TELEGRAM_BOT_NAME=MasterUzBot
ARG VITE_YANDEX_MAPS_KEY=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_TELEGRAM_BOT_NAME=$VITE_TELEGRAM_BOT_NAME
ENV VITE_YANDEX_MAPS_KEY=$VITE_YANDEX_MAPS_KEY
RUN npm run build

# Serve with nginx
FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
