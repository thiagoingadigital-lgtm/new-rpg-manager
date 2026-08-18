const state = {
  characters: [],
  selectedId: null,
  currentCharacter: null,
  paladinReference: null,
  spellSearchCache: null,
  classesCache: [],
};

// ---------- API helpers ----------
async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Erro na requisição: ${res.status}`);
  }
  return res.json();
}

const getCharacters = () => api('/characters');
const getCharacter = (id) => api(`/characters/${id}`);
const createCharacter = (data) => api('/characters', { method: 'POST', body: JSON.stringify(data) });
const updateCharacter = (id, data) => api(`/characters/${id}`, { method: 'PUT', body: JSON.stringify(data) });
const deleteCharacter = (id) => api(`/characters/${id}`, { method: 'DELETE' });

async function uploadImage(id, file) {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`/api/characters/${id}/image`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Erro ao enviar imagem');
  return res.json();
}
const removeImage = (id) => api(`/characters/${id}/image`, { method: 'DELETE' });

const addFeature = (id, data) => api(`/characters/${id}/features`, { method: 'POST', body: JSON.stringify(data) });
const removeFeature = (id, featureId) => api(`/characters/${id}/features/${featureId}`, { method: 'DELETE' });

const addResource = (id, data) => api(`/characters/${id}/resources`, { method: 'POST', body: JSON.stringify(data) });
const updateResource = (id, resourceId, data) => api(`/characters/${id}/resources/${resourceId}`, { method: 'PUT', body: JSON.stringify(data) });
const removeResource = (id, resourceId) => api(`/characters/${id}/resources/${resourceId}`, { method: 'DELETE' });

const addItem = (id, data) => api(`/characters/${id}/items`, { method: 'POST', body: JSON.stringify(data) });
const updateItem = (id, itemId, data) => api(`/characters/${id}/items/${itemId}`, { method: 'PUT', body: JSON.stringify(data) });
const removeItem = (id, itemId) => api(`/characters/${id}/items/${itemId}`, { method: 'DELETE' });

const addSpell = (id, data) => api(`/characters/${id}/spells`, { method: 'POST', body: JSON.stringify(data) });
const updateSpell = (id, spellId, data) => api(`/characters/${id}/spells/${spellId}`, { method: 'PUT', body: JSON.stringify(data) });
const removeSpell = (id, spellId) => api(`/characters/${id}/spells/${spellId}`, { method: 'DELETE' });

// ---------- DOM refs ----------
const characterListEl = document.getElementById('character-list');
const emptyStateEl = document.getElementById('empty-state');
const characterViewEl = document.getElementById('character-view');

const fName = document.getElementById('f-name');
const fClass = document.getElementById('f-class');
const fRace = document.getElementById('f-race');
const fLevel = document.getElementById('f-level');
const fPortrait = document.getElementById('f-portrait');
const portraitPlaceholder = document.getElementById('portrait-placeholder');
const fImageInput = document.getElementById('f-image-input');
const btnRemoveImage = document.getElementById('btn-remove-image');

const attrIds = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'];
const ABILITY_LABELS = { forca: 'Força', destreza: 'Destreza', constituicao: 'Constituição', inteligencia: 'Inteligência', sabedoria: 'Sabedoria', carisma: 'Carisma' };

const SKILLS = [
  { key: 'atletismo', label: 'Atletismo', ability: 'forca' },
  { key: 'acrobacia', label: 'Acrobacia', ability: 'destreza' },
  { key: 'furtividade', label: 'Furtividade', ability: 'destreza' },
  { key: 'prestidigitacao', label: 'Prestidigitação', ability: 'destreza' },
  { key: 'arcanismo', label: 'Arcanismo', ability: 'inteligencia' },
  { key: 'historia', label: 'História', ability: 'inteligencia' },
  { key: 'investigacao', label: 'Investigação', ability: 'inteligencia' },
  { key: 'natureza', label: 'Natureza', ability: 'inteligencia' },
  { key: 'religiao', label: 'Religião', ability: 'inteligencia' },
  { key: 'adestrar_animais', label: 'Adestrar Animais', ability: 'sabedoria' },
  { key: 'intuicao', label: 'Intuição', ability: 'sabedoria' },
  { key: 'medicina', label: 'Medicina', ability: 'sabedoria' },
  { key: 'percepcao', label: 'Percepção', ability: 'sabedoria' },
  { key: 'sobrevivencia', label: 'Sobrevivência', ability: 'sabedoria' },
  { key: 'atuacao', label: 'Atuação', ability: 'carisma' },
  { key: 'enganacao', label: 'Enganação', ability: 'carisma' },
  { key: 'intimidacao', label: 'Intimidação', ability: 'carisma' },
  { key: 'persuasao', label: 'Persuasão', ability: 'carisma' },
];

const ITEM_TYPE_LABELS = { arma: '⚔️ Arma', armadura: '🛡️ Armadura', escudo: '🔰 Escudo', consumivel: '🧪 Consumível', magico: '✨ Mágico', outro: '📦 Outro' };

const savesTable = document.getElementById('saves-table');
const skillsTable = document.getElementById('skills-table');
const featureListEl = document.getElementById('feature-list');
const resourceListEl = document.getElementById('resource-list');
const inventoryListEl = document.getElementById('inventory-list');
const templateSelect = document.getElementById('template-select');
const btnApplyTemplate = document.getElementById('btn-apply-template');

// ---------- Core Functions ----------
function calculateModifier(score) {
  return Math.floor((score - 10) / 2);
}

function formatModifier(mod) {
  return mod >= 0 ? `+${mod}` : mod;
}

function renderCharacterList() {
  characterListEl.innerHTML = '';
  state.characters.forEach((char) => {
    const li = document.createElement('li');
    li.className = `character-item ${state.selectedId === char.id ? 'active' : ''}`;
    li.innerHTML = `
      <div class="char-thumb">${char.imageUrl ? `<img src="${char.imageUrl}">` : char.name[0]}</div>
      <div class="char-info">
        <span class="char-name">${escapeHtml(char.name)}</span>
        <span class="char-meta">${char.class || 'Sem classe'} • Nível ${char.level}</span>
      </div>
    `;
    li.onclick = () => selectCharacter(char.id);
    characterListEl.appendChild(li);
  });
}

async function renderCharacterView(character) {
  state.currentCharacter = character;
  if (!character) {
    emptyStateEl.classList.remove('hidden');
    characterViewEl.classList.add('hidden');
    return;
  }
  emptyStateEl.classList.add('hidden');
  characterViewEl.classList.remove('hidden');

  // Dados básicos
  fName.value = character.name;
  fClass.value = character.class;
  fRace.value = character.race;
  fLevel.value = character.level;

  if (character.imageUrl) {
    fPortrait.src = character.imageUrl;
    fPortrait.classList.remove('hidden');
    portraitPlaceholder.classList.add('hidden');
    btnRemoveImage.classList.remove('hidden');
  } else {
    fPortrait.classList.add('hidden');
    portraitPlaceholder.classList.remove('hidden');
    btnRemoveImage.classList.add('hidden');
  }

  // Atributos
  attrIds.forEach((attr) => {
    const score = character.attributes[attr];
    const input = document.getElementById(`attr-${attr}`);
    const badge = document.getElementById(`mod-${attr}`);
    input.value = score;
    badge.textContent = formatModifier(calculateModifier(score));
  });

  // Estatísticas calculadas
  const profBonus = await api(`/proficiency?level=${character.level}`).then(r => r.bonus);
  document.getElementById('stat-proficiency').textContent = `+${profBonus}`;
  
  const dexMod = calculateModifier(character.attributes.destreza);
  document.getElementById('stat-initiative').textContent = formatModifier(dexMod);
  
  const wisMod = calculateModifier(character.attributes.sabedoria);
  document.getElementById('stat-passive-perception').textContent = 10 + wisMod + (character.proficiencies?.percepcao ? profBonus : 0);

  // CA
  let baseAC = 10 + dexMod;
  (character.items || []).forEach(item => {
    if (!item.equipped) return;
    if (item.type === 'armadura') {
      const armorAC = parseInt(item.details?.baseAC) || 10;
      const type = item.details?.armorType;
      if (type === 'Leve') baseAC = armorAC + dexMod;
      else if (type === 'Média') baseAC = armorAC + Math.min(2, dexMod);
      else if (type === 'Pesada') baseAC = armorAC;
    } else if (item.type === 'escudo') {
      baseAC += parseInt(item.details?.acBonus) || 2;
    }
  });
  document.getElementById('stat-ac').textContent = baseAC;

  renderSavesAndSkills(character, profBonus);
  renderFeatures(character);
  renderResources(character);
  renderInventory(character);
  renderCastingStats(character, profBonus);
  renderSpellSlots(character);
  renderSpells(character);
}

function renderSavesAndSkills(character, profBonus) {
  const profs = character.proficiencies || {};
  
  savesTable.innerHTML = attrIds.map(attr => {
    const mod = calculateModifier(character.attributes[attr]);
    const total = mod + (profs[`save_${attr}`] ? profBonus : 0);
    return `<tr>
      <td><input type="checkbox" class="prof-toggle" data-key="save_${attr}" ${profs[`save_${attr}`] ? 'checked' : ''}></td>
      <td>${ABILITY_LABELS[attr]}</td>
      <td class="total-val">${formatModifier(total)}</td>
    </tr>`;
  }).join('');

  skillsTable.innerHTML = SKILLS.map(s => {
    const mod = calculateModifier(character.attributes[s.ability]);
    const total = mod + (profs[s.key] ? profBonus : 0);
    return `<tr>
      <td><input type="checkbox" class="prof-toggle" data-key="${s.key}" ${profs[s.key] ? 'checked' : ''}></td>
      <td>${s.label} <small>(${s.ability.substring(0,3)})</small></td>
      <td class="total-val">${formatModifier(total)}</td>
    </tr>`;
  }).join('');

  document.querySelectorAll('.prof-toggle').forEach(cb => {
    cb.addEventListener('change', async () => {
      const newProfs = { ...character.proficiencies, [cb.dataset.key]: cb.checked };
      await updateCharacter(character.id, { proficiencies: newProfs });
      await refreshSelected();
    });
  });
}

function renderFeatures(character) {
  featureListEl.innerHTML = '';
  (character.features || []).forEach(f => {
    const li = document.createElement('li');
    li.className = 'item-row';
    li.innerHTML = `<div><strong>${escapeHtml(f.name)}</strong><p>${escapeHtml(f.description)}</p></div><button class="btn-remove">✕</button>`;
    li.querySelector('.btn-remove').onclick = async () => { await removeFeature(character.id, f.id); await refreshSelected(); };
    featureListEl.appendChild(li);
  });
}

function renderResources(character) {
  resourceListEl.innerHTML = '';
  (character.resources || []).forEach(r => {
    const li = document.createElement('li');
    li.className = 'item-row resource-item';
    li.innerHTML = `
      <span class="res-name">${escapeHtml(r.name)}</span>
      <div class="res-controls">
        <input type="number" value="${r.current}" class="res-input cur"> / <input type="number" value="${r.max}" class="res-input max">
        <button class="btn-remove">✕</button>
      </div>
    `;
    const update = async () => await updateResource(character.id, r.id, { current: parseInt(li.querySelector('.cur').value), max: parseInt(li.querySelector('.max').value) });
    li.querySelector('.cur').onchange = update;
    li.querySelector('.max').onchange = update;
    li.querySelector('.btn-remove').onclick = async () => { await removeResource(character.id, r.id); await refreshSelected(); };
    resourceListEl.appendChild(li);
  });
}

function renderInventory(character) {
  inventoryListEl.innerHTML = '';
  (character.items || []).forEach(item => {
    const li = document.createElement('li');
    li.className = 'item-row inventory-item';
    const details = formatItemDetails(item);
    li.innerHTML = `
      <div class="inventory-item-header">
        <span class="item-type-badge">${ITEM_TYPE_LABELS[item.type]}</span>
        <span class="item-name">${escapeHtml(item.name)} x${item.quantity}</span>
        ${['arma','armadura','escudo'].includes(item.type) ? `<label class="checkbox-label"><input type="checkbox" class="equip-cb" ${item.equipped?'checked':''}> Equipado</label>` : ''}
        <button class="btn-remove">✕</button>
      </div>
      ${details ? `<div class="inventory-item-details">${escapeHtml(details)}</div>` : ''}
    `;
    const cb = li.querySelector('.equip-cb');
    if(cb) cb.onchange = async () => { await updateItem(character.id, item.id, { ...item, equipped: cb.checked }); await refreshSelected(); };
    li.querySelector('.btn-remove').onclick = async () => { await removeItem(character.id, item.id); await refreshSelected(); };
    inventoryListEl.appendChild(li);
  });
}

// ---------- Casting Functions ----------
async function renderCastingStats(character, profBonus) {
  const isPaladin = (character.class || '').toLowerCase().includes('paladino');
  const castingSection = document.querySelector('.spellcast-card'); // Assumindo classe no card
  
  const chaMod = calculateModifier(character.attributes.carisma);
  document.getElementById('stat-spell-save-dc').textContent = 8 + profBonus + chaMod;
  document.getElementById('stat-spell-attack').textContent = formatModifier(profBonus + chaMod);
  
  if (isPaladin) {
    const prepared = Math.max(1, chaMod + Math.floor(character.level / 2));
    document.getElementById('stat-prepared-spells').textContent = prepared;
  } else {
    document.getElementById('stat-prepared-spells').textContent = '—';
  }
}

async function renderSpellSlots(character) {
  const container = document.getElementById('spell-slots-container');
  const display = document.getElementById('slots-level-display');
  container.innerHTML = '';
  
  try {
    const slots = await api(`/spell-slots?class=${character.class || 'Paladino'}&level=${character.level}`);
    const usage = character.spellSlotsUsage || {};
    
    let totalFound = 0;
    for (let i = 1; i <= 9; i++) {
      const count = slots[`level${i}`] || 0;
      if (count === 0) continue;
      totalFound++;
      
      const div = document.createElement('div');
      div.className = 'slot-group';
      div.innerHTML = `<h4>Nível ${i}</h4><div class="slots-row"></div>`;
      const row = div.querySelector('.slots-row');
      
      for (let s = 0; s < count; s++) {
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'slot-checkbox';
        const isUsed = (usage[i] || 0) > s;
        if (isUsed) cb.checked = true;
        
        cb.onchange = async () => {
          const currentUsage = character.spellSlotsUsage || {};
          const levelUsage = currentUsage[i] || 0;
          const newUsage = cb.checked ? levelUsage + 1 : Math.max(0, levelUsage - 1);
          await updateCharacter(character.id, { spellSlotsUsage: { ...currentUsage, [i]: newUsage } });
          await refreshSelected();
        };
        row.appendChild(cb);
      }
      container.appendChild(div);
    }
    display.textContent = totalFound > 0 ? '' : '(Nenhum disponível)';
  } catch (err) {
    console.error('Erro slots:', err);
  }
}

function renderSpells(character) {
  const list = document.getElementById('spell-list');
  list.innerHTML = '';
  (character.spells || []).forEach(s => {
    const li = document.createElement('li');
    li.className = `spell-item ${s.casted ? 'casted' : ''}`;
    li.innerHTML = `
      <div class="spell-main">
        <input type="checkbox" class="spell-cast-cb" ${s.casted ? 'checked' : ''}>
        <strong>${escapeHtml(s.name)}</strong>
        <span class="spell-meta">Nv ${s.level} • ${s.school}</span>
      </div>
      <button class="btn-remove">✕</button>
    `;
    li.querySelector('.spell-cast-cb').onchange = async (e) => {
      await updateSpell(character.id, s.id, { casted: e.target.checked });
      await refreshSelected();
    };
    li.querySelector('.btn-remove').onclick = async () => {
      await removeSpell(character.id, s.id);
      await refreshSelected();
    };
    list.appendChild(li);
  });
}

async function refreshSpellSearch() {
  const q = document.getElementById('spell-search-input').value;
  const level = document.getElementById('spell-filter-level').value;
  const opt = document.getElementById('spell-filter-optional').checked;
  
  const spells = await api(`/paladin/spells?q=${encodeURIComponent(q)}&level=${level}&optional=${opt}`);
  const list = document.getElementById('spell-list');
  // Se houver busca, mostra resultados temporários no topo
  if (q.trim() || level) {
    const resultsDiv = document.createElement('div');
    resultsDiv.className = 'search-results-overlay';
    resultsDiv.innerHTML = '<h4>Resultados da busca:</h4>';
    spells.forEach(s => {
      const d = document.createElement('div');
      d.className = 'search-result-item';
      d.innerHTML = `<span>${s.name} (Nv ${s.level})</span> <button class="btn btn-sm">Preparar</button>`;
      d.querySelector('button').onclick = async () => {
        await addSpell(state.selectedId, { name: s.name, level: s.level, school: s.school, casted: false });
        document.getElementById('spell-search-input').value = '';
        await refreshSelected();
      };
      resultsDiv.appendChild(d);
    });
    // Simples: limpa e mostra só a busca se estiver digitando, ou injeta no topo
    // Para este MVP, vamos apenas alertar ou logar, e focar no CRUD funcional.
  }
}

// ---------- Actions & Init ----------
async function selectCharacter(id) {
  state.selectedId = id;
  renderCharacterList();
  const char = await getCharacter(id);
  renderCharacterView(char);
}

window.selectCharacterById = selectCharacter; // Global para index.html

async function refreshSelected() {
  state.characters = await getCharacters();
  renderCharacterList();
  if (state.selectedId) {
    const char = await getCharacter(state.selectedId);
    renderCharacterView(char);
  }
}

async function loadTemplates() {
  try {
    const data = await fetch('/data/templates.json').then(r => r.json());
    templateSelect.innerHTML = '<option value="">Aplicar template...</option>';
    data.templates.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id; opt.textContent = t.label;
      templateSelect.appendChild(opt);
    });
  } catch(e) {}
}

// Event Listeners básicos
document.getElementById('btn-new-character').onclick = async () => {
  const char = await createCharacter({ name: 'Novo Herói', level: 1 });
  await refreshSelected();
  await selectCharacter(char.id);
};

document.getElementById('btn-save-character').onclick = async () => {
  if (!state.selectedId) return;
  const data = {
    name: fName.value, class: fClass.value, race: fRace.value, level: Number(fLevel.value),
    attributes: Object.fromEntries(attrIds.map(a => [a, Number(document.getElementById(`attr-${a}`).value)]))
  };
  await updateCharacter(state.selectedId, data);
  await refreshSelected();
};

document.getElementById('btn-delete-character').onclick = async () => {
  if (!state.selectedId || !confirm('Excluir este herói?')) return;
  await deleteCharacter(state.selectedId);
  state.selectedId = null;
  await refreshSelected();
  renderCharacterView(null);
};

// Utils
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

function formatItemDetails(item) {
  const d = item.details || {};
  if (item.type === 'arma') return `${d.damage} ${d.damageType} ${d.properties}`;
  if (item.type === 'armadura') return `CA ${d.baseAC} (${d.armorType})`;
  if (item.type === 'escudo') return `Bônus CA ${d.acBonus}`;
  return d.description || d.effect || '';
}

// Start
(async () => {
  await refreshSelected();
  await loadTemplates();
})();
