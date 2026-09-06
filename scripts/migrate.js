'use strict';

const { migrate } = require('../src/db');
const settings = require('../src/services/settings');

migrate();
settings.ensureDefaults();
console.log('[migrate] Esquema aplicado y configuracion por defecto asegurada.');
