const fs = require('fs');
const path = 'C:/ziko/ziko-update/public/script.js';
let s = fs.readFileSync(path, 'utf8');
const toMin = x => { const [h,m]=String(x).split(':').map(Number); return h*60+m; };
const toStr = m => String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const tunisNow = () => new Date(Date.now() + 3600000);
const validDate = d => { if(!/^\d{4}-\d{2}-\d{2}$/.test(d||'')) return false; const date=new Date(d+'T00:00:00Z'); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10)===d; };
const STEP = 30;
const newLoadSlots = `async function loadSlots() {
  sel = null; updateBookingSummary(); box.textContent = t('Loading...');
  try {
    if (!shopConfig) { box.textContent = t('Could not load times. Is the server running?'); return; }
    const date = d.value, serviceId = svc.value, barber = br.value;
    if (!validDate(date)) { box.textContent = t('Closed or no times available on this day.'); return; }
    const service = shopConfig.services.find(item => item.id === serviceId);
    const hours = shopConfig.hours[new Date(date + 'T00:00:00Z').getUTCDay()];
    if (!service || !hours || !shopConfig.barbers.includes(barber) || (shopConfig.blockedDates||[]).includes(date)) { box.textContent = t('Closed or no times available on this day.'); return; }
    const now = tunisNow(), today = now.toISOString().slice(0,10), nowMin = now.getUTCHours()*60 + now.getUTCMinutes();
    if (date < today) { box.textContent = t('Closed or no times available on this day.'); return; }
    if (!supabaseConfigured || !supabase) { box.textContent = t('Server not reachable.'); return; }
    const { data: appointments } = await supabase.from('appointments').select('start_time,end_time,status,barber').eq('appointment_date', date);
    const busy = (appointments||[]).filter(a => a.status !== 'Cancelled' && (!a.barber || a.barber === barber)).map(a => [toMin(a.start_time), toMin(a.end_time)]);
    const slots = [];
    for (let start = toMin(hours[0]); start + Number(service.min) <= toMin(hours[1]); start += STEP) {
      const free = !(date === today && start <= nowMin) && !busy.some(([a,b]) => start < b && start + Number(service.min) > a);
      slots.push({ time: toStr(start), free });
    }
    box.innerHTML = '';
    if (!slots.length) { box.textContent = t('Closed or no times available on this day.'); return; }
    slots.forEach(function (s) {
      var b = document.createElement('button');
      b.className = 'slot'; b.type = 'button'; b.textContent = s.time; b.disabled = !s.free;
      b.onclick = function () {
        sel = s.time;
        [].forEach.call(box.children, function (c) { c.classList.remove('sel'); });
        b.classList.add('sel'); updateBookingSummary();
      };
      box.appendChild(b);
    });
  } catch (e) { box.textContent = t('Could not load times. Is the server running?'); }
}`;
s = s.replace(/async function loadSlots\(\) \{[\s\S]*?\n\}\n\n/d, newLoadSlots + '\n\n');
fs.writeFileSync(path, s);
console.log('done2');
