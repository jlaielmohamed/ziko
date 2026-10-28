// Supabase Client Configuration
const SUPABASE_URL = 'https://lnotxnrqxapcnzofdphd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxub3R4bnJxeGFwY256b2ZkcGhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxNDAxNjcsImV4cCI6MjEwODcxNjE2N30.euGQsYKKm4qbw9N70Fie8c1As11Fzi37Z_-xfh2CUVI';

// In a pure static environment without a bundler, we use the CDN version of Supabase
// We assume the script tag in HTML handles the library or we use the global window object
// However, since we are using type="module", we can import from the CDN directly
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseConfigured = true;

var shopConfig = null;
function escapeText(value) {

  return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
}
function updateBookingSummary() {
  var service = document.getElementById('summaryService');
  if (service && svc.selectedIndex >= 0) service.textContent = svc.options[svc.selectedIndex].text.replace(' — ', ' · ');
  var barberSummary = document.getElementById('summaryBarber');
  if (barberSummary) barberSummary.textContent = br.value || 'Choose a barber';
  var dateSummary = document.getElementById('summaryDate');
  if (dateSummary) dateSummary.textContent = d.value ? new Date(d.value + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Choose a date';
  var timeSummary = document.getElementById('summaryTime');
  if (timeSummary) timeSummary.textContent = sel || 'Choose a time';
  var hasAppointment = Boolean(d.value && sel);
  document.querySelectorAll('.booking-steps .step').forEach(function (step) {
    var n = Number(step.getAttribute('data-step'));
    step.classList.toggle('active', n === (hasAppointment ? 2 : 1));
  });
}
function populateShopConfig(config) {
  shopConfig = config;
  var hoursTable = document.getElementById('hoursTable');
  if (hoursTable && config.hours) {
    var order = [4, 5, 6, 0, 1, 2, 3];
    hoursTable.innerHTML = order.map(function (day) {
      var hours = config.hours[day];
      var label = day === 4 ? 'Thursday' : day === 5 ? 'Friday' : day === 6 ? 'Saturday' : day === 0 ? 'Sunday' : day === 1 ? 'Monday' : day === 2 ? 'Tuesday' : 'Wednesday';
      return '<tr' + (hours ? '' : ' class="closed"') + '><td>' + label + '</td><td>' + (hours ? hours[0] + ' – ' + hours[1] : 'Closed') + '</td></tr>';
    }).join('');
  }
  var location = document.getElementById('publicLocation');
  if (location && config.settings && config.settings.location) location.textContent = config.settings.location;
  var phone = document.querySelector('.publicPhone');
  if (phone && config.settings && config.settings.phone) {
    phone.textContent = config.settings.phone;
    phone.href = 'tel:' + config.settings.phone.replace(/[^+0-9]/g, '');
  }

  if (Array.isArray(config.services) && config.services.length) {
    var selectedService = svc.value;
    svc.innerHTML = '';
    config.services.forEach(function (item) {
      var option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.name + ' — ' + item.price + ' TND';
      svc.appendChild(option);
    });
    if (config.services.some(function (item) { return item.id === selectedService; })) svc.value = selectedService;
    var cards = document.getElementById('serviceCards');
    if (cards) {
      var artNames = ['art-cut', 'art-beard', 'art-combo', 'art-kids'];
      var artSymbols = ['✂', '◌', '✦', '✳'];
      cards.innerHTML = config.services.map(function (item, index) {
        return '<article class="service-card"><div class="service-art ' + artNames[index % artNames.length] + '"><span class="art-label">' + String(index + 1).padStart(2, '0') + ' / ZIKO</span><span class="art-symbol">' + artSymbols[index % artSymbols.length] + '</span></div><div class="service-copy"><div class="service-title"><h3>' + escapeText(item.name) + '</h3><span class="price">' + escapeText(item.price) + ' <small>TND</small></span></div><p>' + escapeText(item.description || 'A considered service, tailored to you.') + '</p><div class="service-meta"><span>' + escapeText(item.min) + ' min</span><a href="#book" data-service="' + escapeText(item.id) + '">Book this <span>↗</span></a></div></div></article>';
      }).join('');
      cards.querySelectorAll('[data-service]').forEach(function (link) {
        link.addEventListener('click', function () {
          svc.value = link.getAttribute('data-service');
          updateBookingSummary();
          loadSlots();
        });
      });
    }
  }
  if (Array.isArray(config.barbers) && config.barbers.length) {
    var selectedBarber = br.value;
    br.innerHTML = '';
    config.barbers.forEach(function (name) {
      var option = document.createElement('option');
      option.value = name; option.textContent = name; br.appendChild(option);
    });
    if (config.barbers.includes(selectedBarber)) br.value = selectedBarber;
  }
  updateBookingSummary();
}
async function loadShopConfig() {
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
}
var d = document.getElementById('d'), svc = document.getElementById('svc'), br = document.getElementById('barber'),
    box = document.getElementById('slots'), msg = document.getElementById('msg'), sel = null;

// Translations: key = English text exactly as written on the page
var L = {
fr: {'Booking confirmed!':'Réservation confirmée !','Thank you for choosing Ziko Hairstyle. We are waiting for you.':'Merci d’avoir choisi Ziko Hairstyle. Nous vous attendons.','Back to home':'Retour à l’accueil','Follow us':'Suivez-nous','A confirmation email was sent.':'Un e-mail de confirmation a été envoyé.','Barber':'Barbier','Email':'E-mail','Please enter a valid email address.':'Veuillez entrer une adresse e-mail valide.','Wednesday':'Mercredi','Thursday – Tuesday':'Jeudi – Mardi','Thu–Tue':'Jeu–Mar','Barber Shop in Sfax':'Salon de coiffure à Sfax','Sharp cuts. Clean style. Book your chair in under a minute.':"Coupes nettes. Style impeccable. Réservez en moins d'une minute.",'Book Now':'Réserver','See Prices':'Voir les tarifs','Mon–Sat':'Lun–Sam','Open days':"Jours d'ouverture",'First slot':'Premier créneau','Haircut from':'Coupe à partir de','Services & Prices':'Services et tarifs','Sample prices, editable by the barber.':'Prix indicatifs, modifiables par le barbier.','Haircut':'Coupe','Beard Trim':'Taille de barbe','Haircut + Beard':'Coupe + barbe',"Kids' Cut":'Coupe enfant','Working Hours':'Horaires','Sample schedule.':'Horaires indicatifs.','Open now':'Ouvert','Closed now':'Fermé','Monday – Friday':'Lundi – Vendredi','Saturday':'Samedi','Sunday':'Dimanche','Closed':'Fermé','Find Us':'Nous trouver','Sfax, Tunisia':'Sfax, Tunisie','Get Directions':'Itinéraire','Book Your Visit':'Réservez votre visite','Taken times are disabled automatically.':'Les créneaux pris sont désactivés automatiquement.','Service':'Service','Time':'Heure','Name':'Nom','Phone':'Téléphone','Confirm Booking':'Confirmer la réservation','Your name':'Votre nom','Haircut – 15 TND':'Coupe – 15 TND','Beard Trim – 8 TND':'Taille de barbe – 8 TND','Haircut + Beard – 20 TND':'Coupe + barbe – 20 TND',"Kids' Cut – 10 TND":'Coupe enfant – 10 TND','Loading...':'Chargement...','Please choose a free time slot.':'Veuillez choisir un créneau libre.','Closed or no times available on this day.':"Fermé ou aucun créneau disponible ce jour-là.",'Could not load times. Is the server running?':'Impossible de charger les horaires.','Server not reachable.':'Serveur inaccessible.','Booking failed.':'Échec de la réservation.','Sorry, this time is already booked. Please pick another one.':'Désolé, ce créneau est déjà réservé. Choisissez-en un autre.','Please enter your name.':'Veuillez entrer votre nom.','Please enter a valid phone number.':'Veuillez entrer un numéro valide.','Booked for':'Réservé pour','See you at Ziko Hairstyle!':'À bientôt chez Ziko Hairstyle !'},
ar: {'Booking confirmed!':'تم تأكيد الحجز!','Thank you for choosing Ziko Hairstyle. We are waiting for you.':'شكراً لاختياركم Ziko Hairstyle. ننتظركم.','Back to home':'العودة إلى الرئيسية','Follow us':'تابعنا','A confirmation email was sent.':'تم إرسال رسالة تأكيد إلى بريدك الإلكتروني.','Barber':'الحلاق','Email':'البريد الإلكتروني','Please enter a valid email address.':'يرجى إدخال بريد إلكتروني صحيح.','Wednesday':'الأربعاء','Thursday – Tuesday':'من الخميس إلى الثلاثاء','Thu–Tue':'الخميس–الثلاثاء','Barber Shop in Sfax':'صالون حلاقة في صفاقس','Sharp cuts. Clean style. Book your chair in under a minute.':'قصّات أنيقة ومظهر مرتب. احجز كرسيك في أقل من دقيقة.','Book Now':'احجز الآن','See Prices':'عرض الأسعار','Mon–Sat':'الإثنين–السبت','Open days':'أيام العمل','First slot':'أول موعد','Haircut from':'القصّة ابتداءً من','Services & Prices':'الخدمات والأسعار','Sample prices, editable by the barber.':'أسعار تجريبية يمكن للحلاق تعديلها.','Haircut':'قصّ الشعر','Beard Trim':'تشذيب اللحية','Haircut + Beard':'قصّ الشعر + اللحية',"Kids' Cut":'قصّة أطفال','Working Hours':'ساعات العمل','Sample schedule.':'جدول تجريبي.','Open now':'مفتوح الآن','Closed now':'مغلق الآن','Monday – Friday':'من الإثنين إلى الجمعة','Saturday':'السبت','Sunday':'الأحد','Closed':'مغلق','Find Us':'موقعنا','Sfax, Tunisia':'صفاقس، تونس','Get Directions':'الاتجاهات','Book Your Visit':'احجز زيارتك','Taken times are disabled automatically.':'المواعيد المحجوزة تُعطَّل تلقائياً.','Service':'الخدمة','Date':'التاريخ','Time':'الوقت','Name':'الاسم','Phone':'الهاتف','Confirm Booking':'تأكيد الحجز','Your name':'اسمك','Haircut – 15 TND':'قصّ الشعر – 15 د.ت','Beard Trim – 8 TND':'تشذيب اللحية – 8 د.ت','Haircut + Beard – 20 TND':'قصّ الشعر + اللحية – 20 د.ت',"Kids' Cut – 10 TND":'قصّة أطفال – 10 د.ت','Loading...':'جارٍ التحميل...','Please choose a free time slot.':'يرجى اختيار موعد متاح.','Closed or no times available on this day.':'مغلق أو لا توجد مواعيد متاحة في هذا اليوم.','Could not load times. Is the server running?':'تعذّر تحميل المواعيد.','Server not reachable.':'تعذّر الاتصال بالخادم.','Booking failed.':'فشل الحجز.','Sorry, this time is already booked. Please pick another one.':'عذراً، هذا الموعد محجوز. يرجى اختيار موعد آخر.','Please enter your name.':'يرجى إدخال اسمك.','Please enter a valid phone number.':'يرجى إدخال رقم هاتف صحيح.','Booked for':'تم الحجز يوم','See you at Ziko Hairstyle!':'نراك في Ziko Hairstyle!'}
};
var lang = 'en';
try { lang = localStorage.getItem('lang') || 'en'; } catch (e) {}
function t(s) { return (L[lang] && L[lang][s]) || s; }

function openNow() {
  var n = new Date(Date.now() + 3600000), day = n.getUTCDay(), m = n.getUTCHours() * 60 + n.getUTCMinutes();
  var r = shopConfig ? shopConfig.hours[day] : (day === 3 ? null : ['10:00', '22:00']);
  if (r) r = [Number(r[0].slice(0,2))*60+Number(r[0].slice(3)), Number(r[1].slice(0,2))*60+Number(r[1].slice(3))];
  return !!r && m >= r[0] && m < r[1];
}
function apply() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  var op = openNow();
  ['ob', 'hs'].forEach(function (id) { var e = document.getElementById(id); e.firstChild._o = op ? 'Open now' : 'Closed now'; e.firstChild._f = 1; });
  document.getElementById('hd').className = 'live-dot ' + (op ? 'on' : 'off');
  var hd2 = document.getElementById('hd2'); if (hd2) hd2.className = 'live-dot ' + (op ? 'on' : 'off');
  var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n;
  while ((n = w.nextNode())) {
    if (n._o === undefined) n._o = n.nodeValue.trim();
    if (!n._o) continue;
    var tr = t(n._o);
    if (tr !== n._o || n._c || n._f) { n.nodeValue = tr; n._c = tr !== n._o; }
  }
  [].forEach.call(document.querySelectorAll('[placeholder]'), function (e) {
    if (!e._p) e._p = e.placeholder; e.placeholder = t(e._p);
  });
}
[].forEach.call(document.querySelectorAll('.lang button'), function (b) {
  b.onclick = function () {
    lang = b.getAttribute('data-l');
    try { localStorage.setItem('lang', lang); } catch (e) {}
    msg.style.display = 'none'; apply(); loadSlots();
  };
});

function show(text, ok) { msg.style.display = 'block'; msg.className = ok ? 'ok' : 'err'; msg.textContent = text; }

async function loadSlots() {
  var toMin = function(x){ var p=String(x).split(':').map(Number); return p[0]*60+p[1]; };
  var toStr = function(m){ return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); };
  var tunisNow = function(){ return new Date(Date.now() + 3600000); };
  var validDate = function(d){ if(!/^\d{4}-\d{2}-\d{2}$/.test(d||'')) return false; var date=new Date(d+'T00:00:00Z'); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10)===d; };
  var STEP = 30;
  sel = null; updateBookingSummary(); box.textContent = t('Loading...');
  try {
    if (!shopConfig) { box.textContent = t('Could not load times. Please try again later.'); return; }
    var date = d.value, serviceId = svc.value, barber = br.value;
    if (!validDate(date)) { box.textContent = t('Closed or no times available on this day.'); return; }
    var service = shopConfig.services.find(function(item){ return item.id === serviceId; });
    var hours = shopConfig.hours[new Date(date + 'T00:00:00Z').getUTCDay()];
    if (!service || !hours || !shopConfig.barbers.includes(barber) || (shopConfig.blockedDates||[]).includes(date)) { box.textContent = t('Closed or no times available on this day.'); return; }
    var now = tunisNow(), today = now.toISOString().slice(0,10), nowMin = now.getUTCHours()*60 + now.getUTCMinutes();
    if (date < today) { box.textContent = t('Closed or no times available on this day.'); return; }
    if (!supabaseConfigured || !supabase) { box.textContent = t('Server not reachable.'); return; }
    var apptRes = await supabase.from('appointments').select('start_time,end_time,status,barber').eq('appointment_date', date);
    var appointments = apptRes.data || [];
    var busy = appointments.filter(function(a){ return a.status !== 'Cancelled' && (!a.barber || a.barber === barber); }).map(function(a){ return [toMin(a.start_time), toMin(a.end_time)]; });
    var slots = [];
    for (var start = toMin(hours[0]); start + Number(service.min) <= toMin(hours[1]); start += STEP) {
      var free = !(date === today && start <= nowMin) && !busy.some(function(b){ return start < b[1] && start + Number(service.min) > b[0]; });
      slots.push({ time: toStr(start), free: free });
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
  } catch (e) { box.textContent = t('Could not load times. Please try again later.'); }
}

d.min = new Date(Date.now() + 3600000).toISOString().slice(0, 10);
d.value = d.min;
d.onchange = function () { updateBookingSummary(); loadSlots(); };
svc.onchange = br.onchange = function () { updateBookingSummary(); loadSlots(); };

document.getElementById('go').onclick = async function () {
  if (!sel) return show(t('Please choose a free time slot.'), false);
  if (!shopConfig) return show(t('Server not reachable.'), false);
  const svcEl = svc, brEl = br, dEl = d;
  const service = shopConfig.services.find(item => item.id === svcEl.value);
  if (!service || !shopConfig.barbers.includes(brEl.value)) return show(t('Booking failed.'), false);
  const name = document.getElementById('nm').value.trim(), phone = document.getElementById('ph').value.trim(), email = document.getElementById('em').value.trim();
  if (name.length < 2 || name.length > 60) return show(t('Please enter your name.'), false);
  if (!/^\+?[0-9 ()-]{8,20}$/.test(phone)) return show(t('Please enter a valid phone number.'), false);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100) return show(t('Please enter a valid email address.'), false);
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
};

function showDone(b, emailed) {
  document.getElementById('ds').textContent = svc.options[svc.selectedIndex].text;
  document.getElementById('db').textContent = b.barber;
  document.getElementById('dd').textContent = b.date;
  document.getElementById('dt').textContent = b.time;
  document.querySelectorAll('.booking-steps .step').forEach(function (step) { step.classList.toggle('active', Number(step.dataset.step) === 3); });
  document.getElementById('de').hidden = !emailed;
  document.getElementById('done').hidden = false;
  document.getElementById('done').scrollTop = 0;
  document.body.style.overflow = 'hidden';
}
document.getElementById('back').onclick = function () {
  document.getElementById('done').hidden = true;
  document.body.style.overflow = '';
  ['nm', 'ph', 'em'].forEach(function (i) { document.getElementById(i).value = ''; });
  msg.style.display = 'none';
  window.scrollTo(0, 0);
};
setInterval(apply, 60000);

apply();
updateBookingSummary();
loadShopConfig().then(loadSlots);
