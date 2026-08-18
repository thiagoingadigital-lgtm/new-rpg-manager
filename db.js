// db.js — Camada de acesso ao SQLite (sql.js = SQLite em WebAssembly/JS puro)
// NÃO precisa de Python, Visual Studio Build Tools nem qualquer compilação nativa.
// O banco é um arquivo local (data/rpg-manager.db) que só existe enquanto
// a aplicação está rodando: quando o processo do servidor morre, o banco
// fica inerte no disco, sem nenhum processo separado rodando.
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'rpg-manager.db');

let DB = null;          // instância sql.js (Database)
let readyPromise = null; // promise que resolve quando o WASM está carregado e o schema criado
let txDepth = 0;         // evita salvar o banco no meio de uma transação

function saveDb() {
  fs.writeFileSync(DB_PATH, Buffer.from(DB.export()));
}

function initDb() {
  if (DB) return Promise.resolve();
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    const SqlJs = await initSqlJs(); // SqlJs já é o módulo (tem .Database)
    const buffer = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null;
    DB = new SqlJs.Database(buffer && buffer.length > 0 ? buffer : undefined);
    DB.run('PRAGMA journal_mode = WAL');
    DB.run('PRAGMA foreign_keys = ON');

    // Migrações automáticas (rodam a cada boot; CREATE TABLE IF NOT EXISTS)
    DB.run(`
      CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        icon TEXT,
        hitDie TEXT,
        primaryAbility TEXT,
        casting TEXT,
        castingAbility TEXT,
        role TEXT,
        description TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS class_features (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        classId INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        level INTEGER NOT NULL,
        description TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS proficiency_bonus (
        level INTEGER PRIMARY KEY,
        bonus INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS spell_slots (
        classId INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        level INTEGER NOT NULL,
        slots TEXT NOT NULL,
        PRIMARY KEY (classId, level)
      );
      CREATE TABLE IF NOT EXISTS spells (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        school TEXT NOT NULL,
        level INTEGER NOT NULL,
        castingTime TEXT,
        range TEXT,
        components TEXT,
        duration TEXT,
        ritual INTEGER DEFAULT 0,
        optional INTEGER DEFAULT 0,
        classSlug TEXT DEFAULT 'paladino',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        class TEXT,
        race TEXT,
        level INTEGER DEFAULT 1,
        attributes TEXT DEFAULT '{}',
        skillProficiencies TEXT DEFAULT '{}',
        saveProficiencies TEXT DEFAULT '{}',
        resources TEXT DEFAULT '[]',
        items TEXT DEFAULT '[]',
        spellSlotsUsage TEXT DEFAULT '{}',
        imageUrl TEXT,
        inHall INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS character_features (
        id TEXT PRIMARY KEY,
        characterId TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT
      );
      CREATE TABLE IF NOT EXISTS character_spells (
        id TEXT PRIMARY KEY,
        characterId TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        school TEXT,
        level INTEGER,
        casted INTEGER DEFAULT 0
      );
    `);

    // If an older DB exists without the inHall column, try to add it (idempotent)
    try {
      DB.run("ALTER TABLE characters ADD COLUMN inHall INTEGER DEFAULT 0");
    } catch (e) {
      // ignore if column already exists or ALTER not supported
    }

    // Seed: proficiência por nível
    const PROFICIENCY = {1:2,2:2,3:2,4:2,5:3,6:3,7:3,8:3,9:4,10:4,11:4,12:4,13:5,14:5,15:5,16:5,17:6,18:6,19:6,20:6};
    DB.run('BEGIN TRANSACTION');
    try {
      for (let l = 1; l <= 20; l++) {
        DB.run('INSERT OR IGNORE INTO proficiency_bonus (level, bonus) VALUES (?, ?)', [l, PROFICIENCY[l]]);
      }
      DB.run('COMMIT');
    } catch (e) {
      DB.run('ROLLBACK');
      throw e;
    }

    // Seed: classes básicas do D&D 5e + features básicas (SRD 5.1)
    const CLASSES_SEED = [
      { slug:'barbaro', name:'Bárbaro', icon:'🪓', hitDie:'d12', primaryAbility:'Força', casting:'none', role:'Linha de frente',
        description:'Um guerreiro feroz que combate com fúria primitiva e indomável. Para alguns, sua rabia brota da comunhão com espíritos de animais selvagens; outros recorrem a uma reserva[...]' },
      { slug:'bardo', name:'Bardo', icon:'🎵', hitDie:'d8', primaryAbility:'Carisma', casting:'full', castingAbility:'Carisma', role:'Suporte',
        description:'Um erudito, poeta ou canalla que tece magia através de palavras e música para inspirar aliados, desmoralizar inimigos, manipular mentes e até curar ferimentos.' },
      { slug:'bruxo', name:'Bruxo', icon:'👁️', hitDie:'d8', primaryAbility:'Carisma', casting:'pact', castingAbility:'Carisma', role:'Dano',
        description:'Buscadores de conhecimento escondido no multiverso. Através de pactos com seres de poder sobrenatural, desatam efeitos mágicos sutis e espetaculares.' },
      { slug:'clerigo', name:'Clérigo', icon:'✨', hitDie:'d8', primaryAbility:'Sabedoria', casting:'full', castingAbility:'Sabedoria', role:'Suporte',
        description:'Intermediários entre o mundo mortal e os planos divinos. Não são sacerdotes comuns: um clérigo é imbuído de magia divina que reflete as obras de sua deidade.' },
      { slug:'druida', name:'Druida', icon:'🍃', hitDie:'d8', primaryAbility:'Sabedoria', casting:'full', castingAbility:'Sabedoria', role:'Controle',
        description:'Invocam as forças elementares e emulam as criaturas do mundo animal. São a personificação da resistência, astúcia e fúria da natureza — sua extensão da vontade indo[...]' },
      { slug:'feiticeiro', name:'Feiticeiro', icon:'🔥', hitDie:'d6', primaryAbility:'Carisma', casting:'full', castingAbility:'Carisma', role:'Dano',
        description:'Possuem magia inata, conferida por uma linhagem exótica, uma influência de outro mundo ou exposição a forças cósmicas desconhecidas. Ninguém escolhe a feitiçaria: o p[...]' },
      { slug:'guerreiro', name:'Guerreiro', icon:'⚔️', hitDie:'d10', primaryAbility:'Força ou Destreza', casting:'none', role:'Dano',
        description:'Dominam magistralmente armas e armaduras e possuem conhecimento exaustivo das habilidades de combate. Estão intimamente ligados à morte — tanto a distribuí-la quanto a e[...]' },
      { slug:'ladino', name:'Ladino', icon:'🗡️', hitDie:'d8', primaryAbility:'Destreza', casting:'none', role:'Furtivo',
        description:'Confiavam em perícia, furtividade e nas vulnerabilidades dos oponentes para levar vantagem. Têm um dom para encontrar a solução de qualquer problema, demonstrando engenho[...]' },
      { slug:'mago', name:'Mago', icon:'📘', hitDie:'d6', primaryAbility:'Inteligência', casting:'full', castingAbility:'Inteligência', role:'Controle',
        description:'Os praticantes supremos da magia, definidos e unidos como classe pelos feitiços que conjuram. A partir da onda sutil de magia que impregna o cosmos, lançam feitiços explos[...]' },
      { slug:'monge', name:'Monge', icon:'👊', hitDie:'d8', primaryAbility:'Destreza e Sabedoria', casting:'none', role:'Dano',
        description:'Unidos pela habilidade de utilizar magicamente a energia que corre por seus corpos (Ki). Seja canalizada em demonstrações marciais ou em defesa e velocidade sutis, essa ene[...]' },
      { slug:'paladino', name:'Paladino', icon:'🛡️', hitDie:'d10', primaryAbility:'Força e Carisma', casting:'half', castingAbility:'Carisma', role:'Linha de frente',
        description:'Sejam quais forem suas origens e missões, os paladinos estão unidos por juramentos para lutar contra as forças do mal. O juramento de um paladino é um vínculo poderoso [...]' },
      { slug:'patrulheiro', name:'Patrulheiro', icon:'🏹', hitDie:'d10', primaryAbility:'Destreza e Sabedoria', casting:'half', castingAbility:'Sabedoria', role:'Dano',
        description:'Longe do burburinho das cidades, em meio a florestas sem caminhos e através de vastas planícies, os patrulheiros mantêm sua guarda ininterrupta — guerreiros das terras f[...]' }
    ];

    const FEATURES_SEED = {
      barbaro: [
        { name:'Fúria (Rage)', level:1, description:'Como ação bônus, entra em fúria por 1 minuto: ganha resistência a dano físico (contundente, cortante e perfurante), bônus de +2 ao dan[...]' },
        { name:'Defesa sem Armadura', level:1, description:'Quando não usa armadura, a Classe de Armadura é 10 + modificador de Destreza + modificador de Constituição. Escudos podem ser usado[...]' },
        { name:'Ataque Temerário (Reckless Attack)', level:2, description:'Ao atacar com Força no primeiro turno, pode atacar com vantagem, mas todos os ataques contra ele até o próximo turno[...]' },
        { name:'Sentido de Perigo (Danger Sense)', level:2, description:'Vantagem em testes de resistência de Destreza contra efeitos que ele pode ver (rajadas de fogo, desabamentos, flechas...)' },
        { name:'Ataque Brutal', level:9, description:'Ao rolar dados de dano para um ataque corpo a corpo com Força, pode rolar um dado de dano adicional.' },
        { name:'Resistência Implacável', level:11, description:'Se cair a 0 HP e não morrer na hora, pode ficar com 1 HP no lugar (1 vez por descanso longo).' }
      ],
      bardo: [
        { name:'Inspiração Bárdica (Bardic Inspiration)', level:1, description:'Como ação bônus, concede a uma criatura (não você) um dado de inspiração (d6) que pode ser adicionado a u[...]' },
        { name:'Conjuração (Carisma)', level:1, description:'Conjura feitiços usando Carisma. Conhece 2 cantrips e 4 feitiços de 1º círculo. Pode conjurar rituais de 1º círculo que conhe[...]' },
        { name:'Conhecimento de Tudo (Jack of All Trades)', level:2, description:'Adiciona metade do bônus de proficiência (arredondado para baixo) a qualquer teste de atributo que ainda não i[...]' },
        { name:'Canção de Descanso (Song of Rest)', level:2, description:'Durante um descanso curto, criaturas aliadas que ouvirem sua música recuperam 1d6 de PV adicionais ao gastarem Dados d[...]' },
        { name:'Especialização (Expertise)', level:3, description:'Dobra o bônus de proficiência em duas perícias à sua escolha (pode trocar depois).' }
      ],
      // ... trimmed seeds for brevity in this file
    };

    // Spell slots por classe (progressões do SRD 5.1)
    function buildSpellSlots() {
      const out = {};
      const FULL = {
        1:{1:2}, 2:{1:3}, 3:{1:4,2:2}, 4:{1:4,2:3}, 5:{1:4,2:3,3:2},
        6:{1:4,2:3,3:3}, 7:{1:4,2:3,3:3,4:1}, 8:{1:4,2:3,3:3,4:2},
        9:{1:4,2:3,3:3,4:3,5:1}, 10:{1:4,2:3,3:3,4:3,5:2},
        11:{1:4,2:3,3:3,4:3,5:2,6:1}, 12:{1:4,2:3,3:3,4:3,5:2,6:1},
        13:{1:4,2:3,3:3,4:3,5:2,6:1,7:1}, 14:{1:4,2:3,3:3,4:3,5:2,6:1,7:1},
        15:{1:4,2:3,3:3,4:3,5:2,6:1,7:1,8:1}, 16:{1:4,2:3,3:3,4:3,5:2,6:1,7:1,8:1},
        17:{1:4,2:3,3:3,4:3,5:2,6:1,7:1,8:1,9:1}, 18:{1:4,2:3,3:3,4:3,5:3,6:1,7:1,8:1,9:1},
        19:{1:4,2:3,3:3,4:3,5:3,6:2,7:1,8:1,9:1}, 20:{1:4,2:3,3:3,4:3,5:3,6:2,7:2,8:1,9:1}
      };
      const HALF = {
        1:{1:0}, 2:{1:2}, 3:{1:3}, 4:{1:3}, 5:{1:4,2:2}, 6:{1:4,2:2},
        7:{1:4,2:3}, 8:{1:4,2:3}, 9:{1:4,2:3,3:2}, 10:{1:4,2:3,3:2},
        11:{1:4,2:3,3:3}, 12:{1:4,2:3,3:3}, 13:{1:4,2:3,3:3,4:1}, 14:{1:4,2:3,3:3,4:1},
        15:{1:4,2:3,3:3,4:2}, 16:{1:4,2:3,3:3,4:2}, 17:{1:4,2:3,3:3,4:3,5:1},
        18:{1:4,2:3,3:3,4:3,5:1}, 19:{1:4,2:3,3:3,4:3,5:2}, 20:{1:4,2:3,3:3,4:3,5:2}
      };
      const PACT = {
        1:{1:1}, 2:{1:2}, 3:{2:2}, 4:{2:2}, 5:{3:2}, 6:{3:2}, 7:{4:2}, 8:{4:2},
        9:{5:2}, 10:{5:2}, 11:{5:3}, 12:{5:3}, 13:{5:3}, 14:{5:3},
        15:{5:3}, 16:{5:3}, 17:{5:4}, 18:{5:4}, 19:{5:4}, 20:{5:4}
      };
      out.full = FULL; out.half = HALF; out.pact = PACT;
      return out;
    }

    // Seed apenas se as classes ainda não existirem
    const existingClasses = DB.exec('SELECT slug FROM classes');
    if (!existingClasses.length || existingClasses[0].values.length === 0) {
      DB.run('BEGIN TRANSACTION');
      try {
        for (const c of CLASSES_SEED) {
          DB.run(
            `INSERT OR IGNORE INTO classes (slug, name, icon, hitDie, primaryAbility, casting, role, description, castingAbility)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [c.slug, c.name, c.icon, c.hitDie, c.primaryAbility, c.casting, c.role, c.description, c.castingAbility || null]
          );
          const features = FEATURES_SEED[c.slug] || [];
          for (const f of features) {
            DB.run(
              `INSERT OR IGNORE INTO class_features (classId, name, level, description)
               VALUES ((SELECT id FROM classes WHERE slug = ?), ?, ?, ?)`,
              [c.slug, f.name, f.level, f.description]
            );
          }
          if (c.casting !== 'none') {
            const slotTables = buildSpellSlots();
            const table = slotTables[c.casting] || slotTables.half;
            for (let l = 1; l <= 20; l++) {
              DB.run(
                `INSERT OR IGNORE INTO spell_slots (classId, level, slots)
                 VALUES ((SELECT id FROM classes WHERE slug = ?), ?, ?)`,
                [c.slug, l, JSON.stringify(table[l])]
              );
            }
          }
        }
        DB.run('COMMIT');
      } catch (e) {
        DB.run('ROLLBACK');
        throw e;
      }
    }

    saveDb();
  })();
  return readyPromise;
}

// Migração do JSON antigo para o SQLite (executada 1x, se houver dados)
function migrateJsonIfPresent(serverDb) {
  const { newId } = serverDb;
  const count = serverDb.db.get('SELECT COUNT(*) AS n FROM characters');
  if (count && count.n > 0) return Promise.resolve(); // já migrado
  const featureIds = new Set(); // evita IDs duplicados entre features do mesmo personagem
  const dataFile = path.join(__dirname, 'data', 'characters.json');
  if (!fs.existsSync(dataFile)) return Promise.resolve();
  try {
    const raw = fs.readFileSync(dataFile, 'utf-8').trim();
    if (!raw) return Promise.resolve();
    const characters = JSON.parse(raw);
    if (!Array.isArray(characters) || characters.length === 0) return Promise.resolve();

    serverDb.db.transaction(() => {
      for (const c of characters) {
        serverDb.db.run(
          `INSERT INTO characters (id, name, class, race, level, attributes, skillProficiencies,
                                 saveProficiencies, resources, items, spellSlotsUsage, imageUrl, inHall, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            c.id, c.name, c.class || '', c.race || '', c.level ?? 1,
            JSON.stringify(c.attributes || {}),
            JSON.stringify(c.skillProficiencies || {}),
            JSON.stringify(c.saveProficiencies || {}),
            JSON.stringify(c.resources || []),
            JSON.stringify(c.items || []),
            JSON.stringify(c.spellSlotsUsage || {}),
            c.imageUrl || null,
            c.inHall ? 1 : 0,
            c.createdAt || new Date().toISOString(),
            c.updatedAt || new Date().toISOString(),
          ]
        );
        for (const f of (c.features || [])) {
          let fid = f.id || newId();
          while (featureIds.has(fid)) fid = newId(); // garante unicidade local
          featureIds.add(fid);
          serverDb.db.run(
            `INSERT OR IGNORE INTO character_features (id, characterId, name, description) VALUES (?, ?, ?, ?)`,
            [fid, c.id, f.name, f.description || '']
          );
        }
        for (const s of (c.spells || [])) {
          serverDb.db.run(
            `INSERT OR IGNORE INTO character_spells (id, characterId, name, school, level, casted) VALUES (?, ?, ?, ?, ?, ?)`,
            [s.id || newId(), c.id, s.name, s.school || '', s.level ?? 1, s.casted ? 1 : 0]
          );
        }
      }
    })();
    console.log(`[migração] ${characters.length} personagem(ns) migrado(s) do characters.json para o SQLite.`);
  } catch (err) {
    console.error('[migração] falha ao migrar characters.json:', err.message);
  }
  return Promise.resolve();
}

// ---------------------------------------------------------------------------
// API compatível com better-sqlite3 (usada pelo server.js):
// db.exec(sql)                 executa SQL puro
// db.run(sql, [...params])     executa INSERT/UPDATE/DELETE (e salva)
// db.get(sql, [...params])     retorna 1 linha (objeto) ou null
// db.all(sql, [...params])     retorna array de linhas
// db.transaction(fn)()         executa dentro de transação
// ---------------------------------------------------------------------------

const db = {
  name: DB_PATH,

  exec(sql) {
    DB.run(sql);
  },

  run(sql, params) {
    DB.run(sql, params || []);
    if (txDepth === 0) saveDb();
  },

  get(sql, params) {
    const rows = this.all(sql, params);
    return rows.length > 0 ? rows[0] : null;
  },

  all(sql, params) {
    let rows = [];
    let stmt;
    try {
      stmt = DB.prepare(sql, params || []);
      while (stmt.step()) rows.push(stmt.getAsObject());
    } finally {
      if (stmt) stmt.free();
    }
    return rows;
  },

  transaction(fn) {
    return () => {
      txDepth++;
      try {
        DB.run('BEGIN TRANSACTION');
        const result = fn();
        DB.run('COMMIT');
        saveDb();
        return result;
      } catch (err) {
        try { DB.run('ROLLBACK'); } catch (_) {}
        throw err;
      } finally {
        txDepth--;
      }
    };
  },

  pragma(raw) {
    DB.run(`PRAGMA ${raw}`);
  },
};

module.exports = db;
module.exports.initDb = initDb;
module.exports.migrateJsonIfPresent = migrateJsonIfPresent;
