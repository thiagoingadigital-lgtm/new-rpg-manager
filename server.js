const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const db = require('./db'); // SQLite (sql.js WASM) — banco local, existe apenas enquanto a app roda
const { initDb } = db;

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(express.json());
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'home.html')));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Upload de imagens (retrato do personagem) ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.params.id}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) return cb(new Error('Formato de imagem não suportado'));
    cb(null, true);
  },
});

// ---------- Helpers ----------
function newId() {
  return crypto.randomUUID();
}

// ---------- Modelo base de um personagem ----------
// {
//   id, name, class, race, level,
//   attributes: { forca, destreza, constituicao, inteligencia, sabedoria, carisma },
//   features: [ { id, name, description } ],
//   resources: [ { id, name, current, max } ]
// }

const SKILL_KEYS = [
  'acrobacia', 'arcanismo', 'atletismo', 'atuacao', 'enganacao', 'furtividade',
  'historia', 'intimidacao', 'intuicao', 'investigacao', 'lidarComAnimais',
  'medicina', 'natureza', 'percepcao', 'persuasao', 'prestidigitacao',
  'religiao', 'sobrevivencia',
];
const ABILITY_KEYS = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];

function sanitizeCharacter(body, existing = {}) {
  const skillProficiencies = {};
  SKILL_KEYS.forEach((key) => {
    const incoming = body.skillProficiencies?.[key];
    const prev = existing.skillProficiencies?.[key];
    skillProficiencies[key] = {
      proficient: incoming?.proficient ?? prev?.proficient ?? false,
      expertise: incoming?.expertise ?? prev?.expertise ?? false,
    };
  });

  const saveProficiencies = {};
  ABILITY_KEYS.forEach((key) => {
    saveProficiencies[key] = body.saveProficiencies?.[key] ?? existing.saveProficiencies?.[key] ?? false;
  });

  return {
    id: existing.id || newId(),
    name: body.name ?? existing.name ?? 'Sem nome',
    class: body.class ?? existing.class ?? '',
    race: body.race ?? existing.race ?? '',
    level: Number(body.level ?? existing.level ?? 1),
    attributes: {
      forca: Number(body.attributes?.forca ?? existing.attributes?.forca ?? 10),
      destreza: Number(body.attributes?.destreza ?? existing.attributes?.destreza ?? 10),
      constituicao: Number(body.attributes?.constituicao ?? existing.attributes?.constituicao ?? 10),
      inteligencia: Number(body.attributes?.inteligencia ?? existing.attributes?.inteligencia ?? 10),
      sabedoria: Number(body.attributes?.sabedoria ?? existing.attributes?.sabedoria ?? 10),
      carisma: Number(body.attributes?.carisma ?? existing.attributes?.carisma ?? 10),
    },
    skillProficiencies,
    saveProficiencies,
    features: body.features ?? existing.features ?? [],
    resources: body.resources ?? existing.resources ?? [],
    items: body.items ?? existing.items ?? [],
    spells: body.spells ?? existing.spells ?? [],
    spellSlotsUsage: body.spellSlotsUsage ?? existing.spellSlotsUsage ?? {},
    imageUrl: body.imageUrl ?? existing.imageUrl ?? null,
  };
}

function sanitizeSpell(body, existing = {}) {
  return {
    id: existing.id || newId(),
    name: body.name ?? existing.name ?? 'Novo feitiço',
    school: body.school ?? existing.school ?? '',
    level: Number(body.level ?? existing.level ?? 1),
    casted: body.casted ?? existing.casted ?? false,
  };
}

// Monta o objeto completo do personagem a partir das tabelas do SQLite
function loadCharacter(id) {
  const row = db.get(`
    SELECT id, name, class, race, level, attributes, skillProficiencies, saveProficiencies,
           resources, items, spellSlotsUsage, imageUrl, createdAt, updatedAt
    FROM characters WHERE id = ?
  `, [id]);
  if (!row) return null;

  const features = db.all(`SELECT id, name, description FROM character_features WHERE characterId = ?`, [id]);
  const spells = db.all(`SELECT id, name, school, level, casted FROM character_spells WHERE characterId = ?`, [id]);
  for (const s of spells) s.casted = s.casted === 1;

  return {
    ...row,
    attributes: JSON.parse(row.attributes),
    skillProficiencies: JSON.parse(row.skillProficiencies),
    saveProficiencies: JSON.parse(row.saveProficiencies),
    resources: JSON.parse(row.resources),
    items: JSON.parse(row.items),
    spellSlotsUsage: JSON.parse(row.spellSlotsUsage),
    features,
    spells,
  };
}

// ---------- Migração do JSON antigo para o SQLite — movida para db.js (initDb) ----------

// ---------- Rotas: Referência da classe Paladino (mantida p/ compatibilidade do frontend) ----------
const paladinReference = (() => {
  const file = path.join(__dirname, 'data', 'paladin-reference.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (err) {
    console.error('Erro ao carregar paladin-reference.json:', err);
    return null;
  }
})();

app.get('/api/paladin/reference', (req, res) => {
  if (!paladinReference) return res.status(503).json({ error: 'Base de dados de referência indisponível' });
  res.json(paladinReference);
});

app.get('/api/paladin/spells', (req, res) => {
  if (!paladinReference) return res.status(503).json({ error: 'Base de dados de referência indisponível' });
  let spells = [...paladinReference.spells];
  const { level, school, name, q, optional } = req.query;
  if (level) spells = spells.filter((s) => s.level === Number(level));
  if (school) spells = spells.filter((s) => s.school.toLowerCase() === String(school).toLowerCase());
  if (optional !== undefined) spells = spells.filter((s) => s.optional === (optional === 'true'));
  if (name) spells = spells.filter((s) => s.name.toLowerCase().includes(String(name).toLowerCase()));
  if (q) spells = spells.filter((s) => (s.name + ' ' + s.school).toLowerCase().includes(String(q).toLowerCase()));
  spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'pt'));
  res.json(spells);
});

app.get('/api/paladin/spell-slots', (req, res) => {
  const level = Math.min(20, Math.max(1, Number(req.query.level) || 1));
  const row = db.get(`SELECT slots FROM spell_slots WHERE classId = (SELECT id FROM classes WHERE slug='paladino') AND level = ?`, [level]);
  res.json({ level, slots: row ? JSON.parse(row.slots) : { '1': 0 } });
});

app.get('/api/paladin/proficiency', (req, res) => {
  const level = Math.min(20, Math.max(1, Number(req.query.level) || 1));
  const row = db.get('SELECT bonus FROM proficiency_bonus WHERE level = ?', [level]);
  res.json({ level, bonus: row ? row.bonus : 2 });
});

// ---------- Rotas: Classes básicas do D&D 5e (SQLite) ----------

// Lista de todas as classes
app.get('/api/classes', (req, res) => {
  res.json(db.all('SELECT id, slug, name, icon, hitDie, primaryAbility, casting, castingAbility, role, description FROM classes ORDER BY name'));
});

// Uma classe com todas as features
app.get('/api/classes/:slug', (req, res) => {
  const cls = db.get('SELECT * FROM classes WHERE slug = ?', [req.params.slug]);
  if (!cls) return res.status(404).json({ error: 'Classe não encontrada' });
  const features = db.all(`SELECT name, level, description FROM class_features WHERE classId = ? ORDER BY level, name`, [cls.id]);
  const slots = db.all(`SELECT level, slots FROM spell_slots WHERE classId = ? ORDER BY level`, [cls.id]);
  res.json({ ...cls, features, spellSlots: slots.reduce((acc, r) => { acc[r.level] = JSON.parse(r.slots); return acc; }, {}) });
});

// Busca de features por termo: ?q=termo&class=paladino
app.get('/api/classes/features/search', (req, res) => {
  const { q, cls: clsSlug, level } = req.query;
  // Busca case/acentos-insensível: SQLite por padrão não ignora acentos no LIKE,
  // então removemos acentos do termo E das colunas antes de comparar.
  const stripAccents = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  let sql = `SELECT cf.name, cf.level, cf.description, c.name AS className, c.slug AS classSlug, c.icon
             FROM class_features cf JOIN classes c ON c.id = cf.classId WHERE 1=1`;
  const params = [];
  if (q) {
    // Expressão que remove acentos de forma dinâmica (22 pares de substituição)
    const pairs = [
      ['á','a'],['é','e'],['í','i'],['ó','o'],['ú','u'],['â','a'],['ê','e'],['ô','o'],['ã','a'],['õ','o'],['ç','c'],
      ['Á','A'],['É','E'],['Í','I'],['Ó','O'],['Ú','U'],['Â','A'],['Ê','E'],['Ô','O'],['Ã','A'],['Õ','O'],['Ç','C'],
    ];
    const makeUnacc = (value) => {
      let expr = value;
      for (const [from, to] of pairs) expr = `REPLACE(${expr},'${from}','${to}')`;
      return `(LOWER(${expr}) LIKE ?)`;
    };
    const term = stripAccents(q);
    sql += ` AND (${makeUnacc('cf.name')} OR ${makeUnacc('c.name')} OR ${makeUnacc('cf.description')})`;
    params.push(`%${term}%`, `%${term}%`, `%${term}%`);
  }
  if (clsSlug) { sql += ` AND c.slug = ?`; params.push(clsSlug); }
  if (level) { sql += ` AND cf.level <= ?`; params.push(Number(level)); }
  sql += ` ORDER BY c.name, cf.level, cf.name`;
  res.json(db.all(sql, params));
});

// Proficiência por nível (tabela geral, consulta ao SQLite)
app.get('/api/proficiency', (req, res) => {
  const level = Math.min(20, Math.max(1, Number(req.query.level) || 1));
  const row = db.get('SELECT bonus FROM proficiency_bonus WHERE level = ?', [level]);
  res.json({ level, bonus: row ? row.bonus : 2 });
});

// Spell slots de qualquer classe: ?class=barbaro&level=5
app.get('/api/spell-slots', (req, res) => {
  const cls = db.get(`SELECT id, slug, name, casting FROM classes WHERE slug = ?`, [req.query.class || 'paladino']);
  if (!cls) return res.status(404).json({ error: 'Classe não encontrada' });
  const level = Math.min(20, Math.max(1, Number(req.query.level) || 1));
  const row = db.get('SELECT slots FROM spell_slots WHERE classId = ? AND level = ?', [cls.id, level]);
  res.json({ class: cls.slug, className: cls.name, casting: cls.casting, level, slots: row ? JSON.parse(row.slots) : {} });
});

// Feitiços da base de referência (SQLite espelha paladin-reference.json via seed no db.js se desejar,
// mas por enquanto servimos os feitiços do paladino direto do JSON, mantendo a fonte única).
app.get('/api/spells', (req, res) => {
  if (!paladinReference) return res.status(503).json({ error: 'Base de feitiços indisponível' });
  let spells = [...paladinReference.spells];
  const { level, school, q, optional } = req.query;
  if (level) spells = spells.filter((s) => s.level === Number(level));
  if (school) spells = spells.filter((s) => s.school.toLowerCase() === String(school).toLowerCase());
  if (optional !== undefined) spells = spells.filter((s) => s.optional === (optional === 'true'));
  if (q) spells = spells.filter((s) => (s.name + ' ' + s.school).toLowerCase().includes(String(q).toLowerCase()));
  spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'pt'));
  res.json(spells);
});

// ---------- Rotas: Personagens (SQLite) ----------

// Hall dos heróis: personagens resumidos, ordenados por nível (para a Home)
app.get('/api/characters/hall', (req, res) => {
  res.json(db.all(`
    SELECT id, name, class, race, level, imageUrl, createdAt
    FROM characters ORDER BY level DESC, updatedAt DESC
  `));
});

// Listar todos
app.get('/api/characters', (req, res) => {
  const rows = db.all(`SELECT id, name, class, race, level, imageUrl FROM characters ORDER BY updatedAt DESC`);
  res.json(rows);
});

// Buscar um (completo, com features e spells)
app.get('/api/characters/:id', (req, res) => {
  const character = loadCharacter(req.params.id);
  if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });
  res.json(character);
});

// Criar
app.post('/api/characters', (req, res) => {
  const character = sanitizeCharacter(req.body || {});
  db.run(`
    INSERT INTO characters (id, name, class, race, level, attributes, skillProficiencies,
                            saveProficiencies, resources, items, spellSlotsUsage, imageUrl, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `, [
    character.id, character.name, character.class, character.race, character.level,
    JSON.stringify(character.attributes),
    JSON.stringify(character.skillProficiencies),
    JSON.stringify(character.saveProficiencies),
    JSON.stringify(character.resources),
    JSON.stringify(character.items),
    JSON.stringify(character.spellSlotsUsage),
    character.imageUrl,
  ]);
  res.status(201).json(character);
});

// Atualizar (dados gerais, atributos, recursos, itens etc.)
app.put('/api/characters/:id', (req, res) => {
  const existing = loadCharacter(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Personagem não encontrado' });

  const updated = sanitizeCharacter(req.body || {}, existing);
  db.run(`
    UPDATE characters SET name = ?, class = ?, race = ?, level = ?,
                          attributes = ?, skillProficiencies = ?,
                          saveProficiencies = ?, resources = ?,
                          items = ?, spellSlotsUsage = ?,
                          imageUrl = ?, updatedAt = datetime('now')
    WHERE id = ?
  `, [
    updated.name, updated.class, updated.race, updated.level,
    JSON.stringify(updated.attributes),
    JSON.stringify(updated.skillProficiencies),
    JSON.stringify(updated.saveProficiencies),
    JSON.stringify(updated.resources),
    JSON.stringify(updated.items),
    JSON.stringify(updated.spellSlotsUsage),
    updated.imageUrl,
    updated.id,
  ]);
  res.json(updated);
});

// Excluir
app.delete('/api/characters/:id', (req, res) => {
  const existing = db.get('SELECT imageUrl FROM characters WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Personagem não encontrado' });
  db.run('DELETE FROM characters WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

// ---------- Rotas: Imagem do personagem ----------

app.post('/api/characters/:id/image', upload.single('image'), (req, res) => {
  const character = db.get('SELECT id, imageUrl FROM characters WHERE id = ?', [req.params.id]);
  if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });
  if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada' });

  if (character.imageUrl) {
    const oldPath = path.join(__dirname, 'public', character.imageUrl);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  db.run("UPDATE characters SET imageUrl = ?, updatedAt = datetime('now') WHERE id = ?", [`/uploads/${req.file.filename}`, character.id]);
  res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

app.delete('/api/characters/:id/image', (req, res) => {
  const character = db.get('SELECT id, imageUrl FROM characters WHERE id = ?', [req.params.id]);
  if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });

  if (character.imageUrl) {
    const oldPath = path.join(__dirname, 'public', character.imageUrl);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }
  db.run("UPDATE characters SET imageUrl = NULL, updatedAt = datetime('now') WHERE id = ?", [character.id]);
  res.json({ ok: true });
});

// Tratamento de erro do multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message === 'Formato de imagem não suportado') {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// ---------- Rotas: Features (habilidades/talentos) ----------

app.post('/api/characters/:id/features', (req, res) => {
  const character = db.get('SELECT id FROM characters WHERE id = ?', [req.params.id]);
  if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });
  const feature = { id: newId(), name: req.body.name || 'Nova feature', description: req.body.description || '' };
  db.run('INSERT INTO character_features (id, characterId, name, description) VALUES (?, ?, ?, ?)',
    [feature.id, character.id, feature.name, feature.description]);
  res.status(201).json(feature);
});

app.put('/api/characters/:id/features/:featureId', (req, res) => {
  const feature = db.get('SELECT * FROM character_features WHERE id = ? AND characterId = ?',
    [req.params.featureId, req.params.id]);
  if (!feature) return res.status(404).json({ error: 'Feature não encontrada' });
  const name = req.body.name ?? feature.name;
  const description = req.body.description ?? feature.description;
  db.run('UPDATE character_features SET name = ?, description = ? WHERE id = ?', [name, description, feature.id]);
  res.json({ id: feature.id, name, description });
});

app.delete('/api/characters/:id/features/:featureId', (req, res) => {
  const feature = db.get('SELECT id FROM character_features WHERE id = ? AND characterId = ?',
    [req.params.featureId, req.params.id]);
  if (!feature) return res.status(404).json({ error: 'Feature não encontrada' });
  db.run('DELETE FROM character_features WHERE id = ?', [feature.id]);
  res.json({ ok: true });
});

// ---------- Rotas: Recursos (HP, mana, itens, munição etc.) ----------

app.post('/api/characters/:id/resources', (req, res) => {
  const character = loadCharacter(req.params.id);
  if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });
  const resource = {
    id: newId(), name: req.body.name || 'Novo recurso',
    current: Number(req.body.current ?? 0), max: Number(req.body.max ?? 0),
  };
  character.resources.push(resource);
  db.run("UPDATE characters SET resources = ?, updatedAt = datetime('now') WHERE id = ?",
    [JSON.stringify(character.resources), character.id]);
  res.status(201).json(resource);
});

app.put('/api/characters/:id/resources/:resourceId', (req, res) => {
  const character = loadCharacter(req.params.id);
  if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });
  const resource = character.resources.find(r => r.id === req.params.resourceId);
  if (!resource) return res.status(404).json({ error: 'Recurso não encontrado' });
  resource.name = req.body.name ?? resource.name;
  resource.current = req.body.current !== undefined ? Number(req.body.current) : resource.current;
  resource.max = req.body.max !== undefined ? Number(req.body.max) : resource.max;
  db.run("UPDATE characters SET resources = ?, updatedAt = datetime('now') WHERE id = ?",
    [JSON.stringify(character.resources), character.id]);
  res.json(resource);
});

app.delete('/api/characters/:id/resources/:resourceId', (req, res) => {
  const character = loadCharacter(req.params.id);
  if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });
  character.resources = character.resources.filter(r => r.id !== req.params.resourceId);
  db.run("UPDATE characters SET resources = ?, updatedAt = datetime('now') WHERE id = ?",
    [JSON.stringify(character.resources), character.id]);
  res.json({ ok: true });
});

// ---------- Rotas: Itens / Inventário ----------

const ITEM_TYPES = ['arma', 'armadura', 'escudo', 'consumivel', 'magico', 'outro'];

function sanitizeItem(body, existing = {}) {
  const type = ITEM_TYPES.includes(body.type) ? body.type : (existing.type || 'outro');
  return {
    id: existing.id || newId(),
    type,
    name: body.name ?? existing.name ?? 'Novo item',
    quantity: Number(body.quantity ?? existing.quantity ?? 1),
    equipped: body.equipped ?? existing.equipped ?? false,
    notes: body.notes ?? existing.notes ?? '',
    details: body.details ?? existing.details ?? {},
  };
}

app.post('/api/characters/:id/items', (req, res) => {
  const character = loadCharacter(req.params.id);
  if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });
  const item = sanitizeItem(req.body || {});
  character.items.push(item);
  db.run("UPDATE characters SET items = ?, updatedAt = datetime('now') WHERE id = ?",
    [JSON.stringify(character.items), character.id]);
  res.status(201).json(item);
});

app.put('/api/characters/:id/items/:itemId', (req, res) => {
  const character = loadCharacter(req.params.id);
  if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });
  const idx = character.items.findIndex(i => i.id === req.params.itemId);
  if (idx === -1) return res.status(404).json({ error: 'Item não encontrado' });
  character.items[idx] = sanitizeItem(req.body || {}, character.items[idx]);
  db.run("UPDATE characters SET items = ?, updatedAt = datetime('now') WHERE id = ?",
    [JSON.stringify(character.items), character.id]);
  res.json(character.items[idx]);
});

app.delete('/api/characters/:id/items/:itemId', (req, res) => {
  const character = loadCharacter(req.params.id);
  if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });
  character.items = character.items.filter(i => i.id !== req.params.itemId);
  db.run("UPDATE characters SET items = ?, updatedAt = datetime('now') WHERE id = ?",
    [JSON.stringify(character.items), character.id]);
  res.json({ ok: true });
});

// ---------- Rotas: Spells (feitiços preparados do personagem) ----------

app.post('/api/characters/:id/spells', (req, res) => {
  const character = db.get('SELECT id FROM characters WHERE id = ?', [req.params.id]);
  if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });
  const spell = sanitizeSpell(req.body || {});
  db.run('INSERT INTO character_spells (id, characterId, name, school, level, casted) VALUES (?, ?, ?, ?, ?, ?)',
    [spell.id, character.id, spell.name, spell.school, spell.level, spell.casted ? 1 : 0]);
  res.status(201).json(spell);
});

app.put('/api/characters/:id/spells/:spellId', (req, res) => {
  const spell = db.get('SELECT * FROM character_spells WHERE id = ? AND characterId = ?',
    [req.params.spellId, req.params.id]);
  if (!spell) return res.status(404).json({ error: 'Feitiço não encontrado' });
  const name = req.body.name ?? spell.name;
  const school = req.body.school ?? spell.school;
  const level = req.body.level !== undefined ? Number(req.body.level) : spell.level;
  const casted = req.body.casted ?? spell.casted;
  db.run('UPDATE character_spells SET name = ?, school = ?, level = ?, casted = ? WHERE id = ?',
    [name, school, level, casted ? 1 : 0, spell.id]);
  res.json({ id: spell.id, name, school, level, casted });
});

app.delete('/api/characters/:id/spells/:spellId', (req, res) => {
  const spell = db.get('SELECT id FROM character_spells WHERE id = ? AND characterId = ?',
    [req.params.spellId, req.params.id]);
  if (!spell) return res.status(404).json({ error: 'Feitiço não encontrado' });
  db.run('DELETE FROM character_spells WHERE id = ?', [spell.id]);
  res.json({ ok: true });
});

// sql.js é async (carrega o WASM); inicializa o banco antes de subir o servidor
db.initDb()
  .then(() => {
    // Migração do JSON antigo para o SQLite (1x)
    const { migrateJsonIfPresent } = db;
    migrateJsonIfPresent({ db, newId });

    app.listen(PORT, () => {
      console.log(`RPG Manager rodando em http://localhost:${PORT} (persistência: SQLite em ${db.name})`);
    });
  })
  .catch((err) => {
    console.error('Falha ao inicializar o banco de dados:', err);
    process.exit(1);
  });
