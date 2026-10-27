const fs = require('fs');
const path = 'C:/ziko/ziko-update/public/dashboard.js';
let s = fs.readFileSync(path, 'utf8');

s = s.replace(`async function saveSettings(kind) {
  if (kind === 'services') config.services = readServices();
  if (kind === 'hours') config.hours = readHours();
  if (kind === 'settings') {
    config.settings.shopName = $('shopName').value.trim();
    config.settings.location = $('shopLocation').value.trim();
    config.settings.phone = $('shopPhone').value.trim();
    config.settings.email = $('shopEmail').value.trim();
    config.barbers = $('barberNames').value.split('\\n').map(name => name.trim()).filter(Boolean);
  }
  try {
    const result = await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(config) });
    config = result.config;
    renderServices(); renderHours(); renderBlocked(); renderSettings();
    message('Shop settings saved.');
  } catch (error) { message(error.message, true); }
}`, `async function saveSettings(kind) {
  if (kind === 'services') config.services = readServices();
  if (kind === 'hours') config.hours = readHours();
  if (kind === 'settings') {
    config.settings.shopName = $('shopName').value.trim();
    config.settings.location = $('shopLocation').value.trim();
    config.settings.phone = $('shopPhone').value.trim();
    config.settings.email = $('shopEmail').value.trim();
    config.barbers = $('barberNames').value.split('\\n').map(name => name.trim()).filter(Boolean);
  }
  try {
    if (!supabase) throw new Error('Supabase not configured');
    await supabase.rpc('save_shop_config', {
      p_services: config.services.map((item, sort_order) => ({
        id: item.id, name: item.name, duration_minutes: item.min, price: item.price,
        description: item.description || '', sort_order
      })),
      p_barbers: config.barbers,
      p_business_hours: config.hours,
      p_shop_settings: config.settings,
      p_blocked_dates: config.blockedDates
    });
    renderServices(); renderHours(); renderBlocked(); renderSettings();
    message('Shop settings saved.');
  } catch (error) { message(error.message, true); }
}`);

s = s.replace(`async function initialize() {
  try {
    await verifySession();
    const [stats, bookingData, settings] = await Promise.all([api('/api/admin/stats'), api('/api/admin/bookings'), api('/api/admin/settings')]);
    appointments = bookingData.rows;
    config = settings;
    renderStats(stats); renderAppointments(); renderServices(); renderHours(); renderBlocked(); renderSettings();
  } catch (error) {
    await fetch('/api/admin/session', { method: 'DELETE', credentials: 'same-origin' });
    if (supabase) await supabase.auth.signOut();
    message(error.message, true);
    setTimeout(() => window.location.replace('/admin.html'), 800);
  }
}`, `async function computeStats(appts) {
  const now = new Date(Date.now() + 3600000);
  const today = now.toISOString().slice(0,10);
  const month = today.slice(0,7);
  const year = today.slice(0,4);
  const blank = () => ({ revenue: 0, count: 0 });
  const add = (obj, key, price) => { obj[key] = obj[key] || blank(); obj[key].revenue += price; obj[key].count++; };
  const out = { today, month, year, days: {}, months: {}, years: {}, barbersMonth: {}, barbersYear: {}, totals: { today: blank(), month: blank(), year: blank() } };
  (appts||[]).forEach(a => {
    if (a.status === 'Cancelled') return;
    const date = a.appointment_date;
    const price = Number(a.price) || 0;
    const barber = a.barber || 'Not set';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    add(out.years, date.slice(0,4), price);
    if (date === today) add(out.totals, 'today', price);
    if (date.slice(0,4) === year) { add(out.months, date.slice(0,7), price); add(out.barbersYear, barber, price); add(out.totals, 'year', price); }
    if (date.slice(0,7) === month) { add(out.days, date, price); add(out.barbersMonth, barber, price); add(out.totals, 'month', price); }
  });
  return out;
}
async function initialize() {
  try {
    await verifySession();
    const [apptsRes, servicesRes, overviewRes, blockedRes] = await Promise.all([
      supabase.from('appointments').select('*').order('created_iso', { ascending: false }),
      supabase.from('services').select('*').order('sort_order', { ascending: true }),
      supabase.from('overview').select('*').eq('id', true).maybeSingle(),
      supabase.from('blocked_dates').select('date').order('date', { ascending: true })
    ]);
    appointments = apptsRes.data || [];
    const services = (servicesRes.data || []).map(item => ({ id: item.id, name: item.name, min: item.duration_minutes, price: Number(item.price), description: item.description || '' }));
    const overview = overviewRes.data || {};
    const blockedDates = (blockedRes.data || []).map(item => String(item.date).slice(0,10));
    config = {
      services: services.length ? services : [{ id: 'haircut', name: 'Haircut', min: 30, price: 15, description: '' }],
      barbers: overview.barbers && overview.barbers.length ? overview.barbers : ['Wassime', 'Yacine'],
      hours: overview.business_hours || { 0: ['10:00','22:00'], 1: ['10:00','22:00'], 2: ['10:00','22:00'], 3: null, 4: ['10:00','22:00'], 5: ['10:00','22:00'], 6: ['10:00','22:00'] },
      blockedDates,
      settings: { shopName: 'Ziko Hairstyle', location: 'Sfax, Tunisia', phone: '+216 29 090 385', email: 'mohamedjlaiel4000@gmail.com', instagram: 'https://www.instagram.com/ziko_hairstyle/', ...(overview.shop_settings || {}) }
    };
    const stats = await computeStats(appointments);
    renderStats(stats); renderAppointments(); renderServices(); renderHours(); renderBlocked(); renderSettings();
  } catch (error) {
    if (supabase) await supabase.auth.signOut();
    message(error.message, true);
    setTimeout(() => window.location.replace('/admin.html'), 800);
  }
}`);

fs.writeFileSync(path, s);
console.log('done5');
