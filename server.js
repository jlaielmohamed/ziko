require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const PORT = process.env.PORT || 3000;
const FILE = path.join(__dirname, 'data', 'bookings.xlsx');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const TZ = 'Africa/Tunis';   // UTC+1, no daylight saving
const STEP = 30;             // minutes between slots

// Edit prices / durations here
const SERVICES = {
  haircut: { name: 'Haircut', min: 30, price: 15 },
  beard:   { name: 'Beard Trim', min: 20, price: 8 },
  both:    { name: 'Haircut + Beard', min: 45, price: 20 },
  kids:    { name: "Kids' Cut", min: 25, price: 10 },
};
// Working hours per weekday (0 = Sunday). null = closed
const BARBERS = ['Wassime', 'Yacine'];
const OPEN = ['10:00', '22:00'];   // closed on Wednesday (3)
const HOURS = { 0: OPEN, 1: OPEN, 2: OPEN, 3: null, 4: OPEN, 5: OPEN, 6: OPEN };
const HEADERS = ['ID', 'Created', 'Name', 'Phone', 'Service', 'Price (TND)', 'Date', 'Start', 'End', 'Status', 'Calendar Event ID', 'Email', 'Barber', 'Lang'];

const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const toStr = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const tunisNow = () => new Date(Date.now() + 3600000);

// ---------- Excel "database" ----------
async function loadBook() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const wb = new ExcelJS.Workbook();
  if (fs.existsSync(FILE)) await wb.xlsx.readFile(FILE);
  let ws = wb.getWorksheet('Bookings');
  if (!ws) {
    ws = wb.addWorksheet('Bookings');
    ws.addRow(HEADERS);
    ws.getRow(1).font = { bold: true };
    [10, 20, 22, 16, 18, 12, 12, 8, 8, 12, 26, 28, 12, 6].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  }
  [12, 13, 14].forEach(i => { const c = ws.getRow(1).getCell(i); if (!c.value) { c.value = HEADERS[i - 1]; c.font = { bold: true }; } });
  return { wb, ws };
}
function excelBusy(ws, date, barber) {
  const out = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const v = i => String(row.getCell(i).value ?? '');
    if (v(7) === date && v(10) !== 'Cancelled' && (!v(13) || v(13) === barber)) {
      const a = toMin(v(8)), b = toMin(v(9));
      if (!isNaN(a) && !isNaN(b)) out.push([a, b]);
    }
  });
  return out;
}

// ---------- Availability ----------
async function slotList(date, svcId, barber, ws) {
  const svc = SERVICES[svcId];
  const hrs = HOURS[new Date(date + 'T00:00:00Z').getUTCDay()];
  if (!svc || !hrs || !BARBERS.includes(barber)) return [];
  const t = tunisNow(), today = t.toISOString().slice(0, 10), nowMin = t.getUTCHours() * 60 + t.getUTCMinutes();
  if (date < today) return [];
  const busy = excelBusy(ws, date, barber);
  const out = [];
  for (let s = toMin(hrs[0]); s + svc.min <= toMin(hrs[1]); s += STEP) {
    const free = !(date === today && s <= nowMin) && !busy.some(([a, b]) => s < b && s + svc.min > a);
    out.push({ time: toStr(s), free });
  }
  return out;
}

// ---------- Server ----------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/slots', async (req, res) => {
  try {
    const { date, service, barber } = req.query;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ error: 'Bad date' });
    const { ws } = await loadBook();
    res.json({ slots: await slotList(date, service, barber, ws) });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

let chain = Promise.resolve();                       // one booking at a time = no double booking
const lock = fn => { const r = chain.then(fn, fn); chain = r.catch(() => {}); return r; };

app.post('/api/book', (req, res) => lock(async () => {
  try {
    const { service, date, time, name, phone, email, barber, lang } = req.body || {};
    const svc = SERVICES[service];
    if (!svc || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !/^\d{2}:\d{2}$/.test(time || ''))
      return res.status(400).json({ error: 'Invalid booking data.' });
    if (!name || name.length < 2 || name.length > 60) return res.status(400).json({ error: 'Please enter your name.' });
    if (!/^\+?[0-9 ]{8,15}$/.test(phone || '')) return res.status(400).json({ error: 'Please enter a valid phone number.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '') || email.length > 100) return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (!BARBERS.includes(barber)) return res.status(400).json({ error: 'Invalid booking data.' });

    const { wb, ws } = await loadBook();
    const slot = (await slotList(date, service, barber, ws)).find(s => s.time === time);
    if (!slot || !slot.free) return res.status(409).json({ error: 'Sorry, this time is already booked. Please pick another one.' });

    const end = toStr(toMin(time) + svc.min);
    ws.addRow([Date.now().toString(36), tunisNow().toISOString().slice(0, 16).replace('T', ' '),
               name, phone, svc.name, svc.price, date, time, end, 'Confirmed', '', email, barber, ['fr', 'ar'].includes(lang) ? lang : 'en']);
    try { await wb.xlsx.writeFile(FILE); }
    catch (e) {
      return res.status(500).json({ error: 'Could not save. Close bookings.xlsx if it is open in Excel.' });
    }
    res.json({ ok: true, emailed: false });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
}));

// ---------- Admin ----------
const admin = (req, res, next) => (req.get('x-admin-password') === ADMIN_PASSWORD ? next() : res.status(401).json({ error: 'Wrong password' }));
app.get('/api/admin/bookings', admin, async (req, res) => {
  try {
    const { ws } = await loadBook(); const rows = [];
    ws.eachRow((row, n) => { if (n > 1) rows.push([1,2,3,4,5,6,7,8,9,10,12,13].map(i => String(row.getCell(i).value ?? ''))); });
    res.json({ rows: rows.reverse() });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});
app.get('/api/admin/stats', admin, async (req, res) => {
  try {
    const { ws } = await loadBook();
    const today = tunisNow().toISOString().slice(0, 10);
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : today.slice(0, 7);
    const year = /^\d{4}$/.test(req.query.year || '') ? req.query.year : today.slice(0, 4);
    const blank = () => ({ revenue: 0, count: 0 });
    const add = (o, k, p) => { o[k] = o[k] || blank(); o[k].revenue += p; o[k].count++; };
    const out = { today, month, year, days: {}, months: {}, years: {}, barbersMonth: {}, barbersYear: {},
                  totals: { today: blank(), month: blank(), year: blank() } };
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const v = i => String(row.getCell(i).value ?? '');
      if (v(10) === 'Cancelled') return;
      const d = v(7), p = Number(v(6)) || 0, b = v(13) || 'Not set';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      add(out.years, d.slice(0, 4), p);
      if (d === today) add(out.totals, 'today', p);
      if (d.slice(0, 4) === year) { add(out.months, d.slice(0, 7), p); add(out.barbersYear, b, p); add(out.totals, 'year', p); }
      if (d.slice(0, 7) === month) { add(out.days, d, p); add(out.barbersMonth, b, p); add(out.totals, 'month', p); }
    });
    res.json(out);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/admin/cancel', admin, (req, res) => lock(async () => {
  try {
    const { wb, ws } = await loadBook(); let info = null;
    ws.eachRow((row, n) => {
      if (n > 1 && String(row.getCell(1).value) === req.body.id) {
        const v = i => String(row.getCell(i).value ?? '');
        if (v(10) === 'Cancelled') return;
        row.getCell(10).value = 'Cancelled';
        info = { name: v(3), service: v(5), date: v(7), time: v(8), email: v(12), barber: v(13) || 'our barber', lang: v(14) || 'en' };
      }
    });
    if (!info) return res.status(404).json({ error: 'Booking not found or already cancelled' });
    await wb.xlsx.writeFile(FILE);
    res.json({ ok: true, emailed: false, note: 'Booking cancelled.' });
  } catch (e) { res.status(500).json({ error: 'Could not save. Close bookings.xlsx if it is open in Excel.' }); }
}));

app.listen(PORT, () => console.log(`Ziko Hairstyle running at http://localhost:${PORT}`));