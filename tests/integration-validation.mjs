import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const port = 4187;
const server = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
try {
  await wait(1800);
  const itemResponse = await fetch(`http://127.0.0.1:${port}/api/item-reference`);
  const itemPayload = await itemResponse.json();
  const items = itemPayload.items || itemPayload;
  assert.equal(items.length, 96);
  const classResponse = await fetch(`http://127.0.0.1:${port}/api/class-reference`);
  const classPayload = await classResponse.json();
  const classes = classPayload.classes || classPayload;
  assert.equal(classes.length, 13);
  assert.equal(classes.filter(item => item.proficiencies).length, 13);
  const authResponse = await fetch(`http://127.0.0.1:${port}/api/campaigns`);
  assert.equal(authResponse.status, 401);
  const authBody = await authResponse.json();
  assert.equal(authBody.code, 'AUTH_REQUIRED');
  console.log(`integration-validation: OK (${items.length} itens, ${classes.length} classes, auth guard 401)`);
} finally {
  server.kill('SIGTERM');
}
