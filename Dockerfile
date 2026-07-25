# Produktions-Image für "Lese-Abenteuer" — gedacht für Deployment über Coolify
# auf einem Hetzner-Server (siehe docs/DEPLOYMENT.md). Nutzt Next.js'
# `output: 'standalone'` (next.config.ts) für ein möglichst schlankes Image.
#
# Node-Version: an README.md orientiert (Node >= 20.9 erforderlich). Bei
# Bedarf auf die tatsächlich getestete Version anpassen.

# --- Stage 1: Dependencies ---
FROM node:22-alpine AS deps
WORKDIR /app

# package-lock.json UND prisma/schema.prisma vor `npm ci` kopieren: der
# postinstall-Hook (`prisma generate`) braucht das Schema bereits an dieser
# Stelle, sonst schlägt die Installation fehl.
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

# --- Stage 2: Build ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# Der generierte Prisma-Client liegt wegen des eigenen "output"-Pfads in
# prisma/schema.prisma (src/generated/prisma) NICHT in node_modules und ist
# über .gitignore bewusst nicht im Repo — muss deshalb explizit aus der
# deps-Stage übernommen werden, sonst schlägt "npm run build" mit
# "Module not found: Can't resolve '@/generated/prisma/client'" fehl.
COPY --from=deps /app/src/generated/prisma ./src/generated/prisma
COPY . .

# Next Telemetry ist im Projekt bereits deaktiviert (siehe docs/SECURITY.md),
# hier zusätzlich zur Sicherheit auch für den Build-Schritt.
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# --- Stage 3: Runtime ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js liest PORT/HOSTNAME zur Laufzeit für den Standalone-Server.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Nicht als root laufen lassen.
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Statische Assets (SVG-Illustrationen etc.) und der Standalone-Server-Output.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma-Migrationen werden NICHT beim Container-Start automatisch
# ausgeführt (siehe docs/DEPLOYMENT.md) — `npm run db:migrate:deploy` läuft
# als separater Schritt vor dem Deployment, nicht implizit beim Hochfahren.
# Das verhindert, dass mehrere gleichzeitig startende Instanzen dieselbe
# Migration parallel ausführen.

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
