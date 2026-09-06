# =====================================================================
# MM2 Trades · Creator Dashboard
#
# Imagen de produccion. Dos etapas: la primera compila las dependencias
# nativas (better-sqlite3), la segunda solo lleva lo necesario para
# ejecutar, sin compiladores.
# =====================================================================

# ------------------------- Etapa de construccion ---------------------
FROM node:22-bookworm-slim AS builder

# Herramientas necesarias solo si npm no encuentra binario precompilado
# para better-sqlite3. No llegan a la imagen final.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ------------------------- Imagen final ------------------------------
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_FILE=/data/mm2trades.sqlite

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY server.js ./
COPY src ./src
COPY scripts ./scripts
COPY public ./public

# El volumen persistente guarda la base de datos. Sin el, cada
# despliegue empezaria de cero.
RUN mkdir -p /data && chown -R node:node /data /app
VOLUME ["/data"]

USER node
EXPOSE 3000

# Comprobacion de vida: el orquestador reinicia el contenedor si falla.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Aplica el esquema y asegura tiers y catalogo antes de arrancar.
# Es idempotente: en despliegues posteriores no duplica ni pisa nada.
CMD ["sh", "-c", "node scripts/seed.js && node server.js"]
