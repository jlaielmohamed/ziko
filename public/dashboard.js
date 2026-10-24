import { supabase, supabaseConfigured } from '../src/lib/supabase.ts';

const $ = id => document.getElementById(id);
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
let config = null;
let appointments = [];
function message(text, error = false) {
  const el = $('dashMessage');
  el.textContent = text;
  el.className = 'dash-message visible' + (error ? ' error' : ' success');
  clearTimeout(message.timer);
  message.timer = setTimeout(() => { el.className = 'dash-message'; }, 4800);
}
async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Request failed.');
  return body;
}
function safe(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function money(value) { return (Number(value) || 0).toFixed(0) + ' TND'; }
function setPanel(name) {
  document.querySelectorAll('.dash-panel').forEach(panel => panel.classList.toggle('active', panel.id === 'panel-' + name));
  document.querySelectorAll('.side-link').forEach(link => link.classList.toggle('active', link.dataset.panel === name));
}
document.querySelectorAll('.side-link').forEach(link => link.addEventListener('click', () => setPanel(link.dataset.panel)));
document.querySelectorAll('[data-goto]').forEach(link => link.addEventListener('click', () => setPanel(link.dataset.goto)));
async function verifySession() {
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
}
$('signout').addEventListener('click', async () => {
  await fetch('/api/admin/session', { method: 'DELETE', credentials: 'same-origin' });
  await supabase.auth.signOut();
  window.location.replace('/admin.html');
});
function appointmentTable(target, rows, compact = false) {
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
}
function renderAppointments() {
  const date = $('filterDate').value, status = $('filterStatus').value;
  const rows = appointments.filter(row => (!date || row[6] === date) && (!status || row[9] === status));
  appointmentTable('appointmentsTable', rows);
  appointmentTable('recentTable', appointments.slice(0, 6), true);
}
function renderStats(stats) {
  $('todayTotal').textContent = money(stats.totals.today.revenue);
  $('todayCount').textContent = stats.totals.today.count + ' appointments';
  $('monthTotal').textContent = money(stats.totals.month.revenue);
  $('monthCount').textContent = stats.totals.month.count + ' appointments';
  $('yearTotal').textContent = money(stats.totals.year.revenue);
  $('yearCount').textContent = stats.totals.year.count + ' appointments';
}
function renderServices() {
  $('serviceEditor').innerHTML = config.services.map((service, index) => `<article class="editor-card service-edit" data-index="${index}">
    <div class="service-edit-head"><b>Service ${String(index + 1).padStart(2, '0')}</b><button class="remove-service" type="button">Remove</button></div>
    <label>Service name<input data-key="name" value="${safe(service.name)}"></label>
    <label>Reference ID<input data-key="id" value="${safe(service.id)}" readonly></label>
    <div class="field-row"><label>Duration (minutes)<input data-key="min" type="number" min="5" max="240" value="${safe(service.min)}"></label><label>Price (TND)<input data-key="price" type="number" min="0" step="0.5" value="${safe(service.price)}"></label></div>
    <label>Description<textarea data-key="description" rows="2">${safe(service.description)}</textarea></label></article>`).join('');
  document.querySelectorAll('.remove-service').forEach(button => button.addEventListener('click', () => {
    const card = button.closest('.service-edit');
    config.services.splice(Number(card.dataset.index), 1);
    renderServices();
  }));
}
function renderHours() {
  $('hoursEditor').innerHTML = dayNames.map((day, index) => {
    const value = config.hours[index];
    return `<div class="hours-row" data-day="${index}"><b>${day}</b><label class="toggle-field"><input type="checkbox" data-key="open" ${value ? 'checked' : ''}> Open</label><input type="time" data-key="start" value="${value ? value[0] : '10:00'}"><span>to</span><input type="time" data-key="end" value="${value ? value[1] : '22:00'}"></div>`;
  }).join('');
}
function renderBlocked() {
  $('blockedList').innerHTML = config.blockedDates.length ? config.blockedDates.slice().sort().map(date => `<div class="blocked-item"><span>${safe(new Date(date + 'T12:00:00').toLocaleDateString(undefined, { dateStyle: 'medium' }))}</span><button type="button" data-date="${safe(date)}">Remove</button></div>`).join('') : '<p class="empty-note">No dates are blocked.</p>';
  document.querySelectorAll('.blocked-item button').forEach(button => button.addEventListener('click', () => {
    config.blockedDates = config.blockedDates.filter(date => date !== button.dataset.date);
    renderBlocked();
  }));
}
function renderSettings() {
  $('shopName').value = config.settings.shopName || '';
  $('shopLocation').value = config.settings.location || '';
  $('shopPhone').value = config.settings.phone || '';
  $('shopEmail').value = config.settings.email || '';
  $('barberNames').value = config.barbers.join('\n');
}
function readServices() {
  return Array.from(document.querySelectorAll('.service-edit')).map(card => {
    const value = key => card.querySelector('[data-key="' + key + '"]').value;
    return { id: value('id').trim(), name: value('name').trim(), min: Number(value('min')), price: Number(value('price')), description: value('description').trim() };
  });
}
function readHours() {
  const hours = {};
  document.querySelectorAll('.hours-row').forEach(row => {
    const day = row.dataset.day, open = row.querySelector('[data-key="open"]').checked;
    hours[day] = open ? [row.querySelector('[data-key="start"]').value, row.querySelector('[data-key="end"]').value] : null;
  });
  return hours;
}
async function saveSettings(kind) {
  if (kind === 'services') config.services = readServices();
  if (kind === 'hours') config.hours = readHours();
  if (kind === 'settings') {
    config.settings.shopName = $('shopName').value.trim();
    config.settings.location = $('shopLocation').value.trim();
    config.settings.phone = $('shopPhone').value.trim();
    config.settings.email = $('shopEmail').value.trim();
    config.barbers = $('barberNames').value.split('\n').map(name => name.trim()).filter(Boolean);
  }
  try {
    const result = await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(config) });
    config = result.config;
    renderServices(); renderHours(); renderBlocked(); renderSettings();
    message('Shop settings saved.');
  } catch (error) { message(error.message, true); }
}
document.querySelectorAll('[data-save]').forEach(button => button.addEventListener('click', () => saveSettings(button.dataset.save)));
$('addService').addEventListener('click', () => {
  const id = 'service-' + Math.random().toString(36).slice(2, 8);
  config.services.push({ id, name: 'New service', min: 30, price: 0, description: '' });
  renderServices();
});
$('addBlocked').addEventListener('click', () => {
  const date = $('blockedDate').value;
  if (!date) return message('Choose a date first.', true);
  if (!config.blockedDates.includes(date)) config.blockedDates.push(date);
  $('blockedDate').value = '';
  renderBlocked();
});
$('filterDate').addEventListener('change', renderAppointments);
$('filterStatus').addEventListener('change', renderAppointments);
$('clearFilters').addEventListener('click', () => { $('filterDate').value = ''; $('filterStatus').value = ''; renderAppointments(); });
async function initialize() {
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
}
initialize();