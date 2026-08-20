/* RPG Manager — ponte de migração: o navegador mantém fallback local, enquanto contas autenticadas recebem cópia server-side sem perder IDs ou vínculos. */
(function () {
  const MAPS_KEY = 'rpg-manager-maps-v3';
  const OLD_MAPS_KEY = 'rpg-manager-maps-v2';
  const LIBRARY_KEY = 'rpg-manager-library-v1';
  const NPCS_KEY = 'rpg-manager-npcs-v2';
  let campaignId = null;
  let syncing = false;
  const read = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; } };
  async function auth() {
    if (campaignId) return campaignId;
    const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!response.ok) return null;
    const data = await response.json();
    campaignId = data.campaigns?.[0]?.id || null;
    return campaignId;
  }
  async function request(path, options = {}) {
    const response = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `Falha na sincronização: ${response.status}`);
    return response.json();
  }
  async function syncMaps(input) {
    const id = await auth(); if (!id || syncing) return { skipped: true };
    syncing = true;
    try {
      const maps = Array.isArray(input) ? input : (read(MAPS_KEY) || read(OLD_MAPS_KEY) || []);
      for (const map of maps) {
        let remote;
        try { remote = await request(`/api/v2/maps/${encodeURIComponent(map.id)}`, { method: 'PUT', body: JSON.stringify({ ...map, campaignId: id }) }); }
        catch (_) { remote = await request('/api/v2/maps', { method: 'POST', body: JSON.stringify({ ...map, campaignId: id }) }); }
        for (const marker of (map.markers || [])) {
          try { await request(`/api/v2/maps/${encodeURIComponent(remote.id)}/markers/${encodeURIComponent(marker.id)}`, { method: 'PUT', body: JSON.stringify(marker) }); }
          catch (_) { await request(`/api/v2/maps/${encodeURIComponent(remote.id)}/markers`, { method: 'POST', body: JSON.stringify(marker) }); }
        }
      }
      localStorage.setItem('rpg-manager-maps-cloud-synced', new Date().toISOString());
      return { synced: maps.length };
    } finally { syncing = false; }
  }
  async function syncLibrary(input) {
    const id = await auth(); if (!id || syncing) return { skipped: true };
    syncing = true;
    try {
      let records = Array.isArray(input) ? input : (read(LIBRARY_KEY) || []);
      const legacy = read(NPCS_KEY) || [];
      records = [...records];
      legacy.forEach(item => { if (!records.some(record => record.id === item.id)) records.push({ ...item, type: 'NPC' }); });
      for (const record of records) {
        const payload = { ...record, campaignId: id, description: record.description || record.text || '', tags: Array.isArray(record.tags) ? record.tags : String(record.tags || '').split(',').map(tag => tag.trim()).filter(Boolean), metadata: record.metadata || { symbol: record.symbol || '' } };
        try { await request(`/api/v2/library/${encodeURIComponent(record.id)}`, { method: 'PUT', body: JSON.stringify(payload) }); }
        catch (_) { await request('/api/v2/library', { method: 'POST', body: JSON.stringify(payload) }); }
      }
      localStorage.setItem('rpg-manager-library-cloud-synced', new Date().toISOString());
      return { synced: records.length };
    } finally { syncing = false; }
  }
  window.RPGCloud = { auth, syncMaps, syncLibrary };
  window.addEventListener('load', () => {
    Promise.allSettled([syncMaps(), syncLibrary()]).catch(() => {});
  });
})();
