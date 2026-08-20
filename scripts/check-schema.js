const db = require('../db');
(async () => {
  await db.initDb();
  const required = ['users','sessions','campaigns','campaign_members','maps','map_markers','library_records','record_links','library_history','rolls','diary_entries','character_history','character_conditions','character_attacks','character_classes','spell_favorites','prepared_spells'];
const rows = db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
const names = new Set(rows.map(row => row.name));
const missing = required.filter(name => !names.has(name));
console.log(JSON.stringify({ required: required.length, present: required.length - missing.length, missing }, null, 2));
  if (missing.length) process.exitCode = 1;
})();
