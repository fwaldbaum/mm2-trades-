# MM2 Trades · Creator Dashboard

Panel de creadores y patrocinios de **MM2 Trades**: los creadores envian su
contenido, siguen sus ganancias y retiran su saldo **en Robux o en items de
Murder Mystery 2**.

No es un panel de administracion: todo lo que hay aqui es la vista del creador.

---

## Regla fundamental del programa

> **Los unicos metodos de retiro son ROBUX e ITEMS DE MURDER MYSTERY 2.**

No existe PayPal, cripto, gift cards, transferencias, tarjetas, dinero real ni
saldo de tienda, y no hay ningun endpoint, componente ni columna que permita
anadirlos. La regla esta impuesta en cuatro capas independientes:

| Capa | Donde | Que hace |
|---|---|---|
| Base de datos | `src/db/schema.sql` | `CHECK (method IN ('robux','mm2_item'))` en `withdrawals` |
| Servicio | `src/services/withdrawals.js` | `METHODS` congelado; valida el metodo antes de tocar nada |
| Configuracion | `src/services/settings.js` | `withdrawalMethods()` filtra cualquier valor ajeno a la lista, aunque se fuerce en la tabla |
| API / interfaz | `src/routes/withdrawals.routes.js`, `public/assets/js/pages/withdraw.js` | Solo se ofrecen los metodos que devuelve el servidor |

Cubierto por pruebas en `tests/api.test.js`.

---

## Puesta en marcha

```bash
npm install
cp .env.example .env      # opcional en desarrollo
npm run seed              # crea el esquema, tiers, catalogo MM2 y datos demo
npm start                 # http://localhost:3000
```

Cuenta de demostracion (solo si `SEED_DEMO=true`):

```
demo@mm2trades.gg  ·  mm2trades2026
```

### Comandos

| Comando | Que hace |
|---|---|
| `npm start` | Arranca el servidor |
| `npm run dev` | Arranca con recarga al guardar |
| `npm run migrate` | Aplica el esquema y la configuracion por defecto |
| `npm run seed` | Migra + carga tiers, catalogo MM2 y creador de ejemplo |
| `npm run reset` | Borra la base de datos |
| `npm test` | Pruebas de la API (26 casos) |

### Variables de entorno

| Variable | Por defecto | Para que sirve |
|---|---|---|
| `PORT` | `3000` | Puerto del servidor |
| `SESSION_SECRET` | generado en desarrollo | Firma las cookies de sesion. **Obligatorio en produccion.** |
| `DATABASE_FILE` | `./data/mm2trades.sqlite` | Ruta del SQLite |
| `SECURE_COOKIES` | `false` | Ponlo a `true` detras de HTTPS |
| `SEED_DEMO` | `true` | Crear datos de ejemplo al hacer seed |
| `RATE_LIMIT_*_MAX` | ver `src/config.js` | Limites anti-abuso por endpoint |

---

## Arquitectura

```
server.js                  Express: seguridad, API, estaticos, SPA
src/
  config.js                Entorno y constantes
  db/
    schema.sql             Esquema completo (se aplica al abrir la conexion)
    index.js               Conexion SQLite (WAL, claves foraneas)
    items.js               Catalogo base de recompensas MM2
  lib/                     crypto, validacion, formula, fechas, auditoria
  middleware/              sesion, limitador, manejo de errores
  services/                Reglas de negocio (fuente de verdad)
  routes/                  Endpoints HTTP
public/                    SPA sin build: HTML + CSS + modulos ES nativos
scripts/                   migrate / seed / reset
tests/api.test.js          Pruebas de la API
```

Sin paso de compilacion: el frontend son modulos ES servidos tal cual.
Dependencias de produccion: `express`, `better-sqlite3`, `cookie-parser`.

---

## Modelo de balance

El saldo nunca se acepta desde el cliente. Se recalcula en el servidor dentro de
transacciones, y cada movimiento deja un asiento inmutable en `ledger_entries`.

```
total_earned = available + locked + withdrawn
```

| Concepto | Significado |
|---|---|
| `total_earned` | Todo lo acreditado historicamente |
| `available` | Listo para retirar |
| `locked` | Retenido por retiros en curso (`pending` / `processing`) |
| `withdrawn` | Ya pagado |
| `pending` | Ganancia estimada de envios sin aprobar. **No** forma parte de `total_earned` |

Flujo: aprobar un envio acredita (`credit`) → solicitar un retiro retiene
(`hold`) → completarlo liquida (`settle`) → rechazarlo o cancelarlo devuelve
(`refund`). `balance.verifyIntegrity(creatorId)` comprueba que el libro mayor
cuadra con el balance.

---

## Que configura administracion

Ningun valor economico esta escrito en el frontend: todo llega de la API.

**Tabla `tiers`** — clave, nombre, rango, tasa por 1.000 views (formato largo y
corto), multiplicador, requisitos (suscriptores / media de views), beneficios.
Una tasa a `0` se muestra en la interfaz como «Por definir» en lugar de inventar
una cifra.

**Tabla `settings`** — entre otras:

| Clave | Para que |
|---|---|
| `earnings.formula` | Formula de ganancias. Por defecto `(views / 1000) * rate * multiplier` |
| `earnings.rounding` | `floor` / `round` / `ceil` |
| `earnings.bonus` | Bonus fijo por envio aprobado |
| `submission.max_per_day`, `submission.rules`, `submission.window_days` | Reglas de envio |
| `withdrawal.min_robux`, `withdrawal.max_robux_per_request` | Limites de retiro |
| `withdrawal.max_open_requests`, `withdrawal.cooldown_hours` | Control de solicitudes |
| `withdrawal.requires_roblox_verification` | Exigir cuenta verificada para retirar |
| `tiers.upgrade_note`, `legal.disclaimer` | Textos del programa |

**Tabla `mm2_items`** — nombre, rareza, categoria, valor en Robux, imagen y
stock de cada recompensa.

La formula se evalua con un analizador propio (`src/lib/formula.js`): sin `eval`
ni `Function`, solo aritmetica, parentesis y `min/max/round/floor/ceil/abs`
sobre las variables `views`, `rate`, `multiplier` y `bonus`. Se valida antes de
guardarse.

Un creador **no** puede cambiar su tier, su codigo, su balance ni su estado:
`PATCH /api/me` solo acepta la lista blanca de `EDITABLE_FIELDS`.

---

## Seguridad

- **Nunca se piden credenciales de Roblox.** `rejectSensitiveFields()` rechaza
  con `400` cualquier peticion que incluya `roblox_password`, `.ROBLOSECURITY`,
  cookies o tokens, en todos los endpoints que aceptan cuerpo.
- Verificacion de cuenta por frase publicada en la descripcion del perfil de
  Roblox: el creador la pega, el staff la comprueba. Sin datos privados.
- Contrasenas con `scrypt` y sal por usuario; comparacion en tiempo constante.
- Sesiones en servidor con cookie `HttpOnly` + `SameSite=Lax`, firmada con HMAC
  y con caducidad; cambiar la contrasena cierra el resto de sesiones.
- Cabeceras: CSP sin `unsafe-eval` ni origenes externos, `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- La interfaz se construye con `document.createElement`, nunca con plantillas de
  HTML sobre datos del servidor: no hay superficie de XSS por interpolacion.
- Limitadores por IP (acceso, alta) y por usuario (envios, retiros, verificacion).
- Registro de auditoria en `audit_logs` para altas, envios, retiros y cambios de
  perfil.

---

## API

Todas las respuestas siguen la forma `{ ok, data }` o
`{ ok: false, error: { code, message, details } }`.

| Metodo | Ruta | Que hace |
|---|---|---|
| `GET` | `/api/health` | Estado del servicio |
| `GET` | `/api/program` | Configuracion publica del programa |
| `POST` | `/api/auth/register` · `/login` · `/logout` · `/password` | Sesion |
| `GET` | `/api/auth/session` | Sesion actual |
| `GET` | `/api/me` · `/me/dashboard` · `/me/balance` · `/me/performance` · `/me/code` · `/me/earnings` · `/me/activity` | Datos del creador |
| `PATCH` | `/api/me` | Editar el perfil (lista blanca) |
| `GET` | `/api/submissions` · `/meta` · `/estimate` · `/:id` | Envios |
| `POST` | `/api/submissions` | Enviar un video |
| `GET` | `/api/withdrawals` · `/meta` · `/:id` | Retiros |
| `POST` | `/api/withdrawals` · `/:id/cancel` | Solicitar / cancelar retiro |
| `GET` | `/api/items` | Catalogo MM2 agrupado por rareza |
| `GET` | `/api/tiers` | Tiers, tier actual y progreso |
| `GET` | `/api/notifications` · `POST /read` · `POST /:id/read` | Notificaciones |
| `GET`/`POST` | `/api/roblox-verification` | Verificacion segura de la cuenta |

---

## Interfaz

Rutas del cliente: `/login`, `/dashboard`, `/sponsors`, `/withdraw`, `/history`,
`/help`, `/profile`.

- Tema oscuro propio, con acentos violeta/cian y verde para los importes en Robux.
- Graficos en SVG escritos a mano, sin librerias. Views y ganancias tienen
  escalas distintas, asi que se muestran por separado con un conmutador — nunca
  en un grafico de doble eje. La paleta categorica del grafico de codigo esta
  validada para daltonismo sobre fondo oscuro.
- Estados de carga (esqueletos), vacio, error, exito y deshabilitado en todas las
  vistas.
- Responsive real: en movil el menu pasa a un panel lateral, las rejillas a una
  columna y **las tablas se convierten en tarjetas**.
- Animaciones sutiles que respetan `prefers-reduced-motion`.

---

MM2 Trades es un servicio comunitario independiente y no esta afiliado a Roblox
Corporation.
