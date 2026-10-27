const fs = require('fs');
const path = 'C:/ziko/ziko-update/public/script.js';
let s = fs.readFileSync(path, 'utf8');
if (!s.startsWith('import')) {
  s = "import { supabase, supabaseConfigured } from '../src/lib/supabase.ts';\n\n" + s;
}
s = s.replace("async function loadShopConfig() {\n  try {\n    var response = await fetch('/api/config');\n    if (response.ok) populateShopConfig(await response.json());\n  } catch (e) {}\n}", `async function loadShopConfig() {
  if (!supabaseConfigured || !supabase) return;
  try {
    const [servicesRes, overviewRes, blockedRes] = await Promise.all([
      supabase.from('services').select('id,name,duration_minutes,price,description').order('sort_order', { ascending: true }),
      supabase.from('overview').select('barbers,business_hours,shop_settings').eq('id', true).maybeSingle(),
      supabase.from('blocked_dates').select('date').order('date', { ascending: true })
    ]);
    const services = (servicesRes.data || []).map(item => ({ id: item.id, name: item.name, min: item.duration_minutes, price: Number(item.price), description: item.description || '' }));
    const overview = overviewRes.data || {};
    const blockedDates = (blockedRes.data || []).map(item => String(item.date).slice(0, 10));
    const config = {
      services: services.length ? services : [{ id: 'haircut', name: 'Haircut', min: 30, price: 15, description: 'A clean, considered cut shaped around you.' }],
      barbers: overview.barbers && overview.barbers.length ? overview.barbers : ['Wassime', 'Yacine'],
      hours: overview.business_hours || { 0: ['10:00', '22:00'], 1: ['10:00', '22:00'], 2: ['10:00', '22:00'], 3: null, 4: ['10:00', '22:00'], 5: ['10:00', '22:00'], 6: ['10:00', '22:00'] },
      blockedDates: blockedDates,
      settings: { shopName: 'Ziko Hairstyle', location: 'Sfax, Tunisia', phone: '+216 29 090 385', email: 'mohamedjlaiel4000@gmail.com', instagram: 'https://www.instagram.com/ziko_hairstyle/', ...(overview.shop_settings || {}) }
    };
    populateShopConfig(config);
  } catch (e) {}
}`);
fs.writeFileSync(path, s);
console.log('done');
