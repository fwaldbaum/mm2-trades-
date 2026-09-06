-- =====================================================================
-- MM2 TRADES — Creator Dashboard
-- Esquema de base de datos (SQLite)
--
-- Reglas de negocio codificadas aqui:
--  * Toda cantidad monetaria se guarda en ROBUX ENTEROS (columna *_robux).
--  * Los unicos metodos de retiro posibles son 'robux' y 'mm2_item'.
--    El CHECK de la tabla withdrawals lo garantiza a nivel de motor.
--  * El balance nunca se escribe desde el cliente: solo desde los
--    servicios del servidor dentro de transacciones, con su asiento
--    correspondiente en ledger_entries.
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- Configuracion global editable por administracion
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,               -- JSON serializado
  description TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- Cuentas
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'creator'
                CHECK (role IN ('creator','staff','admin')),
  status        TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','suspended')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent TEXT,
  ip         TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ---------------------------------------------------------------------
-- Tiers (niveles de creador) — configurables desde administracion
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tiers (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  key                 TEXT NOT NULL UNIQUE,        -- T5, T4, T3, T2, T1
  name                TEXT NOT NULL,               -- Starter, Creator, ...
  rank                INTEGER NOT NULL UNIQUE,     -- 1 = mas bajo
  long_rate_per_1k    INTEGER NOT NULL DEFAULT 0,  -- R$ por 1.000 views (long-form)
  short_rate_per_1k   INTEGER NOT NULL DEFAULT 0,  -- R$ por 1.000 views (short-form)
  multiplier          REAL    NOT NULL DEFAULT 1,  -- multiplicador aplicado en la formula
  min_subscribers     INTEGER,                     -- requisito (NULL = sin definir)
  min_avg_views       INTEGER,                     -- requisito alternativo
  benefits            TEXT NOT NULL DEFAULT '[]',  -- JSON array de strings
  requirements_note   TEXT,
  active              INTEGER NOT NULL DEFAULT 1,
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- Creadores
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS creators (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name      TEXT NOT NULL,
  tier_id           INTEGER REFERENCES tiers(id),
  roblox_username   TEXT,
  roblox_user_id    TEXT,
  roblox_verified   INTEGER NOT NULL DEFAULT 0,
  avatar_url        TEXT,
  country           TEXT,
  contact_discord   TEXT,
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','paused','banned')),
  subscribers       INTEGER NOT NULL DEFAULT 0,
  avg_views         INTEGER NOT NULL DEFAULT 0,
  joined_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Codigo de creador / referido
CREATE TABLE IF NOT EXISTS creator_codes (
  code       TEXT PRIMARY KEY,
  creator_id INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_codes_creator ON creator_codes(creator_id);

-- Eventos de uso del codigo (clicks / usos / conversiones)
CREATE TABLE IF NOT EXISTS code_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  code           TEXT NOT NULL REFERENCES creator_codes(code) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('click','use','conversion')),
  revenue_robux  INTEGER NOT NULL DEFAULT 0,  -- valor de la compra asociada
  source         TEXT,
  occurred_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_code_events_code_date ON code_events(code, occurred_at);

-- ---------------------------------------------------------------------
-- Submissions (contenido enviado a revision)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS submissions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id          TEXT NOT NULL UNIQUE,      -- SB-000123
  creator_id         INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  url                TEXT NOT NULL,
  url_key            TEXT NOT NULL,             -- url normalizada, evita duplicados
  platform           TEXT NOT NULL
                     CHECK (platform IN ('youtube','tiktok','instagram','other')),
  content_type       TEXT NOT NULL
                     CHECK (content_type IN ('long_form','short_form','tiktok','youtube_short','instagram_reel')),
  views_reported     INTEGER NOT NULL DEFAULT 0,
  views_verified     INTEGER,
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','in_review','approved','rejected','paid')),
  staff_note         TEXT,
  tier_key_at_submit TEXT,
  rate_at_submit     INTEGER NOT NULL DEFAULT 0,
  estimated_robux    INTEGER NOT NULL DEFAULT 0,
  final_robux        INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at        TEXT,
  paid_at            TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_urlkey ON submissions(url_key);
CREATE INDEX IF NOT EXISTS idx_submissions_creator ON submissions(creator_id, created_at);

-- ---------------------------------------------------------------------
-- Balances y libro mayor
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS creator_balances (
  creator_id      INTEGER PRIMARY KEY REFERENCES creators(id) ON DELETE CASCADE,
  total_earned    INTEGER NOT NULL DEFAULT 0 CHECK (total_earned >= 0),
  available       INTEGER NOT NULL DEFAULT 0 CHECK (available >= 0),
  locked          INTEGER NOT NULL DEFAULT 0 CHECK (locked >= 0),  -- retenido en retiros en curso
  withdrawn       INTEGER NOT NULL DEFAULT 0 CHECK (withdrawn >= 0),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Asientos inmutables. Fuente de verdad auditable del balance.
CREATE TABLE IF NOT EXISTS ledger_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id  INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
                'earning','withdrawal_hold','withdrawal_settle',
                'withdrawal_refund','adjustment')),
  amount      INTEGER NOT NULL,          -- con signo, en R$
  ref_type    TEXT,                      -- 'submission' | 'withdrawal' | NULL
  ref_id      INTEGER,
  memo        TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ledger_creator ON ledger_entries(creator_id, created_at);

-- ---------------------------------------------------------------------
-- Catalogo de items de Murder Mystery 2 canjeables
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mm2_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  rarity      TEXT NOT NULL CHECK (rarity IN
              ('godly','ancient','vintage','legendary','rare','uncommon','common')),
  category    TEXT,                       -- knife / gun / pet / bundle
  value_robux INTEGER NOT NULL CHECK (value_robux >= 0),
  image_url   TEXT,
  accent      TEXT,                       -- color de acento para la tarjeta
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active      INTEGER NOT NULL DEFAULT 1,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_items_rarity ON mm2_items(rarity, active);

-- ---------------------------------------------------------------------
-- Retiros — SOLO Robux o items MM2
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS withdrawals (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id        TEXT NOT NULL UNIQUE,           -- WD-000123
  creator_id       INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  method           TEXT NOT NULL CHECK (method IN ('robux','mm2_item')),
  amount_robux     INTEGER NOT NULL CHECK (amount_robux > 0),
  roblox_username  TEXT,
  roblox_user_id   TEXT,
  item_id          INTEGER REFERENCES mm2_items(id),
  item_snapshot    TEXT,                           -- JSON del item al momento del retiro
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','processing','completed','rejected','cancelled')),
  staff_note       TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at     TEXT,
  -- Coherencia por metodo: Robux exige cuenta destino, item exige item.
  CHECK (
    (method = 'robux'    AND roblox_username IS NOT NULL AND item_id IS NULL) OR
    (method = 'mm2_item' AND item_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_withdrawals_creator ON withdrawals(creator_id, created_at);

-- ---------------------------------------------------------------------
-- Notificaciones
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'info'
             CHECK (type IN ('info','success','warning','danger')),
  icon       TEXT,
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  read_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_creator ON notifications(creator_id, created_at);

-- ---------------------------------------------------------------------
-- Verificacion de cuenta de Roblox (metodo seguro por frase en la bio).
-- Nunca se piden contrasenas, cookies ni tokens.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roblox_verifications (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id      INTEGER NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  roblox_username TEXT NOT NULL,
  phrase          TEXT NOT NULL,
  code            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','verified','rejected','expired')),
  staff_note      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_verif_creator ON roblox_verifications(creator_id, created_at);

-- ---------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_type TEXT NOT NULL DEFAULT 'user',
  actor_id   INTEGER,
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  TEXT,
  meta       TEXT,
  ip         TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);
