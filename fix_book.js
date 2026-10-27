const fs = require('fs');
const path = 'C:/ziko/ziko-update/public/script.js';
let s = fs.readFileSync(path, 'utf8');
const toMin = x => { const [h,m]=String(x).split(':').map(Number); return h*60+m; };
const toStr = m => String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const tunisNow = () => new Date(Date.now() + 3600000);
const newGo = `document.getElementById('go').onclick = async function () {
  if (!sel) return show(t('Please choose a free time slot.'), false);
  if (!shopConfig) return show(t('Server not reachable.'), false);
  const svcEl = svc, brEl = br, dEl = d;
  const service = shopConfig.services.find(item => item.id === svcEl.value);
  if (!service || !shopConfig.barbers.includes(brEl.value)) return show(t('Booking failed.'), false);
  const name = document.getElementById('nm').value.trim(), phone = document.getElementById('ph').value.trim(), email = document.getElementById('em').value.trim();
  if (name.length < 2 || name.length > 60) return show(t('Please enter your name.'), false);
  if (!/^\\+?[0-9 ()-]{8,20}$/.test(phone)) return show(t('Please enter a valid phone number.'), false);
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || email.length > 100) return show(t('Please enter a valid email address.'), false);
  if (!supabaseConfigured || !supabase) return show(t('Server not reachable.'), false);
  try {
    const date = dEl.value, time = sel;
    const { data: appointments } = await supabase.from('appointments').select('start_time,end_time,status,barber').eq('appointment_date', date);
    const hours = shopConfig.hours[new Date(date + 'T00:00:00Z').getUTCDay()];
    if (!hours || (shopConfig.blockedDates||[]).includes(date)) { show(t('Closed or no times available on this day.'), false); loadSlots(); return; }
    const startMin = toMin(time), endMin = startMin + Number(service.min);
    const busy = (appointments||[]).filter(a => a.status !== 'Cancelled' && (!a.barber || a.barber === brEl.value)).map(a => [toMin(a.start_time), toMin(a.end_time)]);
    const clash = busy.some(([a,b]) => startMin < b && endMin > a);
    if (clash) { show(t('Sorry, this time is already booked. Please pick another one.'), false); loadSlots(); return; }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
    const now = tunisNow();
    const row = { id, created_at: now.toISOString().slice(0,16).replace('T',' '), created_iso: now.toISOString(), name, phone, service_name: service.name, service_id: service.id, price: service.price, appointment_date: date, start_time: time, end_time: toStr(endMin), status: 'Requested', calendar_event_id: '', email, barber: brEl.value, lang: lang };
    const { error } = await supabase.from('appointments').insert(row);
    if (error) { show(t('Booking failed.'), false); loadSlots(); return; }
    showDone({ service: svcEl.value, barber: brEl.value, lang: lang, email: email, date: date, time: sel, name: name, phone: phone }, false);
    loadSlots();
  } catch (e) { show(t('Server not reachable.'), false); }
};`;
s = s.replace(/document\.getElementById\('go'\)\.onclick = async function \(\) \{[\s\S]*?\n\};\n\nfunction showDone/d, newGo + '\n\nfunction showDone');
fs.writeFileSync(path, s);
console.log('done3');
