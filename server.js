import http from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, '.data');
const dataFile = path.join(dataDir, 'db.json');
const sessions = new Map();
const categories = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Compras', 'Contas', 'Salário', 'Outros'];
const emptyDb = () => ({ users: [], transactions: [], budgets: [], goals: [] });
let db = emptyDb();
let writing = Promise.resolve();

try { db = { ...emptyDb(), ...JSON.parse(await readFile(dataFile, 'utf8')) }; } catch (error) { if (error.code !== 'ENOENT') throw error; }

function save() {
  writing = writing.then(async () => {
    await mkdir(dataDir, { recursive: true });
    await writeFile(dataFile + '.tmp', JSON.stringify(db, null, 2));
    const { rename } = await import('node:fs/promises');
    await rename(dataFile + '.tmp', dataFile);
  });
  return writing;
}

function json(res, status, body, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra });
  res.end(JSON.stringify(body));
}
function bad(res, message, status = 400) { json(res, status, { error: message }); }
function parseCookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').map(s => s.trim().split('=').map(decodeURIComponent)).filter(x => x.length === 2)); }
function userFor(req) { const id = sessions.get(parseCookies(req).sid); return db.users.find(u => u.id === id); }
function publicUser(user) { return user && { id: user.id, name: user.name, email: user.email, demo: !!user.demo }; }
function setSession(res, user) {
  const sid = randomBytes(32).toString('hex');
  sessions.set(sid, user.id);
  res.setHeader('Set-Cookie', `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}
function hash(password, salt = randomBytes(16).toString('hex')) { return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
function verify(password, stored) {
  const [salt, expected] = stored.split(':');
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
async function body(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 50_000) throw new Error('Dados enviados excedem o limite.'); }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new Error('JSON inválido.'); }
}
function dateToday() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function monthNow() { return dateToday().slice(0, 7); }
function validDate(value) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const d = new Date(`${value}T12:00:00`); return !Number.isNaN(d.getTime()) && `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` === value; }
function cents(value) { return Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) / 100 : NaN; }
function records(user) {
  return {
    transactions: db.transactions.filter(x => x.userId === user.id).sort((a, b) => b.date.localeCompare(a.date)),
    budgets: db.budgets.filter(x => x.userId === user.id),
    goals: db.goals.filter(x => x.userId === user.id)
  };
}
function seedDemo(user) {
  const m = monthNow();
  const last = new Date(); last.setMonth(last.getMonth() - 1);
  const p = last.toISOString().slice(0, 7);
  const examples = [
    [m, 2, 'Salário', 4800, 'Salário', 'income'], [m, 3, 'Aluguel', 1450, 'Moradia', 'expense'],
    [m, 5, 'Supermercado', 385.70, 'Alimentação', 'expense'], [m, 7, 'Internet', 99.90, 'Contas', 'expense'],
    [m, 10, 'Transporte por app', 42.50, 'Transporte', 'expense'], [m, 12, 'Farmácia', 68.20, 'Saúde', 'expense'],
    [m, 15, 'Cinema', 54, 'Lazer', 'expense'], [m, 18, 'Mercado da semana', 219.80, 'Alimentação', 'expense'],
    [m, 21, 'Freelance', 650, 'Outros', 'income'], [m, 22, 'Café', 18.50, 'Alimentação', 'expense'],
    [p, 2, 'Salário', 4800, 'Salário', 'income'], [p, 4, 'Aluguel', 1450, 'Moradia', 'expense'],
    [p, 8, 'Supermercado', 530, 'Alimentação', 'expense'], [p, 16, 'Passeio', 160, 'Lazer', 'expense']
  ];
  for (const [month, day, description, amount, category, type] of examples) {
    db.transactions.push({ id: randomUUID(), userId: user.id, description, amount, category, type, date: `${month}-${String(Math.min(day, new Date(Number(month.slice(0,4)), Number(month.slice(5)), 0).getDate())).padStart(2,'0')}` });
  }
  for (const [category, limit] of [['Alimentação', 850], ['Transporte', 300], ['Lazer', 220]]) db.budgets.push({ id: randomUUID(), userId: user.id, category, limit, month: m });
  db.goals.push({ id: randomUUID(), userId: user.id, name: 'Reserva de emergência', target: 6000, saved: 1450, deadline: `${new Date().getFullYear() + 1}-12-31` });
}
function classify(text) {
  const t = text.toLowerCase();
  if (/aluguel|condom[ií]nio|casa/.test(t)) return 'Moradia';
  if (/mercado|supermercado|almo[cç]o|jantar|caf[eé]|lanche|restaurante/.test(t)) return 'Alimentação';
  if (/uber|99|[oô]nibus|metr[oô]|gasolina|combust[ií]vel|transporte/.test(t)) return 'Transporte';
  if (/farm[aá]cia|m[eé]dico|consulta|rem[eé]dio/.test(t)) return 'Saúde';
  if (/curso|livro|faculdade|escola/.test(t)) return 'Educação';
  if (/cinema|show|passeio|viagem|streaming/.test(t)) return 'Lazer';
  if (/roupa|sapato|presente|comprei/.test(t)) return 'Compras';
  if (/internet|luz|[aá]gua|telefone|energia/.test(t)) return 'Contas';
  if (/sal[aá]rio|pagamento mensal/.test(t)) return 'Salário';
  return 'Outros';
}
function parseTransaction(text) {
  const match = text.match(/(?:r\$\s*)?((?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2}|\.\d{1,2})?)/i);
  if (!match || !/(gastei|paguei|comprei|recebi|ganhei|sal[aá]rio|vendi|freelance|renda|despesa|entrada)/i.test(text)) return null;
  const raw = match[1];
  const amount = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : /\.\d{1,2}$/.test(raw) ? raw : raw.replace(/\./g, ''));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return null;
  const type = /(recebi|ganhei|sal[aá]rio|vendi|freelance|renda|entrada)/i.test(text) ? 'income' : 'expense';
  let date = dateToday();
  if (/ontem/i.test(text)) { const d = new Date(); d.setDate(d.getDate() - 1); date = d.toISOString().slice(0, 10); }
  const short = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
  if (short) { const proposed = `${short[3] || new Date().getFullYear()}-${short[2].padStart(2,'0')}-${short[1].padStart(2,'0')}`; if (validDate(proposed)) date = proposed; }
  const description = text.replace(/\b(hoje|ontem)\b/gi, '').replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{4})?\b/g, '').replace(/r\$\s*[\d.,]+/gi, '').replace(/\b(gastei|paguei|comprei|recebi|ganhei|vendi)\b/gi, '').replace(/\s+/g, ' ').trim().replace(/^(em|no|na|com|de)\s+/i, '').trim();
  return { description: description ? description.charAt(0).toUpperCase() + description.slice(1) : (type === 'income' ? 'Receita' : 'Despesa'), amount, category: classify(text), type, date };
}
function money(value) { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function answerQuestion(user, text) {
  const { transactions, budgets, goals } = records(user);
  const current = transactions.filter(x => x.date.startsWith(monthNow()));
  const income = current.filter(x => x.type === 'income').reduce((s, x) => s + x.amount, 0);
  const expense = current.filter(x => x.type === 'expense').reduce((s, x) => s + x.amount, 0);
  const byCategory = Object.entries(current.filter(x => x.type === 'expense').reduce((a, x) => (a[x.category] = (a[x.category] || 0) + x.amount, a), {})).sort((a,b) => b[1]-a[1]);
  if (/meta|guardar|economizar|poupar/i.test(text)) {
    if (!goals.length) return 'Você ainda não tem uma meta. Crie uma em “Metas” para eu calcular quanto guardar por mês.';
    const goal = goals.find(g => text.toLowerCase().includes(g.name.toLowerCase())) || goals[0];
    const months = Math.max(1, (new Date(goal.deadline).getFullYear() - new Date().getFullYear()) * 12 + new Date(goal.deadline).getMonth() - new Date().getMonth() + 1);
    return `Para “${goal.name}”, faltam ${money(Math.max(0, goal.target - goal.saved))}. Guardando cerca de ${money(Math.max(0, (goal.target - goal.saved) / months))} por mês durante ${months} mês(es), você alcança o valor planejado. Confira se isso cabe no seu orçamento.`;
  }
  if (/or[cç]amento|limite/i.test(text)) {
    const active = budgets.filter(x => x.month === monthNow());
    if (!active.length) return 'Você ainda não definiu orçamentos para este mês. Crie limites por categoria para acompanhar seus gastos.';
    return active.map(b => { const used = byCategory.find(x => x[0] === b.category)?.[1] || 0; return `${b.category}: ${money(used)} de ${money(b.limit)} (${used > b.limit ? 'acima do limite' : `restam ${money(b.limit - used)}`})`; }).join(' · ');
  }
  if (/mais|categoria|onde|gastei/i.test(text)) return byCategory.length ? `Neste mês, você gastou mais em ${byCategory[0][0]}: ${money(byCategory[0][1])}. Suas despesas totais são ${money(expense)}. Veja se há uma compra que pode ser adiada nessa categoria.` : 'Ainda não há despesas registradas neste mês.';
  if (/saldo|receita|despesa|resumo/i.test(text)) return `Neste mês, suas receitas somam ${money(income)} e suas despesas, ${money(expense)}. O saldo do período é ${money(income - expense)}.`;
  return current.length ? `Posso resumir seu saldo, identificar sua maior categoria de gastos, acompanhar orçamentos ou calcular quanto guardar para uma meta. Neste mês, seu saldo é ${money(income - expense)}.` : 'Comece registrando uma receita ou despesa. Você pode escrever, por exemplo: “Gastei R$ 42,50 no almoço hoje”.';
}

async function answerWithAI(user, question) {
  const current = records(user);
  const thisMonth = current.transactions.filter(x => x.date.startsWith(monthNow()));
  const summary = {
    month: monthNow(),
    income: totalByType(thisMonth, 'income'),
    expense: totalByType(thisMonth, 'expense'),
    expensesByCategory: Object.fromEntries(categories.map(category => [category, thisMonth.filter(x => x.type === 'expense' && x.category === category).reduce((s,x) => s+x.amount,0)])),
    budgets: current.budgets.filter(x => x.month === monthNow()).map(({ category, limit }) => ({ category, limit })),
    goals: current.goals.map(({ name, target, saved, deadline }) => ({ name, target, saved, deadline }))
  };
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-5.6-terra', store: false,
      instructions: 'Você é um assistente educativo de finanças pessoais em português do Brasil. Use somente os números do JSON fornecido. Não invente dados, não recomende produtos financeiros específicos, não peça informações bancárias. Seja acolhedor e objetivo, em até 90 palavras. Para cálculos, confira a aritmética. Se faltar informação, diga o que falta.',
      input: `Dados agregados do usuário: ${JSON.stringify(summary)}\nPergunta: ${question}` }),
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`Serviço de IA indisponível (${response.status})`);
  const data = await response.json();
  const answer = (data.output || []).flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n').trim();
  if (!answer) throw new Error('Resposta vazia da IA');
  return answer;
}
function totalByType(items, type) { return Math.round(items.filter(x => x.type === type).reduce((s,x) => s+x.amount,0)*100)/100; }

function validateTransaction(x) {
  const amount = cents(x.amount);
  if (!x.description || String(x.description).trim().length > 100 || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000 || !['income','expense'].includes(x.type) || !categories.includes(x.category) || !validDate(x.date)) return null;
  return { description: String(x.description).trim(), amount, type: x.type, category: x.category, date: x.date };
}

async function api(req, res, pathname) {
  const method = req.method;
  if (method !== 'GET' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return bad(res, 'Origem não permitida.', 403);
  const input = method === 'GET' ? {} : await body(req);
  if (pathname === '/api/session' && method === 'GET') return json(res, 200, { user: publicUser(userFor(req)) || null, aiAvailable: !!process.env.OPENAI_API_KEY });
  if (pathname === '/api/register' && method === 'POST') {
    const name = String(input.name || '').trim(); const email = String(input.email || '').trim().toLowerCase(); const password = String(input.password || '');
    if (name.length < 2 || name.length > 70 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return bad(res, 'Informe nome, e-mail válido e senha de pelo menos 8 caracteres.');
    if (db.users.some(x => x.email === email)) return bad(res, 'Este e-mail já está cadastrado.', 409);
    const user = { id: randomUUID(), name, email, password: hash(password), demo: false };
    db.users.push(user); await save(); setSession(res, user); return json(res, 201, { user: publicUser(user) });
  }
  if (pathname === '/api/login' && method === 'POST') {
    const user = db.users.find(x => !x.demo && x.email === String(input.email || '').trim().toLowerCase());
    if (!user || !verify(String(input.password || ''), user.password)) return bad(res, 'E-mail ou senha incorretos.', 401);
    setSession(res, user); return json(res, 200, { user: publicUser(user) });
  }
  if (pathname === '/api/demo' && method === 'POST') {
    const user = { id: randomUUID(), name: 'Visitante', email: '', password: '', demo: true };
    db.users.push(user); seedDemo(user); await save(); setSession(res, user); return json(res, 201, { user: publicUser(user) });
  }
  if (pathname === '/api/logout' && method === 'POST') {
    sessions.delete(parseCookies(req).sid); res.setHeader('Set-Cookie', `sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`); return json(res, 200, { ok: true });
  }
  const user = userFor(req); if (!user) return bad(res, 'Entre na sua conta para continuar.', 401);
  if (pathname === '/api/data' && method === 'GET') return json(res, 200, records(user));
  if (pathname === '/api/chat' && method === 'POST') {
    const text = String(input.text || '').trim(); if (!text || text.length > 500) return bad(res, 'Escreva uma mensagem de até 500 caracteres.');
    const draft = parseTransaction(text);
    if (draft) return json(res, 200, { kind: 'draft', draft, answer: 'Entendi esta movimentação. Confira os dados antes de salvar.', source: 'rules' });
    if (input.useAI && process.env.OPENAI_API_KEY) {
      try { return json(res, 200, { kind: 'answer', answer: await answerWithAI(user, text), source: 'ai' }); }
      catch (error) { console.warn(error.message); }
    }
    return json(res, 200, { kind: 'answer', answer: answerQuestion(user, text), source: 'rules' });
  }
  const match = pathname.match(/^\/api\/(transactions|budgets|goals)(?:\/([0-9a-f-]+))?$/);
  if (!match) return bad(res, 'Rota não encontrada.', 404);
  const [, resource, id] = match;
  const list = db[resource];
  const existing = id && list.find(x => x.id === id && x.userId === user.id);
  if (id && !existing) return bad(res, 'Registro não encontrado.', 404);
  if (method === 'DELETE' && id) { db[resource] = list.filter(x => x.id !== id); await save(); return json(res, 200, { ok: true }); }
  if (!['POST','PUT'].includes(method) || (method === 'POST' && id) || (method === 'PUT' && !id)) return bad(res, 'Método não permitido.', 405);
  let value;
  if (resource === 'transactions') value = validateTransaction(input);
  if (resource === 'budgets') {
    const limit = cents(input.limit);
    if (categories.includes(input.category) && /^\d{4}-\d{2}$/.test(input.month) && Number.isFinite(limit) && limit > 0) value = { category: input.category, month: input.month, limit };
    if (method === 'POST' && list.some(x => x.userId === user.id && x.category === input.category && x.month === input.month)) return bad(res, 'Já existe um orçamento para essa categoria neste mês.');
  }
  if (resource === 'goals') {
    const target = cents(input.target), saved = cents(input.saved ?? 0);
    if (String(input.name || '').trim() && String(input.name).length <= 80 && Number.isFinite(target) && target > 0 && Number.isFinite(saved) && saved >= 0 && validDate(input.deadline)) value = { name: String(input.name).trim(), target, saved, deadline: input.deadline };
  }
  if (!value) return bad(res, 'Confira os campos informados.');
  if (existing) Object.assign(existing, value);
  else { value = { id: randomUUID(), userId: user.id, ...value }; list.push(value); }
  await save(); return json(res, existing ? 200 : 201, value);
}

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.startsWith('/api/')) return await api(req, res, pathname);
    const safePath = pathname === '/' ? '/index.html' : pathname;
    const filename = path.resolve(root, 'public', '.' + safePath);
    if (!filename.startsWith(path.join(root, 'public') + path.sep)) return bad(res, 'Arquivo não encontrado.', 404);
    const content = await readFile(filename);
    res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'" });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') return bad(res, 'Arquivo não encontrado.', 404);
    if (error.message?.includes('limite') || error.message === 'JSON inválido.') return bad(res, error.message);
    console.error(error); bad(res, 'Ocorreu um erro. Tente novamente.', 500);
  }
});
const port = process.env.PORT === undefined ? 3000 : Number(process.env.PORT);
server.listen(port, () => console.log(`Clareia disponível em http://localhost:${server.address().port}`));
