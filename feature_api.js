const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const spellReference = (() => { try { const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'srd-spells.json'), 'utf8')); return data.spells || data; } catch (_) { return []; } })();
const SESSION_COOKIE = 'rpg_session';
const SESSION_DAYS = 14;
const MAX_NAME = 120;

function id(newId) { return newId(); }
function clean(value, fallback = '', max = 20000) {
  return String(value ?? fallback).trim().slice(0, max);
}
function json(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch (_) { return fallback; }
}
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}
function validPassword(password) { return typeof password === 'string' && password.length >= 8 && password.length <= 128; }
function parseCookies(req) {
  return String(req.headers.cookie || '').split(';').reduce((acc, part) => {
    const index = part.indexOf('=');
    if (index > 0) acc[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
    return acc;
  }, {});
}
function setCookie(res, value, maxAge = SESSION_DAYS * 86400) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`);
}
function publicUser(row) { return row && { id: row.id, name: row.name, email: row.email, createdAt: row.createdAt }; }
function parseTags(value) {
  if (Array.isArray(value)) return value.map(item => clean(item, '', 40)).filter(Boolean).slice(0, 30);
  return clean(value).split(',').map(item => item.trim()).filter(Boolean).slice(0, 30);
}
function parseBody(req) { return req.body && typeof req.body === 'object' ? req.body : {}; }
function nowPlusDays(days) { return new Date(Date.now() + days * 86400000).toISOString().slice(0, 19).replace('T', ' '); }

function registerFeatureApi(app, { db, newId }) {
  function userFromRequest(req) {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token) return null;
    const session = db.get("SELECT s.id, s.userId, s.expiresAt, u.name, u.email, u.createdAt FROM sessions s JOIN users u ON u.id = s.userId WHERE s.id = ? AND datetime(s.expiresAt) > datetime('now')", [token]);
    if (!session) return null;
    return { id: session.userId, name: session.name, email: session.email, createdAt: session.createdAt, sessionId: session.id };
  }
  function requireUser(req, res, next) {
    req.user = userFromRequest(req);
    if (!req.user) return res.status(401).json({ error: 'Faça login para continuar.', code: 'AUTH_REQUIRED' });
    next();
  }
  function ensureCampaignAccess(req, res, next) {
    const campaignId = clean(req.params.campaignId || req.query.campaignId || parseBody(req).campaignId, '', 80);
    if (!campaignId) return res.status(400).json({ error: 'campaignId é obrigatório.' });
    const member = db.get('SELECT cm.role, c.id, c.ownerId, c.name, c.description FROM campaign_members cm JOIN campaigns c ON c.id = cm.campaignId WHERE cm.campaignId = ? AND cm.userId = ?', [campaignId, req.user.id]);
    if (!member) return res.status(403).json({ error: 'Você não tem acesso a esta campanha.' });
    req.campaign = member;
    req.campaignId = campaignId;
    next();
  }
  function withUser(req, res, next) { req.user = userFromRequest(req); next(); }
  function sessionFor(res, userId) {
    const token = crypto.randomBytes(32).toString('hex');
    db.run('INSERT INTO sessions (id, userId, expiresAt) VALUES (?, ?, ?)', [token, userId, nowPlusDays(SESSION_DAYS)]);
    setCookie(res, token);
  }
  function userCampaigns(userId) {
    return db.all('SELECT c.*, cm.role FROM campaigns c JOIN campaign_members cm ON cm.campaignId = c.id WHERE cm.userId = ? ORDER BY c.updatedAt DESC', [userId]);
  }
  function campaignIdForUser(req) {
    const requested = clean(req.query.campaignId || parseBody(req).campaignId, '', 80);
    if (requested && db.get('SELECT campaignId FROM campaign_members WHERE campaignId = ? AND userId = ?', [requested, req.user.id])) return requested;
    return userCampaigns(req.user.id)[0]?.id || null;
  }
  function mapRow(row) {
    if (!row) return null;
    const map = { ...row, markers: db.all('SELECT * FROM map_markers WHERE mapId = ? ORDER BY createdAt ASC', [row.id]) };
    return map;
  }
  function recordRow(row) {
    if (!row) return null;
    return { ...row, tags: json(row.tags, []), metadata: json(row.metadata, {}) };
  }

  app.get('/api/auth/me', withUser, (req, res) => res.json({ user: req.user ? publicUser(req.user) : null, campaigns: req.user ? userCampaigns(req.user.id) : [] }));
  app.post('/api/auth/register', (req, res) => {
    const body = parseBody(req);
    const name = clean(body.name, '', MAX_NAME);
    const email = clean(body.email, '', 180).toLowerCase();
    const password = body.password;
    if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || !validPassword(password)) return res.status(400).json({ error: 'Informe nome, e-mail válido e senha com pelo menos 8 caracteres.' });
    if (db.get('SELECT id FROM users WHERE email = ?', [email])) return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
    const userId = id(newId); const campaignId = id(newId); const credentials = hashPassword(password);
    db.transaction(() => {
      db.run('INSERT INTO users (id, name, email, passwordHash, passwordSalt) VALUES (?, ?, ?, ?, ?)', [userId, name, email, credentials.hash, credentials.salt]);
      db.run('INSERT INTO campaigns (id, ownerId, name, description) VALUES (?, ?, ?, ?)', [campaignId, userId, 'Minha campanha', 'Campanha principal do RPG Manager']);
      db.run("INSERT INTO campaign_members (campaignId, userId, role) VALUES (?, ?, 'owner')", [campaignId, userId]);
    })();
    sessionFor(res, userId);
    res.status(201).json({ user: publicUser(db.get('SELECT * FROM users WHERE id = ?', [userId])), campaigns: userCampaigns(userId) });
  });
  app.post('/api/auth/login', (req, res) => {
    const body = parseBody(req); const email = clean(body.email, '', 180).toLowerCase(); const password = body.password;
    const user = db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !validPassword(password)) return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    const attempt = hashPassword(password, user.passwordSalt);
    if (!crypto.timingSafeEqual(Buffer.from(attempt.hash, 'hex'), Buffer.from(user.passwordHash, 'hex'))) return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    sessionFor(res, user.id);
    res.json({ user: publicUser(user), campaigns: userCampaigns(user.id) });
  });
  app.post('/api/auth/logout', (req, res) => { const token = parseCookies(req)[SESSION_COOKIE]; if (token) db.run('DELETE FROM sessions WHERE id = ?', [token]); setCookie(res, '', 0); res.json({ ok: true }); });

  app.get('/api/campaigns', requireUser, (req, res) => res.json(userCampaigns(req.user.id)));
  app.post('/api/campaigns', requireUser, (req, res) => {
    const body = parseBody(req); const name = clean(body.name, '', MAX_NAME); if (!name) return res.status(400).json({ error: 'Nome da campanha é obrigatório.' });
    const campaignId = id(newId);
    db.transaction(() => { db.run('INSERT INTO campaigns (id, ownerId, name, description) VALUES (?, ?, ?, ?)', [campaignId, req.user.id, name, clean(body.description)]); db.run("INSERT INTO campaign_members (campaignId, userId, role) VALUES (?, ?, 'owner')", [campaignId, req.user.id]); })();
    res.status(201).json(db.get('SELECT c.*, cm.role FROM campaigns c JOIN campaign_members cm ON cm.campaignId = c.id WHERE c.id = ? AND cm.userId = ?', [campaignId, req.user.id]));
  });
  app.get('/api/campaigns/:campaignId/members', requireUser, ensureCampaignAccess, (req, res) => {
    res.json(db.all('SELECT u.id, u.name, u.email, cm.role, cm.createdAt FROM campaign_members cm JOIN users u ON u.id = cm.userId WHERE cm.campaignId = ? ORDER BY cm.createdAt ASC', [req.campaignId]));
  });
  app.post('/api/campaigns/:campaignId/members', requireUser, ensureCampaignAccess, (req, res) => {
    if (!['owner', 'master'].includes(req.campaign.role)) return res.status(403).json({ error: 'Somente proprietário ou mestre pode gerenciar membros.' });
    const body = parseBody(req); const email = clean(body.email, '', 180).toLowerCase(); const role = ['master','player','reader'].includes(body.role) ? body.role : 'player';
    const user = db.get('SELECT id, name, email FROM users WHERE email = ?', [email]);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado. O membro precisa criar uma conta antes do convite.' });
    db.run('INSERT OR REPLACE INTO campaign_members (campaignId, userId, role) VALUES (?, ?, ?)', [req.campaignId, user.id, role]);
    res.status(201).json({ ...user, role });
  });
  app.put('/api/campaigns/:campaignId/members/:userId', requireUser, ensureCampaignAccess, (req, res) => {
    if (req.campaign.role !== 'owner') return res.status(403).json({ error: 'Somente o proprietário pode alterar papéis.' });
    const role = ['owner','master','player','reader'].includes(req.body?.role) ? req.body.role : 'player';
    if (req.params.userId === req.user.id && role !== 'owner') return res.status(400).json({ error: 'O proprietário não pode remover seu próprio papel.' });
    db.run('UPDATE campaign_members SET role = ? WHERE campaignId = ? AND userId = ?', [role, req.campaignId, req.params.userId]);
    res.json(db.get('SELECT u.id, u.name, u.email, cm.role, cm.createdAt FROM campaign_members cm JOIN users u ON u.id = cm.userId WHERE cm.campaignId = ? AND cm.userId = ?', [req.campaignId, req.params.userId]));
  });
  app.delete('/api/campaigns/:campaignId/members/:userId', requireUser, ensureCampaignAccess, (req, res) => {
    if (!['owner', 'master'].includes(req.campaign.role)) return res.status(403).json({ error: 'Somente proprietário ou mestre pode remover membros.' });
    if (req.params.userId === req.campaign.ownerId) return res.status(400).json({ error: 'O proprietário não pode ser removido.' });
    db.run('DELETE FROM campaign_members WHERE campaignId = ? AND userId = ?', [req.campaignId, req.params.userId]);
    res.json({ ok: true });
  });
  app.put('/api/campaigns/:campaignId', requireUser, ensureCampaignAccess, (req, res) => {
    if (!['owner', 'master'].includes(req.campaign.role)) return res.status(403).json({ error: 'Sem permissão para editar a campanha.' });
    const name = clean(req.body?.name, req.campaign.name, MAX_NAME); const description = clean(req.body?.description, req.campaign.description);
    db.run("UPDATE campaigns SET name=?, description=?, updatedAt=datetime('now') WHERE id=?", [name, description, req.campaignId]);
    res.json(db.get('SELECT c.*, cm.role FROM campaigns c JOIN campaign_members cm ON cm.campaignId=c.id WHERE c.id=? AND cm.userId=?', [req.campaignId, req.user.id]));
  });

  app.get('/api/v2/maps', requireUser, ensureCampaignAccess, (req, res) => res.json(db.all('SELECT * FROM maps WHERE campaignId = ? ORDER BY updatedAt DESC', [req.campaignId]).map(mapRow)));
  app.post('/api/v2/maps', requireUser, ensureCampaignAccess, (req, res) => { const b = parseBody(req); const mapId = clean(b.id, '', 80) || id(newId); db.run('INSERT INTO maps (id,campaignId,ownerId,name,kind,imageUrl,description,zoom) VALUES (?,?,?,?,?,?,?,?)', [mapId, req.campaignId, req.user.id, clean(b.name, 'Novo mapa', MAX_NAME), clean(b.kind, 'Regional', 40), clean(b.imageUrl, '', 2000), clean(b.description), Math.min(300, Math.max(100, Number(b.zoom) || 100))]); res.status(201).json(mapRow(db.get('SELECT * FROM maps WHERE id = ?', [mapId]))); });
  app.put('/api/v2/maps/:id', requireUser, (req, res) => { const map = db.get('SELECT * FROM maps WHERE id = ? AND ownerId = ?', [req.params.id, req.user.id]); if (!map) return res.status(404).json({ error: 'Mapa não encontrado.' }); const b = parseBody(req); db.run("UPDATE maps SET name=?, kind=?, imageUrl=?, description=?, zoom=?, updatedAt=datetime('now') WHERE id=?", [clean(b.name, map.name, MAX_NAME), clean(b.kind, map.kind, 40), clean(b.imageUrl, map.imageUrl, 2000), clean(b.description, map.description), Math.min(300, Math.max(100, Number(b.zoom) || map.zoom)), map.id]); res.json(mapRow(db.get('SELECT * FROM maps WHERE id = ?', [map.id]))); });
  app.delete('/api/v2/maps/:id', requireUser, (req, res) => { const map = db.get('SELECT id FROM maps WHERE id = ? AND ownerId = ?', [req.params.id, req.user.id]); if (!map) return res.status(404).json({ error: 'Mapa não encontrado.' }); db.run('DELETE FROM maps WHERE id = ?', [map.id]); res.json({ ok: true }); });
  app.get('/api/v2/maps/:mapId/markers', requireUser, (req, res) => { const map = db.get('SELECT id FROM maps WHERE id = ? AND ownerId = ?', [req.params.mapId, req.user.id]); if (!map) return res.status(404).json({ error: 'Mapa não encontrado.' }); res.json(db.all('SELECT * FROM map_markers WHERE mapId = ? ORDER BY createdAt ASC', [map.id])); });
  app.post('/api/v2/maps/:mapId/markers', requireUser, (req, res) => { const map = db.get('SELECT id FROM maps WHERE id = ? AND ownerId = ?', [req.params.mapId, req.user.id]); if (!map) return res.status(404).json({ error: 'Mapa não encontrado.' }); const b = parseBody(req); const markerId = clean(b.id, '', 80) || id(newId); db.run('INSERT INTO map_markers (id,mapId,name,color,kind,subjectType,subjectId,notes,x,y) VALUES (?,?,?,?,?,?,?,?,?,?)', [markerId, map.id, clean(b.name, 'Novo local', MAX_NAME), clean(b.color, 'red', 20), clean(b.kind, 'local', 30), clean(b.subjectType, '', 30), clean(b.subjectId, '', 80), clean(b.notes), Math.min(100, Math.max(0, Number(b.x) || 50)), Math.min(100, Math.max(0, Number(b.y) || 50))]); res.status(201).json(db.get('SELECT * FROM map_markers WHERE id = ?', [markerId])); });
  app.put('/api/v2/maps/:mapId/markers/:id', requireUser, (req, res) => { const marker = db.get('SELECT mm.* FROM map_markers mm JOIN maps m ON m.id=mm.mapId WHERE mm.id=? AND mm.mapId=? AND m.ownerId=?', [req.params.id, req.params.mapId, req.user.id]); if (!marker) return res.status(404).json({ error: 'Marcador não encontrado.' }); const b = parseBody(req); db.run('UPDATE map_markers SET name=?,color=?,kind=?,subjectType=?,subjectId=?,notes=?,x=?,y=?,updatedAt=datetime(\'now\') WHERE id=?', [clean(b.name, marker.name, MAX_NAME), clean(b.color, marker.color, 20), clean(b.kind, marker.kind, 30), clean(b.subjectType, marker.subjectType, 30), clean(b.subjectId, marker.subjectId, 80), clean(b.notes, marker.notes), Math.min(100, Math.max(0, Number(b.x) || marker.x)), Math.min(100, Math.max(0, Number(b.y) || marker.y)), marker.id]); res.json(db.get('SELECT * FROM map_markers WHERE id = ?', [marker.id])); });
  app.delete('/api/v2/maps/:mapId/markers/:id', requireUser, (req, res) => { const marker = db.get('SELECT mm.id FROM map_markers mm JOIN maps m ON m.id=mm.mapId WHERE mm.id=? AND mm.mapId=? AND m.ownerId=?', [req.params.id, req.params.mapId, req.user.id]); if (!marker) return res.status(404).json({ error: 'Marcador não encontrado.' }); db.run('DELETE FROM map_markers WHERE id = ?', [marker.id]); res.json({ ok: true }); });

  app.get('/api/v2/library', requireUser, ensureCampaignAccess, (req, res) => res.json(db.all('SELECT * FROM library_records WHERE campaignId=? ORDER BY updatedAt DESC', [req.campaignId]).map(recordRow)));
  app.post('/api/v2/library', requireUser, ensureCampaignAccess, (req, res) => { const b = parseBody(req); const recordId=clean(b.id,'',80)||id(newId); const record={id:recordId,campaignId:req.campaignId,ownerId:req.user.id,type:clean(b.type,'npc',30),name:clean(b.name,'Novo registro',MAX_NAME),role:clean(b.role,'',120),description:clean(b.description),tags:JSON.stringify(parseTags(b.tags)),visibility:clean(b.visibility,'private',20),imageUrl:clean(b.imageUrl,'',2000),metadata:JSON.stringify(b.metadata||{})}; db.run('INSERT INTO library_records (id,campaignId,ownerId,type,name,role,description,tags,visibility,imageUrl,metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?)', Object.values(record)); db.run('INSERT INTO library_history (id,recordId,campaignId,userId,action,snapshot) VALUES (?,?,?,?,?,?)', [id(newId),recordId,req.campaignId,req.user.id,'created',JSON.stringify(record)]); res.status(201).json(recordRow(db.get('SELECT * FROM library_records WHERE id=?',[recordId]))); });
  app.put('/api/v2/library/:id', requireUser, (req, res) => { const record=db.get('SELECT * FROM library_records WHERE id=? AND ownerId=?',[req.params.id,req.user.id]); if(!record) return res.status(404).json({error:'Registro não encontrado.'}); const b=parseBody(req); const next={...record,type:clean(b.type,record.type,30),name:clean(b.name,record.name,MAX_NAME),role:clean(b.role,record.role,120),description:clean(b.description,record.description),tags:JSON.stringify(parseTags(b.tags ?? json(record.tags,[]))),visibility:clean(b.visibility,record.visibility,20),imageUrl:clean(b.imageUrl,record.imageUrl,2000),metadata:JSON.stringify(b.metadata ?? json(record.metadata,{}))}; db.run("UPDATE library_records SET type=?,name=?,role=?,description=?,tags=?,visibility=?,imageUrl=?,metadata=?,updatedAt=datetime('now') WHERE id=?", [next.type,next.name,next.role,next.description,next.tags,next.visibility,next.imageUrl,next.metadata,record.id]); db.run('INSERT INTO library_history (id,recordId,campaignId,userId,action,snapshot) VALUES (?,?,?,?,?,?)',[id(newId),record.id,record.campaignId,req.user.id,'updated',JSON.stringify(next)]); res.json(recordRow(db.get('SELECT * FROM library_records WHERE id=?',[record.id]))); });
  app.delete('/api/v2/library/:id', requireUser, (req, res) => { const record=db.get('SELECT * FROM library_records WHERE id=? AND ownerId=?',[req.params.id,req.user.id]); if(!record) return res.status(404).json({error:'Registro não encontrado.'}); db.transaction(()=>{db.run('DELETE FROM record_links WHERE (fromId=? OR toId=?)',[record.id,record.id]);db.run('DELETE FROM library_records WHERE id=?',[record.id]);})(); res.json({ok:true}); });
  app.get('/api/v2/library/:id/history', requireUser, (req,res)=>{const record=db.get('SELECT id,campaignId FROM library_records WHERE id=? AND ownerId=?',[req.params.id,req.user.id]);if(!record)return res.status(404).json({error:'Registro não encontrado.'});res.json(db.all('SELECT * FROM library_history WHERE recordId=? ORDER BY createdAt DESC',[record.id]).map(x=>({...x,snapshot:json(x.snapshot,{})})));});
  app.get('/api/v2/links', requireUser, ensureCampaignAccess, (req,res)=>res.json(db.all('SELECT * FROM record_links WHERE campaignId=? ORDER BY createdAt DESC',[req.campaignId])));
  app.post('/api/v2/links', requireUser, ensureCampaignAccess, (req,res)=>{const b=parseBody(req);const linkId=id(newId);try{db.run('INSERT INTO record_links (id,campaignId,fromType,fromId,toType,toId,label) VALUES (?,?,?,?,?,?,?)',[linkId,req.campaignId,clean(b.fromType,'record',30),clean(b.fromId,'',80),clean(b.toType,'record',30),clean(b.toId,'',80),clean(b.label,'',120)]);}catch(e){return res.status(409).json({error:'Este vínculo já existe.'});}res.status(201).json(db.get('SELECT * FROM record_links WHERE id=?',[linkId]));});
  app.delete('/api/v2/links/:id', requireUser, (req,res)=>{const link=db.get('SELECT rl.id FROM record_links rl JOIN campaign_members cm ON cm.campaignId=rl.campaignId WHERE rl.id=? AND cm.userId=?',[req.params.id,req.user.id]);if(!link)return res.status(404).json({error:'Vínculo não encontrado.'});db.run('DELETE FROM record_links WHERE id=?',[link.id]);res.json({ok:true});});

  app.get('/api/v2/rolls', requireUser, ensureCampaignAccess, (req,res)=>res.json(db.all('SELECT * FROM rolls WHERE campaignId=? ORDER BY createdAt DESC LIMIT 100',[req.campaignId]).map(x=>({...x,dice:json(x.dice,[]),details:json(x.details,{})}))));
  app.post('/api/v2/rolls', requireUser, ensureCampaignAccess, (req,res)=>{const b=parseBody(req);const total=Number(b.total);if(!clean(b.formula)||!Number.isFinite(total))return res.status(400).json({error:'Fórmula e resultado são obrigatórios.'});const roll={id:id(newId),campaignId:req.campaignId,userId:req.user.id,formula:clean(b.formula,'',200),label:clean(b.label,'',120),mode:clean(b.mode,'Pública',30),dice:JSON.stringify(Array.isArray(b.dice)?b.dice:[]),total,details:JSON.stringify(b.details||{})};db.run('INSERT INTO rolls (id,campaignId,userId,formula,label,mode,dice,total,details) VALUES (?,?,?,?,?,?,?,?,?)',Object.values(roll));res.status(201).json({...roll,dice:json(roll.dice,[]),details:json(roll.details,{})});});
  app.delete('/api/v2/rolls', requireUser, ensureCampaignAccess, (req,res)=>{db.run('DELETE FROM rolls WHERE campaignId=?',[req.campaignId]);res.json({ok:true});});
  app.get('/api/v2/diary', requireUser, ensureCampaignAccess, (req,res)=>res.json(db.all('SELECT * FROM diary_entries WHERE campaignId=? AND (userId=? OR visibility=\'public\') ORDER BY updatedAt DESC',[req.campaignId,req.user.id]).map(x=>({...x,tags:json(x.tags,[])}))));
  app.post('/api/v2/diary', requireUser, ensureCampaignAccess, (req,res)=>{const b=parseBody(req);const entry={id:id(newId),campaignId:req.campaignId,userId:req.user.id,title:clean(b.title,'Sem título',MAX_NAME),body:clean(b.body),visibility:clean(b.visibility,'private',20),tags:JSON.stringify(parseTags(b.tags))};db.run('INSERT INTO diary_entries (id,campaignId,userId,title,body,visibility,tags) VALUES (?,?,?,?,?,?,?)',Object.values(entry));res.status(201).json({...entry,tags:json(entry.tags,[])});});
  app.put('/api/v2/diary/:id', requireUser, (req,res)=>{const entry=db.get('SELECT * FROM diary_entries WHERE id=? AND userId=?',[req.params.id,req.user.id]);if(!entry)return res.status(404).json({error:'Entrada não encontrada.'});const b=parseBody(req);const next={title:clean(b.title,entry.title,MAX_NAME),body:clean(b.body,entry.body),visibility:clean(b.visibility,entry.visibility,20),tags:JSON.stringify(parseTags(b.tags??json(entry.tags,[])))};db.run("UPDATE diary_entries SET title=?,body=?,visibility=?,tags=?,updatedAt=datetime('now') WHERE id=?",[next.title,next.body,next.visibility,next.tags,entry.id]);res.json({...entry,...next,tags:json(next.tags,[])});});
  app.delete('/api/v2/diary/:id', requireUser, (req,res)=>{const entry=db.get('SELECT id FROM diary_entries WHERE id=? AND userId=?',[req.params.id,req.user.id]);if(!entry)return res.status(404).json({error:'Entrada não encontrada.'});db.run('DELETE FROM diary_entries WHERE id=?',[entry.id]);res.json({ok:true});});

  app.get('/api/v2/characters/:id/history', requireUser, (req,res)=>{const char=db.get('SELECT id FROM characters WHERE id=?',[req.params.id]);if(!char)return res.status(404).json({error:'Personagem não encontrado.'});res.json(db.all('SELECT * FROM character_history WHERE characterId=? AND userId=? ORDER BY createdAt DESC',[char.id,req.user.id]).map(x=>({...x,snapshot:json(x.snapshot,{})})));});
  app.get('/api/v2/characters/:id/export', requireUser, (req,res)=>{const character=db.get('SELECT * FROM characters WHERE id=?',[req.params.id]);if(!character)return res.status(404).json({error:'Personagem não encontrado.'});const payload={...character,attributes:json(character.attributes,{}),skillProficiencies:json(character.skillProficiencies,{}),saveProficiencies:json(character.saveProficiencies,{}),resources:json(character.resources,[]),items:json(character.items,[]),spellSlotsUsage:json(character.spellSlotsUsage,{}),features:db.all('SELECT * FROM character_features WHERE characterId=?',[character.id]),spells:db.all('SELECT * FROM character_spells WHERE characterId=?',[character.id]),conditions:db.all('SELECT * FROM character_conditions WHERE characterId=?',[character.id]),attacks:db.all('SELECT * FROM character_attacks WHERE characterId=?',[character.id]),classes:db.all('SELECT * FROM character_classes WHERE characterId=?',[character.id])};res.setHeader('Content-Disposition',`attachment; filename="${encodeURIComponent(character.name||'personagem')}.json"`);res.json(payload);});
  app.get('/api/v2/characters/:id/classes', requireUser, (req,res)=>res.json(db.all('SELECT * FROM character_classes WHERE characterId=? ORDER BY level DESC, createdAt ASC',[req.params.id])));
  app.post('/api/v2/characters/:id/classes', requireUser, (req,res)=>{const b=parseBody(req);const item={id:id(newId),characterId:req.params.id,className:clean(b.className,'Nova classe',MAX_NAME),subclass:clean(b.subclass,'',MAX_NAME),level:Math.min(20,Math.max(1,Number(b.level)||1))};db.run('INSERT INTO character_classes (id,characterId,className,subclass,level) VALUES (?,?,?,?,?)',Object.values(item));res.status(201).json(item);});
  app.put('/api/v2/characters/:id/classes/:classId', requireUser, (req,res)=>{const item=db.get('SELECT * FROM character_classes WHERE id=? AND characterId=?',[req.params.classId,req.params.id]);if(!item)return res.status(404).json({error:'Classe da ficha não encontrada.'});const b=parseBody(req);const next={className:clean(b.className,item.className,MAX_NAME),subclass:clean(b.subclass,item.subclass,MAX_NAME),level:Math.min(20,Math.max(1,Number(b.level)||item.level))};db.run("UPDATE character_classes SET className=?,subclass=?,level=?,updatedAt=datetime('now') WHERE id=?",[next.className,next.subclass,next.level,item.id]);res.json({...item,...next});});
  app.delete('/api/v2/characters/:id/classes/:classId', requireUser, (req,res)=>{db.run('DELETE FROM character_classes WHERE id=? AND characterId=?',[req.params.classId,req.params.id]);res.json({ok:true});});
  app.get('/api/v2/characters/:id/conditions', requireUser, (req,res)=>res.json(db.all('SELECT * FROM character_conditions WHERE characterId=? ORDER BY active DESC, createdAt DESC',[req.params.id])));
  app.post('/api/v2/characters/:id/conditions', requireUser, (req,res)=>{const b=parseBody(req);const item={id:id(newId),characterId:req.params.id,name:clean(b.name,'Condição',MAX_NAME),duration:clean(b.duration,'',120),notes:clean(b.notes),active:b.active===false?0:1};db.run('INSERT INTO character_conditions (id,characterId,name,duration,notes,active) VALUES (?,?,?,?,?,?)',Object.values(item));res.status(201).json(item);});
  app.delete('/api/v2/characters/:id/conditions/:conditionId', requireUser, (req,res)=>{db.run('DELETE FROM character_conditions WHERE id=? AND characterId=?',[req.params.conditionId,req.params.id]);res.json({ok:true});});
  app.get('/api/v2/characters/:id/attacks', requireUser, (req,res)=>res.json(db.all('SELECT * FROM character_attacks WHERE characterId=? ORDER BY createdAt ASC',[req.params.id])));
  app.post('/api/v2/characters/:id/attacks', requireUser, (req,res)=>{const b=parseBody(req);const item={id:id(newId),characterId:req.params.id,name:clean(b.name,'Ataque',MAX_NAME),bonus:clean(b.bonus,'',50),damage:clean(b.damage,'',120),range:clean(b.range,'',80),notes:clean(b.notes)};db.run('INSERT INTO character_attacks (id,characterId,name,bonus,damage,range,notes) VALUES (?,?,?,?,?,?,?)',Object.values(item));res.status(201).json(item);});
  app.delete('/api/v2/characters/:id/attacks/:attackId', requireUser, (req,res)=>{db.run('DELETE FROM character_attacks WHERE id=? AND characterId=?',[req.params.attackId,req.params.id]);res.json({ok:true});});
  app.get('/api/v2/spells/favorites', requireUser, (req,res)=>res.json(db.all('SELECT spellName FROM spell_favorites WHERE userId=? ORDER BY createdAt DESC',[req.user.id]).map(x=>x.spellName)));
  app.post('/api/v2/spells/favorites', requireUser, (req,res)=>{const spellName=clean(parseBody(req).spellName,'',200);if(!spellName)return res.status(400).json({error:'Feitiço inválido.'});try{db.run('INSERT INTO spell_favorites (id,userId,spellName) VALUES (?,?,?)',[id(newId),req.user.id,spellName]);}catch(e){db.run('DELETE FROM spell_favorites WHERE userId=? AND spellName=?',[req.user.id,spellName]);}res.json({ok:true,favorite:true,spellName});});
  app.delete('/api/v2/spells/favorites/:spellName', requireUser, (req,res)=>{db.run('DELETE FROM spell_favorites WHERE userId=? AND spellName=?',[req.user.id,decodeURIComponent(req.params.spellName)]);res.json({ok:true});});
  app.get('/api/v2/characters/:id/prepared-spells', requireUser, (req,res)=>res.json(db.all('SELECT spellName,prepared FROM prepared_spells WHERE characterId=? ORDER BY createdAt ASC',[req.params.id])));
  app.post('/api/v2/characters/:id/prepared-spells', requireUser, (req,res)=>{const body=parseBody(req);const spellName=clean(body.spellName,'',200);const character=db.get('SELECT id,class,level,attributes FROM characters WHERE id=?',[req.params.id]);if(!character)return res.status(404).json({error:'Personagem não encontrado.'});const spell=spellReference.find(item=>item.name===spellName);if(!spell)return res.status(404).json({error:'Feitiço não encontrado no catálogo.'});const className=String(character.class||'');if(Array.isArray(spell.classes)&&spell.classes.length&&!spell.classes.some(name=>name.toLowerCase()===className.toLowerCase()))return res.status(400).json({error:'Este feitiço não está disponível para a classe da ficha.'});const prepared=body.prepared===false?0:1;if(prepared){const existing=db.get('SELECT spellName FROM prepared_spells WHERE characterId=? AND prepared=1 AND spellName<>?',[character.id,spellName]);const attrs=json(character.attributes,{});const ability=className==='Clérigo'||className==='Druida'||className==='Monge'?'sabedoria':className==='Mago'||className==='Artífice'?'inteligencia':'carisma';const modifier=Math.floor((Number(attrs[ability]||10)-10)/2);const limit=Math.max(1,modifier+Number(character.level||1));const count=db.get('SELECT COUNT(*) AS count FROM prepared_spells WHERE characterId=? AND prepared=1 AND spellName<>?',[character.id,spellName])?.count||0;if(count>=limit)return res.status(400).json({error:`Limite de magias preparadas atingido (${limit}).`});}db.run('INSERT OR REPLACE INTO prepared_spells (id,characterId,spellName,prepared,updatedAt) VALUES (?,?,?,?,datetime(\'now\'))',[id(newId),character.id,spellName,prepared]);res.json({spellName,prepared:!!prepared});});
  app.delete('/api/v2/characters/:id/prepared-spells/:spellName', requireUser, (req,res)=>{db.run('DELETE FROM prepared_spells WHERE characterId=? AND spellName=?',[req.params.id,decodeURIComponent(req.params.spellName)]);res.json({ok:true});});
}

module.exports = { registerFeatureApi };
