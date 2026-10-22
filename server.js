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

app.listen(PORT, () => console.log(`Ziko Hairstyle running at http://localhost:${PORT}`));extendedProperties.private && e.extendedProperties.private.barber) || e.extendedProperties.private.barber === barber)).map(e => {
      const m = t => { const x = new Date(t); return (x.getUTCHours() * 60 + x.getUTCMinutes() + 60) % 1440; };
      return [m(e.start.dateTime), m(e.end.dateTime)];
    });
  } catch (e) { console.error('Calendar read failed:', e.message); return []; }
}

// ---------- Availability ----------
async function slotList(date, svcId, barber, ws) {
  const svc = SERVICES[svcId];
  const hrs = HOURS[new Date(date + 'T00:00:00Z').getUTCDay()];
  if (!svc || !hrs || !BARBERS.includes(barber)) return [];
  const t = tunisNow(), today = t.toISOString().slice(0, 10), nowMin = t.getUTCHours() * 60 + t.getUTCMinutes();
  if (date < today) return [];
  const busy = excelBusy(ws, date, barber).concat(await calendarBusy(date, barber));
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
    let eventId = '';
    const c = getCal();
    if (c) {
      try {
        const r = await c.events.insert({ calendarId: CAL_ID, requestBody: {
          summary: `${svc.name} - ${name} (${barber})`, extendedProperties: { private: { barber } }, description: `Barber: ${barber}\nPhone: ${phone}\nEmail: ${email}\nPrice: ${svc.price} TND`,
          start: { dateTime: `${date}T${time}:00`, timeZone: TZ }, end: { dateTime: `${date}T${end}:00`, timeZone: TZ } } });
        eventId = r.data.id;
      } catch (e) { console.error('Calendar insert failed:', e.message); }
    }
    ws.addRow([Date.now().toString(36), tunisNow().toISOString().slice(0, 16).replace('T', ' '),
               name, phone, svc.name, svc.price, date, time, end, 'Confirmed', eventId, email, barber, ['fr', 'ar'].includes(lang) ? lang : 'en']);
    try { await wb.xlsx.writeFile(FILE); }
    catch (e) {
      if (eventId) await c.events.delete({ calendarId: CAL_ID, eventId }).catch(() => {});
      return res.status(500).json({ error: 'Could not save. Close bookings.xlsx if it is open in Excel.' });
    }
    res.json({ ok: true, emailed: false });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
}));

// ---------- Booking confirmation email ----------
const CONFIRM = {
  en: { s: 'Your booking at Ziko Hairstyle is confirmed', b: (n, d, t, w, sv, p) => `Hello ${n},\n\nYour booking is confirmed:\n- Service: ${sv} (${p} TND)\n- Barber: ${w}\n- Date: ${d} at ${t}\n\nZiko Hairstyle, Sfax\nMap: https://www.google.com/maps?q=34.790917,10.780528\nPhone: +216 29 090 385\n\nTo change or cancel your booking, please call us.` },
  fr: { s: 'Votre réservation chez Ziko Hairstyle est confirmée', b: (n, d, t, w, sv, p) => `Bonjour ${n},\n\nVotre réservation est confirmée :\n- Service : ${sv} (${p} TND)\n- Barbier : ${w}\n- Date : ${d} à ${t}\n\nZiko Hairstyle, Sfax\nPlan : https://www.google.com/maps?q=34.790917,10.780528\nTéléphone : +216 29 090 385\n\nPour modifier ou annuler votre réservation, appelez-nous.` },
  ar: { s: 'تم تأكيد حجزك في Ziko Hairstyle', b: (n, d, t, w, sv, p) => `مرحباً ${n}،\n\nتم تأكيد حجزك:\n- الخدمة: ${sv} (${p} د.ت)\n- الحلاق: ${w}\n- التاريخ: ${d} على الساعة ${t}\n\nZiko Hairstyle، صفاقس\nالموقع: https://www.google.com/maps?q=34.790917,10.780528\nالهاتف: +216 29 090 385\n\nلتغيير الحجز أو إلغائه يرجى الاتصال بنا.` },
};
async function sendConfirm(to, lang, n, d, t, w, sv, p) {
  const m = getMailer();
  if (!m) {
    console.error('Email failed: Mailer not initialized. Check SMTP_USER and SMTP_PASS in environment variables.');
    return false;
  }
  try {
    const T = CONFIRM[lang] || CONFIRM.en;
    await m.sendMail({ from: `"Ziko Hairstyle" <${process.env.SMTP_USER}>`, to, subject: T.s, text: T.b(n, d, t, w, sv, p) });
    return true;
  } catch (e) {
    console.error('Confirmation email failed:', e.message);
    console.error('Full Error:', e);
    return false;
  }
}

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

let mailer = null;
function getMailer() {
  if (mailer !== null) return mailer;
  mailer = false;
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    mailer = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  } else console.warn('SMTP not set in .env: cancellation emails will NOT be sent.');
  return mailer;
}
const MAIL = {
  en: { s: 'Your booking at Ziko Hairstyle was cancelled', b: (n, d, t, w, sv) => `Hello ${n},\n\nWe are sorry: your ${sv} booking with ${w} on ${d} at ${t} has been cancelled.\nYou can book another time on our website or call us on +216 29 090 385.\n\nZiko Hairstyle` },
  fr: { s: 'Votre réservation chez Ziko Hairstyle est annulée', b: (n, d, t, w, sv) => `Bonjour ${n},\n\nNous sommes désolés : votre réservation (${sv}) avec ${w} le ${d} à ${t} a été annulée.\nVous pouvez réserver un autre créneau sur notre site ou nous appeler au +216 29 090 385.\n\nZiko Hairstyle` },
  ar: { s: 'تم إلغاء حجزك في Ziko Hairstyle', b: (n, d, t, w, sv) => `مرحباً ${n}،\n\nنعتذر، تم إلغاء حجزك (${sv}) مع ${w} يوم ${d} على الساعة ${t}.\nيمكنك حجز موعد آخر عبر موقعنا أو الاتصال بنا على +216 29 090 385.\n\nZiko Hairstyle` },
};
app.post('/api/admin/cancel', admin, (req, res) => lock(async () => {
  try {
    const { wb, ws } = await loadBook(); let info = null;
    ws.eachRow((row, n) => {
      if (n > 1 && String(row.getCell(1).value) === req.body.id) {
        const v = i => String(row.getCell(i).value ?? '');
        if (v(10) === 'Cancelled') return;
        row.getCell(10).value = 'Cancelled';
        info = { ev: v(11), name: v(3), service: v(5), date: v(7), time: v(8), email: v(12), barber: v(13) || 'our barber', lang: v(14) || 'en' };
      }
    });
    if (!info) return res.status(404).json({ error: 'Booking not found or already cancelled' });
    await wb.xlsx.writeFile(FILE);
    const c = getCal();
    if (c && info.ev) await c.events.delete({ calendarId: CAL_ID, eventId: info.ev }).catch(e => console.error(e.message));
    let note = 'Booking cancelled.', emailed = false;
    const m = getMailer();
    if (!info.email) note += ' No email saved for this customer.';
    else if (!m) note += ' Email NOT sent: SMTP is not set up in .env.';
    else {
      try {
        const T = MAIL[info.lang] || MAIL.en;
        await m.sendMail({ from: `"Ziko Hairstyle" <${process.env.SMTP_USER}>`, to: info.email, subject: T.s,
          text: T.b(info.name, info.date, info.time, info.barber, info.service) });
        emailed = true; note = 'Booking cancelled. Email sent to ' + info.email;
      } catch (e) { console.error('Email failed:', e.message); note += ' Email could not be sent: ' + e.message; }
    }
    res.json({ ok: true, emailed, note });
  } catch (e) { res.status(500).json({ error: 'Could not save. Close bookings.xlsx if it is open in Excel.' }); }
}));

app.listen(PORT, () => console.log(`Ziko Hairstyle running at http://localhost:${PORT}`));
