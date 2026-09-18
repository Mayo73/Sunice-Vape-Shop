# Build the SPA, then hand the static files to Caddy. Nothing from the build
# stage ships: the final image is Caddy plus a directory of files.

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines these at build time, so they are build arguments rather than
# runtime environment. Changing them means rebuilding the image.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
# "/" normally; a sub-path like "/shop/" when served behind a reverse proxy
# next to another site on the same domain (see .env.example).
ARG BASE_PATH=/
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV BASE_PATH=$BASE_PATH

RUN npm run build


FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
