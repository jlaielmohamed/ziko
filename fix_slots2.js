const fs = require('fs');
const path = 'C:/ziko/ziko-update/public/script.js';
let s = fs.readFileSync(path, 'utf8');
// remove everything from old loadSlots to just before d.min
const start = s.indexOf('async function loadSlots');
const endMarker = "d.min = new Date(Date.now() + 3600000)";
const end = s.indexOf(endMarker);
if (start >= 0 && end >= 0) {
  const toMin = x => { const [h,m]=String(x).split(':').map(Number); return h*60+m; };
  const toStr = m => String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
  const tunisNow = () => new Date(Date.now() + 3600000);
  const validDate = d => { if(!/^\d{4}-\d{2}-\d{2}$/.test(d||'')) return false; const date=new Date(d+'T00:00:00Z'); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10)===d; };
  const STEP = 30;
  const newLoadSlots = `async function loadSlots() {\n  sel = null; updateBookingSummary(); box.textContent = t('Loading...');\n  try {\n    if (!shopConfig) { box.textContent = t('Could not load times. Is the server running?'); return; }\n    const date = d.value, serviceId = svc.value, barber = br.value;\n    if (!validDate(date)) { box.textContent = t('Closed or no times available on this day.'); return; }\n    const service = shopConfig.services.find(item => item.id === serviceId);\n    const hours = shopConfig.hours[new Date(date + 'T00:00:00Z').getUTCDay()];\n    if (!service || !hours || !shopConfig.barbers.includes(barber) || (shopConfig.blockedDates||[]).includes(date)) { box.textContent = t('Closed or no times available on this day.'); return; }\n    const now = tunisNow(), today = now.toISOString().slice(0,10), nowMin = now.getUTCHours()*60 + now.getUTCMinutes();\n    if (date < today) { box.textContent = t('Closed or no times available on this day.'); return; }\n    if (!supabaseConfigured || !supabase) { box.textContent = t('Server not reachable.'); return; }\n    const { data: appointments } = await supabase.from('appointments').select('start_time,end_time,status,barber').eq('appointment_date', date);\n    const busy = (appointments||[]).filter(a => a.status !== 'Cancelled' && (!a.barber || a.barber === barber)).map(a => [toMin(a.start_time), toMin(a.end_time)]);\n    const slots = [];\n    for (let start = toMin(hours[0]); start + Number(service.min) <= toMin(hours[1]); start += STEP) {\n      const free = !(date === today && start <= nowMin) && !busy.some(([a,b]) => start < b && start + Number(service.min) > a);\n      slots.push({ time: toStr(start), free });\n    }\n    box.innerHTML = '';\n    if (!slots.length) { box.textContent = t('Closed or no times available on this day.'); return; }\n    slots.forEach(function (s) {\n      var b = document.createElement('button');\n      b.className = 'slot'; b.type = 'button'; b.textContent = s.time; b.disabled = !s.free;\n      b.onclick = function () {\n        sel = s.time;\n        [].forEach.call(box.children, function (c) { c.classList.remove('sel'); });\n        b.classList.add('sel'); updateBookingSummary();\n      };\n      box.appendChild(b);\n    });\n  } catch (e) { box.textContent = t('Could not load times. Is the server running?'); }\n}\n\n`;
  s = s.substring(0, start) + newLoadSlots + s.substring(end);
  fs.writeFileSync(path, s);
  console.log('done');
} else {
  console.log('bad');
}
