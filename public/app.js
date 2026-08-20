const state = {
  characters: [],
  selectedId: null,
  currentCharacter: null,
  paladinReference: null,
  spellSearchCache: null,
  classesCache: [],
  classReference: [],
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

function classSlug(name) {
  return String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function syncClassReference() {
  if (!fClass || !state.classReference.length) return;
  const currentClass = fClass.value;
  fClass.innerHTML = '<option value="">Selecionar classe</option>' + state.classReference.map(cls => `<option value="${escapeHtml(cls.name)}">${escapeHtml(cls.name)}</option>`).join('');
  fClass.value = currentClass;
  const selected = state.classReference.find(cls => cls.name === currentClass);
  if (fSubclass) {
    const subclasses = selected?.subclasses || [];
    const currentSubclass = fSubclass.value;
    fSubclass.innerHTML = '<option value="">Nenhuma subclasse</option>' + subclasses.map(subclass => { const name = typeof subclass === 'string' ? subclass : subclass.name; return `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`; }).join('');
    const subclassNames = subclasses.map(subclass => typeof subclass === 'string' ? subclass : subclass.name);
    fSubclass.value = subclassNames.includes(currentSubclass) ? currentSubclass : '';
    fSubclass.disabled = !selected;
  }
  renderClassReference(selected);
}
function renderClassReference(selected = state.classReference.find(cls => cls.name === fClass?.value)) {
  if (!classReferencePanel) return;
  if (!selected) { classReferencePanel.innerHTML = '<div class="class-reference-empty">Selecione uma classe para carregar o núcleo da progressão.</div>'; return; }
  const level = Math.max(1, Number(fLevel?.value) || 1);
  const features = (selected.features || []).filter(feature => Number(feature.level) <= level).sort((a,b) => Number(a.level) - Number(b.level));
  const next = (selected.features || []).filter(feature => Number(feature.level) > level).sort((a,b) => Number(a.level) - Number(b.level))[0];
  classReferencePanel.innerHTML = `<div class="class-reference-summary"><div><span class="rebuild-kicker">NÚCLEO 2014 / NÍVEL ${level}</span><h4>${escapeHtml(selected.name)}</h4><p>${escapeHtml(selected.description || '')}</p></div><div class="class-reference-meta"><b>${escapeHtml(selected.primaryAbility || '—')}</b><small>Atributo principal</small><b>${escapeHtml(selected.hitDie || '—')}</b><small>Dado de vida</small><b>${escapeHtml(selected.role || '—')}</b><small>Função</small></div></div><div class="class-reference-features"><strong>Features liberadas</strong>${features.length ? features.map(feature => `<article><span>NÍVEL ${feature.level}</span><div><b>${escapeHtml(feature.name)}</b><p>${escapeHtml(feature.description || '')}</p></div></article>`).join('') : '<p class="class-reference-empty">Nenhuma feature de progressão cadastrada até este nível.</p>'}${next ? `<small class="class-reference-next">Próxima no nível ${next.level}: ${escapeHtml(next.name)}</small>` : '<small class="class-reference-next">Progressão de classe exibida até o nível atual.</small>'}</div>`;
}

function setCharacterStatus(message, type = 'success') {
  const el = document.getElementById('character-save-status');
  if (!el) return;
  el.textContent = message;
  el.dataset.status = type;
  window.clearTimeout(setCharacterStatus.timer);
  if (message) setCharacterStatus.timer = window.setTimeout(() => { el.textContent = ''; el.dataset.status = ''; }, 4200);
}

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
const fSubclass = document.getElementById('f-subclass');
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
  { key: 'lidarComAnimais', label: 'Adestrar Animais', ability: 'sabedoria' },
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
const classReferencePanel = document.getElementById('class-reference-panel');

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
      <div class="char-thumb">${char.imageUrl ? `<img src="${char.imageUrl}" alt="">` : escapeHtml((char.name || '?')[0])}</div>
      <div class="char-info">
        <span class="char-name">${escapeHtml(char.name)}</span>
        <span class="char-meta">${escapeHtml(char.class || 'Sem classe')} • Nível ${char.level}</span>
      </div>
      <button type="button" class="character-list-delete" aria-label="Excluir ${escapeHtml(char.name)}" title="Excluir ficha">×</button>
    `;
    li.onclick = () => selectCharacter(char.id);
    li.querySelector('.character-list-delete').onclick = async (event) => {
      event.stopPropagation();
      if (!window.confirm(`Excluir a ficha de “${char.name}”? Esta ação não pode ser desfeita.`)) return;
      try {
        await deleteCharacter(char.id);
        if (state.selectedId === char.id) {
          state.selectedId = null;
          state.currentCharacter = null;
          renderCharacterView(null);
        }
        await refreshSelected();
      } catch (error) {
        window.alert(error.message || 'Não foi possível excluir a ficha.');
      }
    };
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
  const displayName = document.getElementById('character-display-name');
  if (displayName) displayName.textContent = character.name || 'Ficha em movimento';

  // Dados básicos
  fName.value = character.name;
  fClass.value = character.class;
  fRace.value = character.race;
  fLevel.value = character.level;
  syncClassReference();
  if (fSubclass) fSubclass.value = character.subclass || '';

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
  document.getElementById('stat-passive-perception').textContent = 10 + wisMod + (character.skillProficiencies?.percepcao?.proficient ? profBonus : 0);

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
  const saveProfs = character.saveProficiencies || {};
  const skillProfs = character.skillProficiencies || {};

  savesTable.innerHTML = attrIds.map(attr => {
    const mod = calculateModifier(character.attributes[attr]);
    const proficient = Boolean(saveProfs[attr]);
    const total = mod + (proficient ? profBonus : 0);
    return `<tr>
      <td><input type="checkbox" class="prof-toggle" data-kind="save" data-key="${attr}" ${proficient ? 'checked' : ''}></td>
      <td>${ABILITY_LABELS[attr]}</td>
      <td class="total-val">${formatModifier(total)}</td>
    </tr>`;
  }).join('');

  skillsTable.innerHTML = SKILLS.map(s => {
    const mod = calculateModifier(character.attributes[s.ability]);
    const proficient = Boolean(skillProfs[s.key]?.proficient);
    const total = mod + (proficient ? profBonus : 0);
    return `<tr>
      <td><input type="checkbox" class="prof-toggle" data-kind="skill" data-key="${s.key}" ${proficient ? 'checked' : ''}></td>
      <td>${s.label} <small>(${s.ability.substring(0,3)})</small></td>
      <td class="total-val">${formatModifier(total)}</td>
    </tr>`;
  }).join('');

  document.querySelectorAll('.prof-toggle').forEach(cb => {
    cb.addEventListener('change', async () => {
      cb.disabled = true;
      try {
        if (cb.dataset.kind === 'save') {
          const newSaveProficiencies = { ...saveProfs, [cb.dataset.key]: cb.checked };
          await updateCharacter(character.id, { saveProficiencies: newSaveProficiencies });
        } else {
          const newSkillProficiencies = {
            ...skillProfs,
            [cb.dataset.key]: { ...(skillProfs[cb.dataset.key] || {}), proficient: cb.checked },
          };
          await updateCharacter(character.id, { skillProficiencies: newSkillProficiencies });
        }
        await refreshSelected();
        setCharacterStatus('Proficiência atualizada.', 'success');
      } catch (error) {
        cb.checked = !cb.checked;
        setCharacterStatus(error.message || 'Não foi possível salvar a proficiência.', 'error');
      } finally {
        cb.disabled = false;
      }
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
    const payload = await api(`/spell-slots?class=${encodeURIComponent(classSlug(character.class || 'paladino'))}&level=${character.level}`);
    const slots = payload.slots || {};
    const usage = character.spellSlotsUsage || {};
    
    let totalFound = 0;
    for (let i = 1; i <= 9; i++) {
      const count = Number(slots[String(i)] || 0);
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
          try {
            await updateCharacter(character.id, { spellSlotsUsage: { ...currentUsage, [i]: newUsage } });
            await refreshSelected();
            setCharacterStatus('Uso de slots atualizado.', 'success');
          } catch (error) {
            cb.checked = !cb.checked;
            setCharacterStatus(error.message || 'Não foi possível atualizar os slots.', 'error');
          }
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
  const character = state.currentCharacter;
  if (!character) return;
  const q = document.getElementById('spell-search-input').value;
  const level = document.getElementById('spell-filter-level').value;
  const opt = document.getElementById('spell-filter-optional').checked;
  
  const spells = await api(`/spells?class=${encodeURIComponent(classSlug(character.class || 'paladino'))}&q=${encodeURIComponent(q)}&level=${level}&optional=${opt}`);
  const list = document.getElementById('spell-list');
  list.querySelectorAll('.search-results-overlay').forEach(node => node.remove());
  // Se houver busca, mostra resultados temporários no topo
  if (q.trim() || level || opt) {
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
    if (!spells.length) resultsDiv.innerHTML += '<p class="spell-search-empty">Nenhum feitiço encontrado para esta classe e filtro.</p>';
    list.prepend(resultsDiv);
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
if (fClass && fSubclass) fClass.addEventListener('change', async () => { syncClassReference(); if (state.currentCharacter) { state.currentCharacter.class = fClass.value; state.currentCharacter.subclass = ''; renderCastingStats({ ...state.currentCharacter, class: fClass.value }, Number(document.getElementById('stat-proficiency').textContent.replace('+', '')) || 2); renderSpellSlots({ ...state.currentCharacter, class: fClass.value }); await refreshSpellSearch(); } });
fLevel?.addEventListener('input', () => renderClassReference());

document.getElementById('btn-refresh-spells')?.addEventListener('click', refreshSpellSearch);
document.getElementById('spell-search-input')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); refreshSpellSearch(); } });
document.getElementById('btn-new-character').onclick = async () => {
  const char = await createCharacter({ name: 'Novo Herói', level: 1 });
  await refreshSelected();
  await selectCharacter(char.id);
};

document.getElementById('btn-save-character').onclick = async () => {
  if (!state.selectedId) return;
  const saveButton = document.getElementById('btn-save-character');
  saveButton.disabled = true;
  setCharacterStatus('Salvando ficha…', 'loading');
  const data = {
    name: fName.value, class: fClass.value, subclass: fClass.value === 'Paladino' ? (fSubclass?.value || '') : '', race: fRace.value, level: Number(fLevel.value),
    attributes: Object.fromEntries(attrIds.map(a => [a, Number(document.getElementById(`attr-${a}`).value)]))
  };
  try {
    await updateCharacter(state.selectedId, data);
    await refreshSelected();
    setCharacterStatus('Ficha salva com sucesso.', 'success');
  } catch (error) {
    setCharacterStatus(error.message || 'Não foi possível salvar a ficha.', 'error');
  } finally {
    saveButton.disabled = false;
  }
};

document.getElementById('btn-delete-character').onclick = async () => {
  if (!state.selectedId) return;
  const characterName = state.currentCharacter?.name || fName.value || 'esta ficha';
  if (!window.confirm(`Excluir a ficha de “${characterName}”? Esta ação não pode ser desfeita.`)) return;
  const deleteButton = document.getElementById('btn-delete-character');
  deleteButton.disabled = true;
  setCharacterStatus('Excluindo ficha…', 'loading');
  try {
    await deleteCharacter(state.selectedId);
    state.selectedId = null;
    state.currentCharacter = null;
    await refreshSelected();
    renderCharacterView(null);
  } catch (error) {
    setCharacterStatus(error.message || 'Não foi possível excluir a ficha.', 'error');
  } finally {
    deleteButton.disabled = false;
  }
};

const exportCharacterButton = document.getElementById('btn-export-character');
exportCharacterButton?.addEventListener('click', async () => {
  if (!state.selectedId) return;
  try {
    const response = await fetch(`/api/v2/characters/${state.selectedId}/export`, { credentials: 'same-origin' });
    if (!response.ok) throw new Error('Faça login para exportar a ficha.');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(state.currentCharacter?.name || 'personagem').replace(/[^a-z0-9à-ÿ]+/gi, '-').toLowerCase()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setCharacterStatus('Ficha exportada.', 'success');
  } catch (error) {
    setCharacterStatus(error.message || 'Não foi possível exportar a ficha.', 'error');
  }
});
let autosaveTimer = null;
function scheduleCharacterAutosave() {
  if (!state.selectedId) return;
  window.clearTimeout(autosaveTimer);
  setCharacterStatus('Alterações pendentes…', 'loading');
  autosaveTimer = window.setTimeout(() => document.getElementById('btn-save-character')?.click(), 850);
}
[fName, fClass, fSubclass, fRace, fLevel, ...attrIds.map(attr => document.getElementById(`attr-${attr}`))].forEach(field => field?.addEventListener('change', scheduleCharacterAutosave));

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
  try { state.classesCache = await api('/classes'); } catch (error) { console.warn('Classes indisponíveis:', error); }
  try { const reference = await api('/class-reference'); state.classReference = reference.classes || []; syncClassReference(); } catch (error) { console.warn('Catálogo de classes indisponível:', error); }
  await refreshSelected();
  await loadTemplates();
})();
