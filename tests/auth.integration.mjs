import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { existsSync, copyFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import db from '../db.js';

const port = 4191;
const base = `http://127.0.0.1:${port}`;
const dbPath = db.name;
const backupPath = `${dbPath}.auth-test-backup-${process.pid}`;
const hadDatabase = existsSync(dbPath);
if (hadDatabase) copyFileSync(dbPath, backupPath);

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  return { response, body, cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
}
async function register(label) {
  const result = await request('/api/auth/register', { method: 'POST', body: JSON.stringify({ name: `Teste ${label}`, email: `auth-${label}-${Date.now()}@example.test`, password: 'senha-segura-123' }) });
  assert.equal(result.response.status, 201, `registro ${label}`);
  return result.cookie;
}

await db.initDb();
const legacyId = randomUUID();
db.run(`INSERT INTO characters (id,name,class,race,level,attributes,skillProficiencies,saveProficiencies,resources,items,spellSlotsUsage,creationData,ownerId,campaignId) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL)`, [legacyId, 'Legado de teste', 'Guerreiro', 'Humano', 1, '{}', '{}', '{}', '[]', '[]', '{}', '{}']);

const server = spawn(process.execPath, ['server.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
try {
  await wait(1800);
  const anonymous = await request('/api/characters');
  assert.equal(anonymous.response.status, 401, 'acesso anônimo deve ser bloqueado');
  assert.equal(anonymous.body.code, 'AUTH_REQUIRED');

  const cookieA = await register('a');
  const cookieB = await register('b');
  const created = await request('/api/characters', { method: 'POST', headers: { Cookie: cookieA }, body: JSON.stringify({ name: 'Ficha A', class: 'Guerreiro', race: 'Humano', level: 1 }) });
  assert.equal(created.response.status, 201, 'usuário A deve criar personagem');
  const characterId = created.body.id;

  const forbiddenRead = await request(`/api/characters/${characterId}`, { headers: { Cookie: cookieB } });
  assert.equal(forbiddenRead.response.status, 403, 'usuário B não pode ler personagem de A');
  assert.equal(forbiddenRead.body.code, 'CHARACTER_FORBIDDEN');
  const forbiddenEdit = await request(`/api/characters/${characterId}`, { method: 'PUT', headers: { Cookie: cookieB }, body: JSON.stringify({ name: 'Tentativa B' }) });
  assert.equal(forbiddenEdit.response.status, 403, 'usuário B não pode editar personagem de A');

  const legacyRead = await request(`/api/characters/${legacyId}`, { headers: { Cookie: cookieB } });
  assert.equal(legacyRead.response.status, 200, 'usuário autenticado pode visualizar legado');
  const claim = await request(`/api/characters/${legacyId}/claim`, { method: 'POST', headers: { Cookie: cookieA } });
  assert.equal(claim.response.status, 200, 'usuário A deve reivindicar legado');
  const secondClaim = await request(`/api/characters/${legacyId}/claim`, { method: 'POST', headers: { Cookie: cookieB } });
  assert.equal(secondClaim.response.status, 409, 'claim deve falhar quando a ficha já tem dono');
  const legacyEditByB = await request(`/api/characters/${legacyId}`, { method: 'PUT', headers: { Cookie: cookieB }, body: JSON.stringify({ name: 'Tentativa legado B' }) });
  assert.equal(legacyEditByB.response.status, 403, 'usuário B não pode editar legado reivindicado por A');

  console.log('auth.integration: anônimo, ownership e claim legado aprovados');
} finally {
  server.kill('SIGTERM');
  await wait(250);
  if (hadDatabase) copyFileSync(backupPath, dbPath);
  else if (existsSync(dbPath)) unlinkSync(dbPath);
  if (existsSync(backupPath)) unlinkSync(backupPath);
}
