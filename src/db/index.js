'use strict';

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

const db = new Database(config.databaseFile);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

/** Aplica el esquema. Es idempotente (todo es CREATE ... IF NOT EXISTS). */
function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(sql);
  return db;
}

// El esquema se aplica al abrir la conexion: los servicios preparan sus
// sentencias al cargarse y necesitan que las tablas ya existan.
migrate();

/** Envuelve una funcion en una transaccion inmediata. */
function tx(fn) {
  return db.transaction(fn);
}

module.exports = { db, migrate, tx };
