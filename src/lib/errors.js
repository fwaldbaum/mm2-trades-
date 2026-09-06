'use strict';

class AppError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const badRequest = (code, message, details) => new AppError(400, code, message, details);
const unauthorized = (message = 'Necesitas iniciar sesion.') =>
  new AppError(401, 'unauthorized', message);
const forbidden = (message = 'No tienes permiso para hacer esto.') =>
  new AppError(403, 'forbidden', message);
const notFound = (message = 'Recurso no encontrado.') =>
  new AppError(404, 'not_found', message);
const conflict = (code, message) => new AppError(409, code, message);
const tooMany = (message = 'Demasiadas solicitudes. Intenta de nuevo en un momento.') =>
  new AppError(429, 'rate_limited', message);

/** Adaptador para handlers async en Express 4. */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = {
  AppError, asyncHandler,
  badRequest, unauthorized, forbidden, notFound, conflict, tooMany
};
