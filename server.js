require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'bookings.xlsx');
const CONFIG_FILE = path.join(DATA_DIR, 'shop-config.json');
const STATIC_DIR = fs.existsSync(path.join(__dirname, 'dist')) ? path.join(__dirname, 'dist') : path.join(__dirname, 'public');
const STEP = 30;
const HEADERS = ['ID', 'Created', 'Name', 'Phone', 'Service', 'Price (TND)', 'Date', 'Start', 'End', 'Status', 'Calendar Event ID', 'Email', 'Barber', 'Lang'];
const DEFAULT_CONFIG = {
  services: [
    { id: 'haircut', name: 'Haircut', min: 30, price: 15, description: 'A clean, considered cut shaped around you.' },
    { id: 'beard', name: 'Beard Trim', min: 20, price: 8, description: 'Clean lines and a balanced shape, finished right.' },
    { id: 'both', name: 'Haircut + Beard', min: 45, price: 20, description: 'The full refresh: cut, beard and a polished finish.' },
    { id: 'kids', name: "Kids' Cut", min: 25, price: 10, description: 'A comfortable, patient cut for younger clients.' }
  ],
  barbers: ['Wassime', 'Yacine'],
  hours: { 0: ['10:00', '22:00'], 1: ['10:00', '22:00'], 2: ['10:00', '22:00'], 3: null, 4: ['10:00', '22:00'], 5: ['10:00', '22:00'], 6: ['10:00', '22:00'] },
  blockedDates: [],
  settings: { shopName: 'Ziko Hairstyle', location: 'Sfax, Tunisia', phone: '+216 29 090 385', email: 'mohamedjlaiel4000@gmail.com', instagram: 'https://www.instagram.com/ziko_hairstyle/' }
};
const clone = value => JSON.parse(JSON.stringify(value));
const toMin = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; };
const toStr = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const tunisNow = () => new Date(Date.now() + 3600000);
const validDate = d => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return false;
  const date = new Date(d + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === d;
};

async function readConfig() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_FILE)) await fs.promises.writeFile(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
  try {
    const stored = JSON.parse(await fs.promises.readFile(CONFIG_FILE, 'utf8'));
    return { ...clone(DEFAULT_CONFIG), ...stored, settings: { ...DEFAULT_CONFIG.settings, ...(stored.settings || {}) } };
  } catch (error) {
    console.error('Could not read shop configuration:', error.message);
    return clone(DEFAULT_CONFIG);
  }
}
async function writeConfig(config) {
  await fs.promises.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}
async function loadBook() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const wb = new ExcelJS.Workbook();
  if (fs.existsSync(FILE)) await wb.xlsx.readFile(FILE);
  let ws = wb.getWorksheet('Bookings');
  if (!ws) {
    ws = wb.addWorksheet('Bookings');
    ws.addRow(HEADERS);
    ws.getRow(1).font = { bold: true };
    [14, 22, 22, 18, 22, 12, 12, 10, 10, 14, 26, 28, 14, 8].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  }
  HEADERS.forEach((header, index) => {
    const cell = ws.getRow(1).getCell(index + 1);
    if (!cell.value) { cell.value = header; cell.font = { bold: true }; }
  });
  return { wb, ws };
}
function excelBusy(ws, date, barber) {
  const out = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const value = i => String(row.getCell(i).value ?? '');
    if (value(7) === date && value(10) !== 'Cancelled' && (!value(13) || value(13) === barber)) {
      const start = toMin(value(8)), end = toMin(value(9));
      if (!Number.isNaN(start) && !Number.isNaN(end)) out.push([start, end]);
    }
  });
  return out;
}
async function slotList(date, serviceId, barber, ws, config) {
  const service = config.services.find(item => item.id === serviceId);
  const hours = config.hours[new Date(date + 'T00:00:00Z').getUTCDay()];
  if (!validDate(date) || !service || !hours || !config.barbers.includes(barber) || config.blockedDates.includes(date)) return [];
  const now = tunisNow(), today = now.toISOString().slice(0, 10), nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (date < today) return [];
  const busy = excelBusy(ws, date, barber), out = [];
  for (let start = toMin(hours[0]); start + Number(service.min) <= toMin(hours[1]); start += STEP) {
    const free = !(date === today && start <= nowMin) && !busy.some(([a, b]) => start < b && start + Number(service.min) > a);
    out.push({ time: toStr(start), free });
  }
  return out;
}
function publicConfig(config) {
  return { services: config.services, barbers: config.barbers, hours: config.hours, blockedDates: config.blockedDates, settings: config.settings };
}
function supabaseConfig() {
  return { url: process.env.VITE_SUPABASE_URL || '', key: process.env.VITE_SUPABASE_ANON_KEY || '' };
}
async function verifyAdminToken(token) {
  const { url, key } = supabaseConfig();
  if (!url || !key) return { configured: false, error: 'Supabase is not configured on the server.' };
  try {
    const base = url.replace(/\/$/, '');
    const userResponse = await fetch(base + '/auth/v1/user', { headers: { apikey: key, Authorization: 'Bearer ' + token } });
    if (!userResponse.ok) return { ok: false, error: 'Your session has expired. Please sign in again.' };
    const user = await userResponse.json();
    const configuredAdminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (!configuredAdminEmail) return { configured: false, error: 'ADMIN_EMAIL is not configured on the server.' };
    if (String(user.email || '').trim().toLowerCase() !== configuredAdminEmail) return { ok: false, error: 'Sign in with the configured Ziko admin email.' };
    const adminResponse = await fetch(base + '/rest/v1/admin_users?select=user_id&user_id=eq.' + encodeURIComponent(user.id) + '&limit=1', {
      headers: { apikey: key, Authorization: 'Bearer ' + token }
    });
    if (!adminResponse.ok) return { ok: false, error: 'Could not verify admin access.' };
    const admins = await adminResponse.json();
    if (!Array.isArray(admins) || !admins.some(row => row.user_id === user.id)) return { ok: false, error: 'This account is not authorized as a Ziko admin.' };
    return { ok: true, user };
  } catch (error) {
    console.error('Supabase admin verification failed:', error.message);
    return { ok: false, error: 'Could not connect to Supabase.' };
  }
}
function readToken(req) {
  const cookies = (req.headers.cookie || '').split(';').map(part => part.trim());
  const entry = cookies.find(part => part.startsWith('ziko_admin='));
  return entry ? decodeURIComponent(entry.slice('ziko_admin='.length)) : '';
}
async function authorize(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: 'Admin sign-in required.' });
  const result = await verifyAdminToken(token);
  if (result.configured === false) return res.status(503).json({ error: result.error });
  if (!result.ok) return res.status(401).json({ error: result.error });
  req.adminUser = result.user;
  next();
}
app.use(express.json({ limit: '100kb' }));

app.get('/api/config', async (req, res) => {
  try { res.json(publicConfig(await readConfig())); }
  catch (error) { console.error(error); res.status(500).json({ error: 'Could not load the shop settings.' }); }
});
app.get('/api/slots', async (req, res) => {
  try {
    const { date, service, barber } = req.query;
    if (!validDate(date)) return res.status(400).json({ error: 'Bad date' });
    const [{ ws }, config] = await Promise.all([loadBook(), readConfig()]);
    res.json({ slots: await slotList(date, service, barber, ws, config) });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Could not load appointment times.' }); }
});
let chain = Promise.resolve();
const lock = fn => { const result = chain.then(fn, fn); chain = result.catch(() => {}); return result; };
app.post('/api/book', (req, res) => lock(async () => {
  try {
    const { service, date, time, name, phone, email, barber, lang } = req.body || {};
    const config = await readConfig(), svc = config.services.find(item => item.id === service);
    if (!svc || !validDate(date) || !/^\d{2}:\d{2}$/.test(time || '') || !config.barbers.includes(barber)) return res.status(400).json({ error: 'Invalid appointment details.' });
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60) return res.status(400).json({ error: 'Please enter your name.' });
    if (typeof phone !== 'string' || !/^\+?[0-9 ()-]{8,20}$/.test(phone.trim())) return res.status(400).json({ error: 'Please enter a valid phone number.' });
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 100) return res.status(400).json({ error: 'Please enter a valid email address.' });
    const { wb, ws } = await loadBook();
    const slot = (await slotList(date, service, barber, ws, config)).find(item => item.time === time);
    if (!slot || !slot.free) return res.status(409).json({ error: 'Sorry, this time is unavailable. Please choose another.' });
    const end = toStr(toMin(time) + Number(svc.min));
    ws.addRow([Date.now().toString(36), tunisNow().toISOString().slice(0, 16).replace('T', ' '), name.trim(), phone.trim(), svc.name, svc.price, date, time, end, 'Requested', '', email.trim(), barber, ['fr', 'ar'].includes(lang) ? lang : 'en']);
    await wb.xlsx.writeFile(FILE);
    res.json({ ok: true, emailed: false });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Could not save the appointment request.' }); }
}));

app.post('/api/admin/session', async (req, res) => {
  const token = req.body && req.body.access_token;
  if (!token || typeof token !== 'string') return res.status(400).json({ error: 'Missing Supabase session token.' });
  const result = await verifyAdminToken(token);
  if (result.configured === false) return res.status(503).json({ error: result.error });
  if (!result.ok) return res.status(401).json({ error: result.error });
  res.cookie('ziko_admin', token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 1000 });
  res.json({ ok: true, email: result.user.email });
});
app.delete('/api/admin/session', (req, res) => {
  res.clearCookie('ziko_admin', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' });
  res.json({ ok: true });
});
app.get('/api/admin/bookings', authorize, async (req, res) => {
  try {
    const { ws } = await loadBook(), rows = [];
    ws.eachRow((row, n) => { if (n > 1) rows.push([1,2,3,4,5,6,7,8,9,10,12,13].map(i => String(row.getCell(i).value ?? ''))); });
    res.json({ rows: rows.reverse() });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Could not load appointments.' }); }
});
app.patch('/api/admin/appointments/:id', authorize, (req, res) => lock(async () => {
  const status = req.body && req.body.status;
  if (!['Requested', 'Confirmed', 'Cancelled', 'Completed'].includes(status)) return res.status(400).json({ error: 'Invalid appointment status.' });
  try {
    const { wb, ws } = await loadBook(); let found = false;
    ws.eachRow((row, n) => { if (n > 1 && String(row.getCell(1).value) === req.params.id) { row.getCell(10).value = status; found = true; } });
    if (!found) return res.status(404).json({ error: 'Appointment not found.' });
    await wb.xlsx.writeFile(FILE); res.json({ ok: true });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Could not update appointment.' }); }
}));
app.get('/api/admin/stats', authorize, async (req, res) => {
  try {
    const { ws } = await loadBook(), today = tunisNow().toISOString().slice(0, 10);
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : today.slice(0, 7);
    const year = /^\d{4}$/.test(req.query.year || '') ? req.query.year : today.slice(0, 4);
    const blank = () => ({ revenue: 0, count: 0 });
    const add = (obj, key, price) => { obj[key] = obj[key] || blank(); obj[key].revenue += price; obj[key].count++; };
    const out = { today, month, year, days: {}, months: {}, years: {}, barbersMonth: {}, barbersYear: {}, totals: { today: blank(), month: blank(), year: blank() } };
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const value = i => String(row.getCell(i).value ?? '');
      if (value(10) === 'Cancelled') return;
      const date = value(7), price = Number(value(6)) || 0, barber = value(13) || 'Not set';
      if (!validDate(date)) return;
      add(out.years, date.slice(0, 4), price);
      if (date === today) add(out.totals, 'today', price);
      if (date.slice(0, 4) === year) { add(out.months, date.slice(0, 7), price); add(out.barbersYear, barber, price); add(out.totals, 'year', price); }
      if (date.slice(0, 7) === month) { add(out.days, date, price); add(out.barbersMonth, barber, price); add(out.totals, 'month', price); }
    });
    res.json(out);
  } catch (error) { console.error(error); res.status(500).json({ error: 'Could not load the dashboard.' }); }
});
app.get('/api/admin/settings', authorize, async (req, res) => {
  try { res.json(await readConfig()); } catch (error) { console.error(error); res.status(500).json({ error: 'Could not load settings.' }); }
});
app.put('/api/admin/settings', authorize, async (req, res) => {
  const next = req.body || {};
  if (!Array.isArray(next.services) || !Array.isArray(next.barbers) || !next.hours || !Array.isArray(next.blockedDates) || !next.settings) return res.status(400).json({ error: 'Invalid shop settings.' });
  const ids = new Set();
  for (const item of next.services) {
    if (!item || !/^[a-z0-9-]{2,40}$/.test(item.id || '') || ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || !Number.isFinite(Number(item.min)) || Number(item.min) < 5 || Number(item.min) > 240 || !Number.isFinite(Number(item.price)) || Number(item.price) < 0 || Number(item.price) > 10000) return res.status(400).json({ error: 'Check service names, IDs, durations and prices.' });
    ids.add(item.id);
  }
  if (!next.services.length || next.barbers.some(name => typeof name !== 'string' || !name.trim()) || !next.barbers.length || next.blockedDates.some(date => !validDate(date))) return res.status(400).json({ error: 'Add at least one barber and service and check blocked dates.' });
  for (let day = 0; day < 7; day++) {
    const hours = next.hours[day];
    if (hours !== null && (!Array.isArray(hours) || hours.length !== 2 || !/^\d{2}:\d{2}$/.test(hours[0]) || !/^\d{2}:\d{2}$/.test(hours[1]) || toMin(hours[0]) >= toMin(hours[1]))) return res.status(400).json({ error: 'Check the opening and closing times.' });
  }
  try {
    const config = { services: next.services.map(item => ({ id: item.id, name: item.name.trim(), min: Number(item.min), price: Number(item.price), description: String(item.description || '').slice(0, 220) })),
      barbers: [...new Set(next.barbers.map(name => name.trim()).filter(Boolean))], hours: next.hours, blockedDates: [...new Set(next.blockedDates)],
      settings: { ...DEFAULT_CONFIG.settings, ...next.settings } };
    await writeConfig(config); res.json({ ok: true, config });
  } catch (error) { console.error(error); res.status(500).json({ error: 'Could not save settings.' }); }
});

app.get('/dashboard.html', async (req, res) => {
  const token = readToken(req), result = token ? await verifyAdminToken(token) : { ok: false };
  if (!result.ok) return res.redirect('/admin.html');
  res.sendFile(path.join(STATIC_DIR, 'dashboard.html'));
});
app.use(express.static(STATIC_DIR, { index: 'index.html' }));
app.get('*', (req, res) => res.sendFile(path.join(STATIC_DIR, 'index.html')));
app.listen(PORT, () => console.log('Ziko Hairstyle running at http://localhost:' + PORT));
