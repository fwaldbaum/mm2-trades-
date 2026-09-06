# Despliegue · MM2 Trades Creator Dashboard

## Lo que hay que saber antes

La aplicacion guarda **todo** en un fichero SQLite: creadores, envios,
balances, retiros y auditoria. De ahi salen dos condiciones que no son
negociables:

1. **Disco persistente obligatorio.** Sin un volumen montado, cada
   despliegue o reinicio borra la base de datos entera. En Render eso
   significa un plan de pago: el plan gratuito no admite discos.
2. **`SESSION_SECRET` obligatorio.** En produccion la aplicacion se niega
   a arrancar sin el, a proposito: sin secreto estable, cualquier
   reinicio invalidaria las sesiones y las cookies no serian fiables.

No despliegues esto en plataformas *serverless* (Vercel, Netlify
Functions, Cloudflare Workers): no tienen disco persistente ni proceso
duradero, y SQLite no funcionaria.

---

## Render (recomendado)

El repositorio incluye `render.yaml`, asi que Render lo configura solo.

> **Rama.** `render.yaml` apunta a `claude/mm2-trades-creator-dashboard-rxyr2z`,
> que es donde vive el codigo del dashboard. La rama `main` todavia contiene
> el prototipo anterior. Cuando fusiones, cambia `branch:` a `main` en
> `render.yaml` y Render pasara a seguir esa rama.

1. En Render: **New → Blueprint**.
2. Conecta el repositorio `fwaldbaum/mm2-trades-`.
3. Selecciona la rama `claude/mm2-trades-creator-dashboard-rxyr2z` y confirma.
   Render lee `render.yaml` y crea:
   - un servicio web Node con `npm ci` y `npm run start:prod`,
   - un disco de 1 GB montado en `/data`,
   - `SESSION_SECRET` generado automaticamente,
   - comprobacion de vida contra `/api/health`.
4. Ajusta `region` en `render.yaml` si tu audiencia no esta en Europa.

El primer arranque crea el esquema, los 5 tiers y las 18 recompensas MM2.
Los despliegues siguientes vuelven a ejecutar el sembrado, que es
idempotente: no duplica ni pisa nada, y conserva los datos existentes.

### Alta del primer creador

En produccion no se crea ningun usuario de ejemplo (`SEED_DEMO=false`).
Registra tu cuenta desde la propia pantalla de acceso y despues elevala a
administrador desde la consola de Render (**Shell**):

```bash
node -e "require('./src/db').db.prepare(\"UPDATE users SET role='admin' WHERE email=?\").run('tu@correo.com')"
```

---

## Fly.io

```bash
fly launch --no-deploy
fly volumes create mm2trades_data --size 1
fly secrets set SESSION_SECRET=$(openssl rand -hex 32) SECURE_COOKIES=true SEED_DEMO=false
fly deploy
```

En `fly.toml` monta el volumen en `/data` y apunta
`DATABASE_FILE=/data/mm2trades.sqlite`.

---

## VPS propio con Docker

```bash
echo "SESSION_SECRET=$(openssl rand -hex 32)" > .env
echo "SECURE_COOKIES=true" >> .env
docker compose up -d
```

Detras de un proxy inverso con HTTPS (Caddy, Nginx, Traefik) apunta al
puerto 3000. `SECURE_COOKIES=true` solo es correcto si el trafico llega
por HTTPS.

---

## Variables de entorno

| Variable | Produccion | Para que |
|---|---|---|
| `SESSION_SECRET` | **obligatoria** | Firma las cookies de sesion |
| `DATABASE_FILE` | `/data/mm2trades.sqlite` | Debe apuntar al disco persistente |
| `SECURE_COOKIES` | `true` | Marca las cookies como `Secure` (solo con HTTPS) |
| `SEED_DEMO` | `false` | Evita crear el creador de demostracion |
| `NODE_ENV` | `production` | Activa cache de estaticos y exige el secreto |
| `PORT` | lo asigna la plataforma | Puerto de escucha |
| `RATE_LIMIT_*_MAX` | opcional | Ajusta los limites anti-abuso |

---

## Copias de seguridad

La base de datos es un unico fichero. Con el servicio en marcha, usa la
copia en caliente de SQLite (no copies el fichero a pelo: hay un diario
WAL abierto):

```bash
sqlite3 /data/mm2trades.sqlite ".backup '/data/copia-$(date +%F).sqlite'"
```

Descarga esa copia fuera del servidor con la periodicidad que necesites.

---

## Comprobaciones tras el despliegue

```bash
BASE=https://tu-dominio

curl -s $BASE/api/health
# {"ok":true,...}

curl -s $BASE/api/program | grep -o '"methods":\[[^]]*\]'
# "methods":["robux","mm2_item"]   <- unicos metodos de retiro

curl -sI $BASE/ | grep -i content-security-policy
# la CSP debe estar presente

curl -s $BASE/api/me/dashboard
# {"ok":false,...,"unauthorized"}  <- sin sesion no se accede
```

Comprueba tambien que la cookie de sesion llega con `Secure` y `HttpOnly`
al iniciar sesion, y que tras un redespliegue los datos siguen ahi (esa
es la prueba de que el disco persistente esta bien montado).
