import { supabase, supabaseConfigured } from '../src/lib/supabase.ts';

const form = document.getElementById('loginForm');
const message = document.getElementById('authMessage');
const button = document.getElementById('loginButton');

function show(text, error = true) {
  message.textContent = text;
  message.className = 'auth-message' + (error ? ' error' : ' success');
}
async function isAdmin(user) {
  const { data, error } = await supabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
  if (error) throw new Error('Admin access could not be checked. Confirm the Supabase admin_users table and row security policy are installed.');
  if (!data) throw new Error('This account is not on the Ziko admin list.');
}
async function connectServer(session) {
  const response = await fetch('/api/admin/session', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin', body: JSON.stringify({ access_token: session.access_token })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Could not start the secure admin session.');
}
if (!supabaseConfigured) {
  show('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then rebuild the app.');
  button.disabled = true;
} else {
  supabase.auth.getSession().then(async ({ data }) => {
    if (!data.session) return;
    try {
      await isAdmin(data.session.user);
      await connectServer(data.session);
      window.location.replace('/dashboard.html');
    } catch (error) {
      show(error.message);
      await supabase.auth.signOut();
    }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    button.disabled = true;
    show('Signing in…', false);
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      show(error?.message || 'Could not sign in. Check your details.');
      button.disabled = false;
      return;
    }
    try {
      await isAdmin(data.session.user);
      await connectServer(data.session);
      window.location.assign('/dashboard.html');
    } catch (failure) {
      await supabase.auth.signOut();
      show(failure.message);
      button.disabled = false;
    }
  });
}