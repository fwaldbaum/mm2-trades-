'use strict';

const { AppError } = require('../lib/errors');
const config = require('../config');

function notFoundHandler(req, res, next) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: { code: 'not_found', message: 'Endpoint no encontrado.' } });
  }
  next();
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let code = err.code || 'internal_error';
  let message = err.message || 'Error interno del servidor.';

  // Errores propagados desde SQLite
  if (typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT')) {
    status = 409;
    code = 'constraint_violation';
    message = 'La operacion viola una restriccion de los datos.';
  }
  if (!(err instanceof AppError) && status === 500) {
    if (!config.isProd) console.error(err);
    else console.error(`[error] ${req.method} ${req.originalUrl}:`, err.message);
    message = 'Ha ocurrido un error inesperado. Intentalo de nuevo.';
  }

  res.status(status).json({
    ok: false,
    error: { code, message, details: err.details || undefined }
  });
}

module.exports = { errorHandler, notFoundHandler };
