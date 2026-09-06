'use strict';

const { db } = require('../db');

const stmt = () => db.prepare(`
  INSERT INTO audit_logs (actor_type, actor_id, action, entity, entity_id, meta, ip)
  VALUES (@actor_type, @actor_id, @action, @entity, @entity_id, @meta, @ip)
`);

let cached = null;

function log({ actorType = 'user', actorId = null, action, entity = null, entityId = null, meta = null, ip = null }) {
  if (!cached) cached = stmt();
  cached.run({
    actor_type: actorType,
    actor_id: actorId,
    action,
    entity,
    entity_id: entityId === null ? null : String(entityId),
    meta: meta ? JSON.stringify(meta) : null,
    ip
  });
}

module.exports = { log };
