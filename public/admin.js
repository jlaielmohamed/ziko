var pw = '', list = document.getElementById('list');
function api(u, o) {
  o = o || {};
  o.headers = { 'Content-Type': 'application/json', 'x-admin-password': pw };
  return fetch(u, o).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error); return j; }); });
}
function load() {
  api('/api/admin/bookings').then(function (j) {
    document.getElementById('login').style.display = 'none'; sessionStorage.setItem('apw', pw);
    var t = document.createElement('table');
    var h = t.insertRow();
    ['Date', 'Start', 'End', 'Barber', 'Name', 'Phone', 'Email', 'Service', 'Status', ''].forEach(function (x) { var c = document.createElement('th'); c.textContent = x; h.appendChild(c); });
    j.rows.forEach(function (r) {
      var tr = t.insertRow();
      [r[6], r[7], r[8], r[11], r[2], r[3], r[10], r[4], r[9]].forEach(function (x) { tr.insertCell().textContent = x; });
      var td = tr.insertCell();
      if (r[9] !== 'Cancelled') {
        var b = document.createElement('button'); b.className = 'xbtn'; b.textContent = 'Cancel';
        b.onclick = function () {
          if (!confirm('Cancel this booking?')) return;
          api('/api/admin/cancel', { method: 'POST', body: JSON.stringify({ id: r[0] }) }).then(function (j) { alert(j.note); load(); }).catch(function (e) { alert(e.message); });
        };
        td.appendChild(b);
      }
    });
    list.innerHTML = ''; list.appendChild(t);
  }).catch(function (e) { sessionStorage.removeItem('apw'); alert(e.message); });
}
document.getElementById('ok').onclick = function () { pw = document.getElementById('pw').value; load(); };
if (sessionStorage.getItem('apw')) { pw = sessionStorage.getItem('apw'); load(); }
