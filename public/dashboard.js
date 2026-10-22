var pw = sessionStorage.getItem('apw') || '';
var MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function $(i) { return document.getElementById(i); }
function api(u) {
  return fetch(u, { headers: { 'x-admin-password': pw } }).then(function (r) {
    return r.json().then(function (j) { if (!r.ok) throw new Error(j.error); return j; });
  });
}
function money(n) { return (Math.round(n * 100) / 100) + ' TND'; }
function two(n) { return n < 10 ? '0' + n : '' + n; }

function bars(el, items) {
  el.innerHTML = '';
  var max = 1;
  items.forEach(function (x) { if (x.v > max) max = x.v; });
  items.forEach(function (x) {
    var c = document.createElement('div');
    c.className = 'col';
    c.title = x.t + ': ' + money(x.v) + ' (' + x.n + ' bookings)';
    if (items.length <= 12) { var e = document.createElement('em'); e.textContent = x.v ? Math.round(x.v) : ''; c.appendChild(e); }
    var b = document.createElement('i');
    b.style.height = Math.max(2, Math.round(x.v / max * 130)) + 'px';
    c.appendChild(b);
    var s = document.createElement('small');
    s.textContent = x.l;
    c.appendChild(s);
    el.appendChild(c);
  });
}
function cardSet(n, label, o) {
  $('l' + n).textContent = label;
  $('v' + n).textContent = money(o.revenue);
  $('c' + n).textContent = o.count + ' bookings';
}
function render(s) {
  $('m').value = s.month; $('y').value = s.year;
  cardSet(1, 'Today (' + s.today + ')', s.totals.today);
  cardSet(2, 'Month ' + s.month, s.totals.month);
  cardSet(3, 'Year ' + s.year, s.totals.year);

  var my = parseInt(s.month.slice(0, 4), 10), mm = parseInt(s.month.slice(5), 10);
  var days = new Date(my, mm, 0).getDate(), di = [];
  for (var d = 1; d <= days; d++) {
    var k = s.month + '-' + two(d), o = s.days[k] || { revenue: 0, count: 0 };
    di.push({ l: d, t: k, v: o.revenue, n: o.count });
  }
  bars($('cd'), di);

  var mi = [];
  for (var m = 1; m <= 12; m++) {
    var k2 = s.year + '-' + two(m), o2 = s.months[k2] || { revenue: 0, count: 0 };
    mi.push({ l: MN[m - 1], t: MN[m - 1] + ' ' + s.year, v: o2.revenue, n: o2.count });
  }
  bars($('cm'), mi);

  var ys = Object.keys(s.years);
  if (ys.indexOf(s.today.slice(0, 4)) < 0) ys.push(s.today.slice(0, 4));
  ys.sort();
  bars($('cy'), ys.map(function (y) { var o3 = s.years[y] || { revenue: 0, count: 0 }; return { l: y, t: y, v: o3.revenue, n: o3.count }; }));

  var tb = $('tb');
  tb.innerHTML = '';
  var h = tb.insertRow();
  ['Barber', 'Bookings (month)', 'Revenue (month)', 'Bookings (year)', 'Revenue (year)'].forEach(function (x) { var th = document.createElement('th'); th.textContent = x; h.appendChild(th); });
  var names = Object.keys(Object.assign({}, s.barbersMonth, s.barbersYear));
  names.forEach(function (n) {
    var a = s.barbersMonth[n] || { revenue: 0, count: 0 }, b = s.barbersYear[n] || { revenue: 0, count: 0 };
    var tr = tb.insertRow();
    [n, a.count, money(a.revenue), b.count, money(b.revenue)].forEach(function (x) { tr.insertCell().textContent = x; });
  });
  if (!names.length) tb.insertRow().insertCell().textContent = 'No bookings yet.';
}
function load() {
  var q = $('m').value && $('y').value ? '?month=' + $('m').value + '&year=' + $('y').value : '';
  api('/api/admin/stats' + q).then(function (s) {
    sessionStorage.setItem('apw', pw);
    $('login').style.display = 'none';
    $('dash').hidden = false;
    render(s);
  }).catch(function (e) {
    sessionStorage.removeItem('apw');
    $('login').style.display = '';
    $('dash').hidden = true;
    alert(e.message);
  });
}
$('ok').onclick = function () { pw = $('pw').value; load(); };
$('m').onchange = function () { if ($('m').value) $('y').value = $('m').value.slice(0, 4); load(); };
$('y').onchange = load;
if (pw) load();
