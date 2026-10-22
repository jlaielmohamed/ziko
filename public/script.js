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
  var r = day === 3 ? null : [600, 1320];
  return !!r && m >= r[0] && m < r[1];
}
function apply() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  var op = openNow();
  ['ob', 'hs'].forEach(function (id) { var e = document.getElementById(id); e.firstChild._o = op ? 'Open now' : 'Closed now'; e.firstChild._f = 1; });
  document.getElementById('hd').className = 'dot ' + (op ? 'on' : 'off');
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
  sel = null; box.textContent = t('Loading...');
  try {
    var j = await (await fetch('/api/slots?date=' + d.value + '&service=' + svc.value + '&barber=' + br.value)).json();
    box.innerHTML = '';
    if (!j.slots.length) { box.textContent = t('Closed or no times available on this day.'); return; }
    j.slots.forEach(function (s) {
      var b = document.createElement('button');
      b.className = 'slot'; b.type = 'button'; b.textContent = s.time; b.disabled = !s.free;
      b.onclick = function () {
        sel = s.time;
        [].forEach.call(box.children, function (c) { c.classList.remove('sel'); });
        b.classList.add('sel');
      };
      box.appendChild(b);
    });
  } catch (e) { box.textContent = t('Could not load times. Is the server running?'); }
}

d.min = new Date().toISOString().slice(0, 10);
d.value = d.min;
d.onchange = svc.onchange = br.onchange = loadSlots;

document.getElementById('go').onclick = async function () {
  if (!sel) return show(t('Please choose a free time slot.'), false);
  var body = { service: svc.value, barber: br.value, lang: lang, email: document.getElementById('em').value.trim(), date: d.value, time: sel,
    name: document.getElementById('nm').value.trim(), phone: document.getElementById('ph').value.trim() };
  try {
    var r = await fetch('/api/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    var j = await r.json();
    if (!r.ok) { show(t(j.error || 'Booking failed.'), false); loadSlots(); return; }
    showDone(body, j.emailed);
    loadSlots();
  } catch (e) { show(t('Server not reachable.'), false); }
};

function showDone(b, emailed) {
  document.getElementById('ds').textContent = svc.options[svc.selectedIndex].text;
  document.getElementById('db').textContent = b.barber;
  document.getElementById('dd').textContent = b.date;
  document.getElementById('dt').textContent = b.time;
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
loadSlots();
