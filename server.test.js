import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('cadastro, isolamento, conversa e persistência', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'clareia-test-'));
  const child = spawn(process.execPath, ['server.js'], { cwd: path.dirname(fileURLToPath(import.meta.url)), env: { ...process.env, PORT: '0', DATA_DIR: dataDir }, stdio: ['ignore', 'pipe', 'pipe'] });
  let base;
  try {
    base = await new Promise((resolve, reject) => {
      let output = '';
      child.stdout.on('data', chunk => { output += chunk; const match = output.match(/localhost:(\d+)/); if (match) resolve(`http://localhost:${match[1]}`); });
      child.once('exit', code => reject(new Error(`Servidor terminou com código ${code}`)));
      setTimeout(() => reject(new Error('Servidor não iniciou')), 5000).unref();
    });
    async function request(route, method = 'GET', payload, cookie = '') {
      const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
      return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
    }
    assert.equal((await request('/api/session')).body.user, null);
    const a = await request('/api/register', 'POST', { name: 'Ana', email: 'ana@example.test', password: 'senha-segura-ana' });
    const b = await request('/api/register', 'POST', { name: 'Bia', email: 'bia@example.test', password: 'senha-segura-bia' });
    assert.equal(a.status, 201); assert.equal(b.status, 201);
    const parsed = await request('/api/chat', 'POST', { text: 'Gastei R$ 42,50 no almoço ontem' }, a.cookie);
    assert.equal(parsed.body.kind, 'draft');
    assert.equal(parsed.body.draft.amount, 42.5);
    assert.equal((await request('/api/data', 'GET', undefined, a.cookie)).body.transactions.length, 0);
    const created = await request('/api/transactions', 'POST', parsed.body.draft, a.cookie);
    assert.equal(created.status, 201);
    assert.equal((await request('/api/data', 'GET', undefined, a.cookie)).body.transactions.length, 1);
    assert.equal((await request('/api/data', 'GET', undefined, b.cookie)).body.transactions.length, 0);
    assert.equal((await request(`/api/transactions/${created.body.id}`, 'DELETE', {}, b.cookie)).status, 404);
    assert.equal((await request('/api/budgets', 'POST', { category: 'Alimentação', month: new Date().toISOString().slice(0,7), limit: 500 }, a.cookie)).status, 201);
    assert.equal((await request('/api/goals', 'POST', { name: 'Viagem', target: 3000, saved: 250, deadline: '2027-12-31' }, a.cookie)).status, 201);
    const answer = await request('/api/chat', 'POST', { text: 'Onde gastei mais este mês?' }, a.cookie);
    assert.equal(answer.body.kind, 'answer');
    assert.equal(answer.body.source, 'rules');
    assert.equal((await request('/api/logout', 'POST', {}, a.cookie)).status, 200);
    assert.equal((await request('/api/data', 'GET', undefined, a.cookie)).status, 401);
  } finally { child.kill(); await rm(dataDir, { recursive: true, force: true }); }
});
