# SchichtPlan Pro — Produktiv-Image für den Betrieb im Firmennetz.
# Multi-Stage-Build: Stage 1 baut Frontend + Server, Stage 2 enthält nur das
# fertige Ergebnis plus Produktions-Abhängigkeiten (kleineres, schlankeres Image).

FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------------------------------------------------------------------------

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# Laufzeit-Datenbank: wird als Volume gemountet, damit Daten einen
# Container-Neustart/-Rebuild überleben (siehe README/DATENSCHUTZ.md).
VOLUME ["/app/data"]

EXPOSE 3000
CMD ["node", "dist/server.cjs"]
