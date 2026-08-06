# Stage 1 — bundle the frontend (React/ReactDOM/JSX compiled locally,
# so the running app never has to fetch anything from a CDN at runtime).
FROM node:20-bookworm-slim AS webbuild
WORKDIR /build
COPY web/package.json ./web/
RUN cd web && npm install
COPY web ./web
COPY public ./public
RUN cd web && npm run build

# Stage 2 — the actual runtime image
FROM node:20-bookworm-slim

# better-sqlite3 needs to compile a native module
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY server/package.json ./server/
RUN cd server && npm install --omit=dev

COPY server ./server
COPY --from=webbuild /build/public ./public

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server/server.js"]
