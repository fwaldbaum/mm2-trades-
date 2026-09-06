'use strict';

const { db } = require('../db');

const insert = db.prepare(`
  INSERT INTO notifications (creator_id, type, icon, title, body, link)
  VALUES (@creator_id, @type, @icon, @title, @body, @link)
`);
const selectList = db.prepare(`
  SELECT * FROM notifications WHERE creator_id = ?
  ORDER BY created_at DESC, id DESC LIMIT ?
`);
const countUnread = db.prepare(`
  SELECT COUNT(*) AS n FROM notifications WHERE creator_id = ? AND read_at IS NULL
`);
const markAll = db.prepare(`
  UPDATE notifications SET read_at = datetime('now')
  WHERE creator_id = ? AND read_at IS NULL
`);
const markOne = db.prepare(`
  UPDATE notifications SET read_at = datetime('now')
  WHERE id = ? AND creator_id = ? AND read_at IS NULL
`);

function push(creatorId, { type = 'info', icon = null, title, body = null, link = null }) {
  insert.run({ creator_id: creatorId, type, icon, title, body, link });
}

const list = (creatorId, limit = 30) => selectList.all(creatorId, limit);
const unread = (creatorId) => countUnread.get(creatorId).n;
const readAll = (creatorId) => markAll.run(creatorId).changes;
const readOne = (id, creatorId) => markOne.run(id, creatorId).changes;

module.exports = { push, list, unread, readAll, readOne };
