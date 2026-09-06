'use strict';

const fs = require('fs');
const config = require('../src/config');

for (const suffix of ['', '-wal', '-shm']) {
  const file = `${config.databaseFile}${suffix}`;
  if (fs.existsSync(file)) { fs.unlinkSync(file); console.log(`[reset] Eliminado ${file}`); }
}
console.log('[reset] Base de datos borrada. Ejecuta "npm run seed" para regenerarla.');
