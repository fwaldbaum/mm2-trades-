'use strict';

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const config = require('./src/config');
require('./src/db'); // aplica el esquema al abrir la conexion
const settings = require('./src/services/settings');
const apiRouter = require('./src/routes');
const { attachUser } = require('./src/middleware/auth');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');

settings.ensureDefaults();

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// --- Cabeceras de seguridad -------------------------------------------
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
    "connect-src 'self'",
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'"
  ].join('; '));
  next();
});

app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use(cookieParser());
app.use(attachUser);

// --- API ---------------------------------------------------------------
app.use('/api', apiRouter);
app.use(notFoundHandler);

// --- Frontend ----------------------------------------------------------
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir, {
  maxAge: config.isProd ? '7d' : 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

// La navegacion la resuelve el router del cliente.
app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));

app.use(errorHandler);

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`MM2 Trades · Creator Dashboard  ->  http://localhost:${config.port}`);
  });
}

module.exports = app;
