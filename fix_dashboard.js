const fs = require('fs');
const path = 'C:/ziko/ziko-update/public/dashboard.js';
let s = fs.readFileSync(path, 'utf8');
// Replace api calls and logic
s = s.replace(`async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Request failed.');
  return body;
}`, `async function api() { throw new Error('Not used'); }`);

// verify session
s = s.replace(`async function verifySession() {
  if (!supabaseConfigured || !supabase) throw new Error('Supabase configuration is missing.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in again.');
  const { data: admin, error } = await supabase.from('admin_users').select('user_id').eq('user_id', session.user.id).maybeSingle();
  if (error || !admin) throw new Error('This account is not authorized to manage the studio.');
  await api('/api/admin/session', { method: 'POST', body: JSON.stringify({ access_token: session.access_token }) });
  $('adminEmail').textContent = session.user.email || 'Studio admin';
  supabase.auth.onAuthStateChange((event, nextSession) => {
    if (event === 'TOKEN_REFRESHED' && nextSession) {
      fetch('/api/admin/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ access_token: nextSession.access_token }) });
    }
    if (event === 'SIGNED_OUT') window.location.replace('/admin.html');
  });
}`, `async function verifySession() {
  if (!supabaseConfigured || !supabase) throw new Error('Supabase configuration is missing.');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in again.');
  const { data: admin, error } = await supabase.from('admin_users').select('user_id').eq('user_id', session.user.id).maybeSingle();
  if (error || !admin) throw new Error('This account is not authorized to manage the studio.');
  $('adminEmail').textContent = session.user.email || 'Studio admin';
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.replace('/admin.html');
  });
}`);

// signout
s = s.replace(`$('signout').addEventListener('click', async () => {
  await fetch('/api/admin/session', { method: 'DELETE', credentials: 'same-origin' });
  await supabase.auth.signOut();
  window.location.replace('/admin.html');
});`, `$('signout').addEventListener('click', async () => {
  if (supabase) await supabase.auth.signOut();
  window.location.replace('/admin.html');
});`);

// appointment table
s = s.replace(`function appointmentTable(target, rows, compact = false) {
  const table = $(target);
  table.innerHTML = '';
  const head = table.insertRow();
  (compact ? ['Date', 'Time', 'Client', 'Service', 'Status'] : ['Date', 'Time', 'Client', 'Phone', 'Service', 'Barber', 'Status', 'Update']).forEach(label => {
    const th = document.createElement('th'); th.textContent = label; head.appendChild(th);
  });
  rows.forEach(row => {
    const tr = table.insertRow();
    const values = compact ? [row[6], row[7], row[2], row[4], row[9]] : [row[6], row[7], row[2], row[3], row[4], row[11], row[9]];
    values.forEach(value => { const td = tr.insertCell(); td.textContent = value; });
    if (!compact) {
      const td = tr.insertCell();
      const select = document.createElement('select');
      ['Requested', 'Confirmed', 'Completed', 'Cancelled'].forEach(status => {
        const option = document.createElement('option'); option.value = status; option.textContent = status; option.selected = row[9] === status; select.appendChild(option);
      });
      select.addEventListener('change', async () => {
        try { await api('/api/admin/appointments/' + encodeURIComponent(row[0]), { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); row[9] = select.value; message('Appointment status updated.'); }
        catch (error) { message(error.message, true); }
      });
      td.appendChild(select);
    }
  });
  if (!rows.length) { const tr = table.insertRow(); const td = tr.insertCell(); td.colSpan = compact ? 5 : 8; td.textContent = 'No appointments to show.'; }
}`, `function appointmentTable(target, rows, compact = false) {
  const table = $(target);
  table.innerHTML = '';
  const head = table.insertRow();
  (compact ? ['Date', 'Time', 'Client', 'Service', 'Status'] : ['Date', 'Time', 'Client', 'Phone', 'Service', 'Barber', 'Status', 'Update']).forEach(label => {
    const th = document.createElement('th'); th.textContent = label; head.appendChild(th);
  });
  rows.forEach(row => {
    const tr = table.insertRow();
    const values = compact ? [row.appointment_date, row.start_time, row.name, row.service_name, row.status] : [row.appointment_date, row.start_time, row.name, row.phone, row.service_name, row.barber, row.status];
    values.forEach(value => { const td = tr.insertCell(); td.textContent = value; });
    if (!compact) {
      const td = tr.insertCell();
      const select = document.createElement('select');
      ['Requested', 'Confirmed', 'Completed', 'Cancelled'].forEach(status => {
        const option = document.createElement('option'); option.value = status; option.textContent = status; option.selected = row.status === status; select.appendChild(option);
      });
      select.addEventListener('change', async () => {
        try { 
          if (!supabase) throw new Error('Not configured');
          const { error } = await supabase.from('appointments').update({ status: select.value }).eq('id', row.id);
          if (error) throw error;
          row.status = select.value; message('Appointment status updated.'); 
        }
        catch (error) { message(error.message, true); }
      });
      td.appendChild(select);
    }
  });
  if (!rows.length) { const tr = table.insertRow(); const td = tr.insertCell(); td.colSpan = compact ? 5 : 8; td.textContent = 'No appointments to show.'; }
}`);

// renderAppointments filter
s = s.replace(`function renderAppointments() {
  const date = $('filterDate').value, status = $('filterStatus').value;
  const rows = appointments.filter(row => (!date || row[6] === date) && (!status || row[9] === status));
  appointmentTable('appointmentsTable', rows);
  appointmentTable('recentTable', appointments.slice(0, 6), true);
}`, `function renderAppointments() {
  const date = $('filterDate').value, status = $('filterStatus').value;
  const rows = appointments.filter(row => (!date || row.appointment_date === date) && (!status || row.status === status));
  appointmentTable('appointmentsTable', rows);
  appointmentTable('recentTable', appointments.slice(0, 6), true);
}`);

fs.writeFileSync(path, s);
console.log('done4');
