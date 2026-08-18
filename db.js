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
        description:'Um guerreiro feroz que combate com fúria primitiva e indomável. Para alguns, sua rabia brota da comunhão com espíritos de animais selvagens; outros recorrem a uma reserva de ira que ferve dentro deles.' },
      { slug:'bardo', name:'Bardo', icon:'🎵', hitDie:'d8', primaryAbility:'Carisma', casting:'full', castingAbility:'Carisma', role:'Suporte',
        description:'Um erudito, poeta ou canalla que tece magia através de palavras e música para inspirar aliados, desmoralizar inimigos, manipular mentes e até curar ferimentos.' },
      { slug:'bruxo', name:'Bruxo', icon:'👁️', hitDie:'d8', primaryAbility:'Carisma', casting:'pact', castingAbility:'Carisma', role:'Dano',
        description:'Buscadores de conhecimento escondido no multiverso. Através de pactos com seres de poder sobrenatural, desatam efeitos mágicos sutis e espetaculares.' },
      { slug:'clerigo', name:'Clérigo', icon:'✨', hitDie:'d8', primaryAbility:'Sabedoria', casting:'full', castingAbility:'Sabedoria', role:'Suporte',
        description:'Intermediários entre o mundo mortal e os planos divinos. Não são sacerdotes comuns: um clérigo é imbuído de magia divina que reflete as obras de sua deidade.' },
      { slug:'druida', name:'Druida', icon:'🍃', hitDie:'d8', primaryAbility:'Sabedoria', casting:'full', castingAbility:'Sabedoria', role:'Controle',
        description:'Invocam as forças elementares e emulam as criaturas do mundo animal. São a personificação da resistência, astúcia e fúria da natureza — sua extensão da vontade indomável da mesma.' },
      { slug:'feiticeiro', name:'Feiticeiro', icon:'🔥', hitDie:'d6', primaryAbility:'Carisma', casting:'full', castingAbility:'Carisma', role:'Dano',
        description:'Possuem magia inata, conferida por uma linhagem exótica, uma influência de outro mundo ou exposição a forças cósmicas desconhecidas. Ninguém escolhe a feitiçaria: o poder escolhe o feiticeiro.' },
      { slug:'guerreiro', name:'Guerreiro', icon:'⚔️', hitDie:'d10', primaryAbility:'Força ou Destreza', casting:'none', role:'Dano',
        description:'Dominam magistralmente armas e armaduras e possuem conhecimento exaustivo das habilidades de combate. Estão intimamente ligados à morte — tanto a distribuí-la quanto a encará-la de forma desafiante.' },
      { slug:'ladino', name:'Ladino', icon:'🗡️', hitDie:'d8', primaryAbility:'Destreza', casting:'none', role:'Furtivo',
        description:'Confiavam em perícia, furtividade e nas vulnerabilidades dos oponentes para levar vantagem. Têm um dom para encontrar a solução de qualquer problema, demonstrando engenho e versatilidade que são a base de qualquer bom grupo de aventureiros.' },
      { slug:'mago', name:'Mago', icon:'📘', hitDie:'d6', primaryAbility:'Inteligência', casting:'full', castingAbility:'Inteligência', role:'Controle',
        description:'Os praticantes supremos da magia, definidos e unidos como classe pelos feitiços que conjuram. A partir da onda sutil de magia que impregna o cosmos, lançam feitiços explosivos, arcos voltaicos, enganos sutis e brutais formas de controle mental.' },
      { slug:'monge', name:'Monge', icon:'👊', hitDie:'d8', primaryAbility:'Destreza e Sabedoria', casting:'none', role:'Dano',
        description:'Unidos pela habilidade de utilizar magicamente a energia que corre por seus corpos (Ki). Seja canalizada em demonstrações marciais ou em defesa e velocidade sutis, essa energia impulsiona tudo o que o monge faz.' },
      { slug:'paladino', name:'Paladino', icon:'🛡️', hitDie:'d10', primaryAbility:'Força e Carisma', casting:'half', castingAbility:'Carisma', role:'Linha de frente',
        description:'Sejam quais forem suas origens e missões, os paladinos estão unidos por juramentos para lutar contra as forças do mal. O juramento de um paladino é um vínculo poderoso — uma fonte de poder que converte um devoto guerreiro em um campeão abençoado.' },
      { slug:'patrulheiro', name:'Patrulheiro', icon:'🏹', hitDie:'d10', primaryAbility:'Destreza e Sabedoria', casting:'half', castingAbility:'Sabedoria', role:'Dano',
        description:'Longe do burburinho das cidades, em meio a florestas sem caminhos e através de vastas planícies, os patrulheiros mantêm sua guarda ininterrupta — guerreiros das terras fronteiriças que protegem a civilização dos terrores da natureza.' }
    ];

    const FEATURES_SEED = {
      barbaro: [
        { name:'Fúria (Rage)', level:1, description:'Como ação bônus, entra em fúria por 1 minuto: ganha resistência a dano físico (contundente, cortante e perfurante), bônus de +2 ao dano em ataques corpo a corpo usando Força e vantagem em testes de Força. Começa com 2 usos por descanso longo.' },
        { name:'Defesa sem Armadura', level:1, description:'Quando não usa armadura, a Classe de Armadura é 10 + modificador de Destreza + modificador de Constituição. Escudos podem ser usados normalmente.' },
        { name:'Ataque Temerário (Reckless Attack)', level:2, description:'Ao atacar com Força no primeiro turno, pode atacar com vantagem, mas todos os ataques contra ele até o próximo turno também têm vantagem.' },
        { name:'Sentido de Perigo (Danger Sense)', level:2, description:'Vantagem em testes de resistência de Destreza contra efeitos que ele pode ver (rajadas de fogo, desabamentos, flechas...). Inutilizável se estiver cego, surdo ou incapacitado.' },
        { name:'Ataque Brutal', level:9, description:'Ao rolar dados de dano para um ataque corpo a corpo com Força, pode rolar um dado de dano adicional.' },
        { name:'Resistência Implacável', level:11, description:'Se cair a 0 HP e não morrer na hora, pode ficar com 1 HP no lugar (1 vez por descanso longo).' }
      ],
      bardo: [
        { name:'Inspiração Bárdica (Bardic Inspiration)', level:1, description:'Como ação bônus, concede a uma criatura (não você) um dado de inspiração (d6) que pode ser adicionado a um teste de atributo, ataque ou resistência antes da rolagem. Recarrega após descanso curto ou longo.' },
        { name:'Conjuração (Carisma)', level:1, description:'Conjura feitiços usando Carisma. Conhece 2 cantrips e 4 feitiços de 1º círculo. Pode conjurar rituais de 1º círculo que conheça.' },
        { name:'Conhecimento de Tudo (Jack of All Trades)', level:2, description:'Adiciona metade do bônus de proficiência (arredondado para baixo) a qualquer teste de atributo que ainda não inclua a proficiência.' },
        { name:'Canção de Descanso (Song of Rest)', level:2, description:'Durante um descanso curto, criaturas aliadas que ouvirem sua música recuperam 1d6 de PV adicionais ao gastarem Dados de Vida.' },
        { name:'Especialização (Expertise)', level:3, description:'Dobra o bônus de proficiência em duas perícias à sua escolha (pode trocar depois).' }
      ],
      bruxo: [
        { name:'Magia de Pacto (Carisma)', level:1, description:'Conjura usando Carisma. Conhece 2 cantrips e 2 feitiços de 1º círculo. Seus espaços de magia são todos do mesmo nível e recuperam com descanso curto.' },
        { name:'Patrocinador do Outro Plano', level:1, description:'Escolhe um patrono entre o Arquifada (Archfey), o Corruptor (Fiend) ou o Outro Plano (Great Old One), que concede poderes e feitiços adicionais.' },
        { name:'Recuperação Mística', level:2, description:'Pode recuperar espaços de magia gastos com 1 minuto de meditação, até uma quantidade por dia igual a metade do nível (arredondado para cima).' },
        { name:'Invocações de Pacto', level:2, description:'Concede encantamentos passivos que alteram as regras da magia de pacto (ex: Invocação do Olhar Medonho permite Disfarçar-se a vontade).' },
        { name:'Aspectos Místicos (Eldritch Invocations)', level:2, description:'Conhecimentos especiais concedidos por seu patrocinador que melhoram seus feitiços e capacidades.' }
      ],
      clerigo: [
        { name:'Conjuração (Sabedoria)', level:1, description:'Conjura usando Sabedoria. Prepara feitiços igual a mod. Sabedoria + nível de clérigo, escolhendo da lista inteira da classe a cada descanso longo.' },
        { name:'Domínio Divino', level:1, description:'Escolhe um domínio (ex: Vida, Luz, Tempestade) que concede feitiços de domínio (sempre preparados) e um cantrip de domínio.' },
        { name:'Canalizar Divindade: Expulsar Descrentes', level:2, description:'Como ação, apresenta seu símbolo sagrado e recita uma oração: mortos-vivos e aberrações a até 9 metros devem fazer resistência de Sabedoria ou serem expulsados por 1 minuto.' },
        { name:'Canalizar Divindade: Repreensão Divina (Turn Undead)', level:2, description:'Canaliza energia divina para usar efeitos poderosos — cada domínio concede uma opção adicional de canalização.' }
      ],
      druida: [
        { name:'Druidismo', level:1, description:'Conhece os segredos da natureza e pode identificar plantas e animais, deixando vestígios inofensivos ao atravessar terrenos naturais.' },
        { name:'Conjuração (Sabedoria)', level:1, description:'Conjura usando Sabedoria. Prepara feitiços igual a mod. Sabedoria + metade do nível (arredondado para cima), escolhendo da lista inteira da classe a cada descanso longo. Pode conjurar rituais.' },
        { name:'Forma Selvagem (Wild Shape)', level:2, description:'Usa ação para se transformar em uma besta que já tenha visto, com base no nível: besta com DV máximo 1/4 (sem voo) por até 2 usos por descanso curto ou longo.' },
        { name:'Círculo Druídico', level:2, description:'Escolhe sua tradição: Círculo da Terra (mais magias e recuperação em terreno natural) ou Círculo da Lua (formas selvagens mais poderosas e transformação como ação bônus).' }
      ],
      feiticeiro: [
        { name:'Conjuração (Carisma)', level:1, description:'Conjura usando Carisma. Conhece 4 cantrips e 2 feitiços de 1º círculo (escolhidos permanentemente, trocam ao subir de nível).' },
        { name:'Origem Mágica', level:1, description:'Escolhe a fonte de seu poder inato: Linhagem Dracônica (draconic bloodline) ou Magia Selvagem (wild magic), cada uma com benefícios próprios.' },
        { name:'Pontos de Feitiçaria (Sorcery Points)', level:2, description:'Reserva de pontos igual ao nível de feiticeiro, usada para efeitos especiais como criar espaços de magia extras (1 ponto = 1 espaço de 1º círculo).' },
        { name:'Metamágica', level:3, description:'Altera a forma como conjura feitiços gastando pontos de feitiçaria: feitiço sutil (sem componentes verbais/somáticos), feitiço estendido, feitiço acelerado (tempo de conjuração como ação bônus) etc.' }
      ],
      guerreiro: [
        { name:'Estilo de Luta', level:1, description:'Escolhe um estilo que reflete seu treinamento: Arquearia (+2 em ataques com armas de distância), Duelismo (+2 de dano com arma na mão única), Grande Arma (+2 no dado de dano de armas de duas mãos), Defesa (+1 de CA com armadura) e outros.' },
        { name:'Retomar Fôlego (Second Wind)', level:1, description:'Como ação bônus, recupera 1d10 + nível de guerreiro em PV. 1 uso por descanso curto ou longo.' },
        { name:'Surto de Ação (Action Surge)', level:2, description:'Uma vez por descanso curto, pode realizar uma ação adicional em seu turno, além da ação normal e da ação bônus.' },
        { name:'Ataque Extra', level:5, description:'Pode atacar duas vezes ao usar a ação de atacar.' },
        { name:'Arquétipo Marcial', level:3, description:'Escolhe sua especialização: Campeão (golpes críticos ampliados), Mestre de Batalha (manobras táticas) ou Cavaleiro Arcano (magia de arma).' }
      ],
      ladino: [
        { name:'Ataque Furtivo (Sneak Attack)', level:1, description:'Uma vez por turno, causa 1d6 de dano extra se tiver vantagem no ataque ou se um aliado estiver adjacente ao alvo. Escala: +1d6 a cada 2 níveis (máx. 10d6).' },
        { name:'Especialização (Expertise)', level:1, description:'Dobra o bônus de proficiência em duas perícias à sua escolha (ou uma perícia + ferramentas de ladino).' },
        { name:'Gíria de Ladino (Thieves\' Cant)', level:1, description:'Linguagem secreta misturada ao discurso comum, compreendida apenas por outros ladinos. Transmite mensagens ocultas em conversas aparentemente normais.' },
        { name:'Ação Ardilosa (Cunning Action)', level:2, description:'Pode usar Disparada, Desengajar ou Esconder como ação bônus em seu turno.' },
        { name:'Esquiva (Evasion)', level:7, description:'Quando sofre efeito que permite resistência de Destreza para sofrer metade do dano, não sofre dano nenhum se passar na resistência.' }
      ],
      mago: [
        { name:'Conjuração (Inteligência)', level:1, description:'Conjura usando Inteligência. Prepara feitiços igual a mod. Inteligência + nível de mago, escolhendo do grimório a cada descanso longo.' },
        { name:'Grimório (Spellbook)', level:1, description:'O mago registra em seu grimório os feitiços que domina (começa com 6 feitiços de 1º círculo) e copia novos feitiços de pergaminhos e grimórios encontrados.' },
        { name:'Recuperação Arcana', level:1, description:'Uma vez por dia, pode recuperar espaços de magia gastos com custo total de nível até metade do nível de mago (arredondado para cima), após 1 minuto de estudo do grimório.' },
        { name:'Tradição Arcana', level:2, description:'Escolhe uma escola de magia para especializar-se (ex: Abjuração, Evocação, Necromancia), que concede benefícios como conjuração econômica de feitiços da escola e proteção contra magias.' }
      ],
      monge: [
        { name:'Defesa sem Armadura', level:1, description:'Quando não usa armadura nem escudo, a CA é 10 + modificador de Destreza + modificador de Sabedoria.' },
        { name:'Artes Marciais', level:1, description:'Usa Destreza em vez de Força para ataques desarmados e armas de monge; o dado de dano desarmado começa em 1d4 e escala com o nível; pode rolar 1d4 em vez do dano normal da arma de monge.' },
        { name:'Fluxo de Ki', level:2, description:'Pontos de ki igual ao nível de monge. Gastando 1 ponto: Ataque Desarmado aos Ventos (Flurry of Blows — 2 ataques desarmados como ação bônus), Defesa Paciente (ação Desengajar ou Esconder como ação bônus) ou Maneira Rápida do Vento (ação Disparada como ação bônus).' },
        { name:'Movimento sem Armadura', level:2, description:'A velocidade aumenta em 3 metros enquanto não usar armadura ou escudo.' },
        { name:'Tradição Monástica', level:3, description:'Escolhe seu caminho: Caminho da Mão Aberta (técnicas de combate que derrubam ou impedem reações), Caminho da Sombra (magia das sombras e teletransporte) ou Caminho dos Quatro Elementos (disciplina elementar).' }
      ],
      paladino: [
        { name:'Sentido Divino', level:1, description:'Como ação, detecta a localização de aberrações, celestiais, elementais, fadas, corruptores e mortos-vivos a até 18 metros, sabendo o tipo mas não a identidade exata. Usos = 1 + mod. Carisma por descanso longo.' },
        { name:'Imposição das Mãos (Lay on Hands)', level:1, description:'Pool de cura igual a 5 × nível de paladino. Como ação, toca uma criatura e gasta pontos do pool para restaurar PV ou curar uma doença/toxina (5 pontos por condição).' },
        { name:'Estilo de Luta', level:2, description:'Escolhe um estilo de luta (Defesa, Duelismo, Grande Arma, Proteção etc.).' },
        { name:'Conjuração (Carisma)', level:2, description:'Conjura usando Carisma. Prepara feitiços igual a mod. Carisma + metade do nível (arredondado para baixo).' },
        { name:'Punição Divina (Divine Smite)', level:2, description:'Ao acertar um ataque corpo a corpo, pode gastar um espaço de magia para causar 2d8 de dano radiante (1d8 extra por nível de spell acima do 1º, máx. 5d8; +1d8 contra mortos-vivos e corruptores).' }
      ],
      patrulheiro: [
        { name:'Inimigo Favorito (Favored Enemy)', level:1, description:'Escolhe um tipo de inimigo (ex: aberrações, bestas, mortos-vivos). Vantagem em testes para rastreá-lo e lembra informações sobre criaturas desse tipo.' },
        { name:'Explorador Nato (Natural Explorer)', level:1, description:'Escolhe um terreno favorito (ex: floresta, montanha, pântano) onde ganha vantagens em exploração: não fica perdido, move-se em passo furtivo mesmo em movimento normal, forrageia o dobro.' },
        { name:'Estilo de Luta', level:2, description:'Escolhe um estilo: Arquearia, Duelismo, Luta com Duas Armas ou Defesa.' },
        { name:'Conjuração (Sabedoria)', level:2, description:'Conjura usando Sabedoria. Prepara feitiços igual a mod. Sabedoria + metade do nível (arredondado para cima).' },
        { name:'Primitivo Primário (Primeval Awareness)', level:3, description:'Gastando um espaço de magia, comunica-se com espíritos da natureza para saber se há aberrações, celestiais, corruptores, elementais, fadas ou mortos-vivos a até 1,6 km (ou 9,6 km dentro do terreno favorito).' }
      ]
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
                                 saveProficiencies, resources, items, spellSlotsUsage, imageUrl, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            c.id, c.name, c.class || '', c.race || '', c.level ?? 1,
            JSON.stringify(c.attributes || {}),
            JSON.stringify(c.skillProficiencies || {}),
            JSON.stringify(c.saveProficiencies || {}),
            JSON.stringify(c.resources || []),
            JSON.stringify(c.items || []),
            JSON.stringify(c.spellSlotsUsage || {}),
            c.imageUrl || null,
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
// db.exec(sql)                → executa SQL puro
// db.run(sql, [...params])    → executa INSERT/UPDATE/DELETE (e salva)
// db.get(sql, [...params])    → retorna 1 linha (objeto) ou null
// db.all(sql, [...params])    → retorna array de linhas
// db.transaction(fn)()        → executa dentro de transação
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
