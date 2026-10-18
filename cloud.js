/* OJAS cloud — login (6-digit email code) + talking to the online database (Supabase).
   Only the PUBLIC key is here; it is safe in the app because every table only lets a logged-in
   person read and write their OWN rows (row-level security). The private space stays encrypted
   with your passcode, so the server only ever stores scrambled text for it. */
const Cloud = (() => {
  const URL_ = 'https://gduayqbwcfqikiffvfbh.supabase.co';
  const KEY = 'sb_publishable_bQFcRIPxNdr_zyzqC2zOgw_9bCYG-EE';
  const SK = 'ojas.cloud';
  let sess = null; try { sess = JSON.parse(localStorage.getItem(SK) || 'null'); } catch (e) { sess = null; }
  const keep = () => { try { sess ? localStorage.setItem(SK, JSON.stringify(sess)) : localStorage.removeItem(SK); } catch (e) {} };
  const H = (tok, extra) => ({ apikey: KEY, 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}), ...(extra || {}) });
  async function j(r) { const t = await r.text(); let b = null; try { b = t ? JSON.parse(t) : null; } catch (e) { b = t; } if (!r.ok) { const m = (b && (b.msg || b.message || b.error_description || b.error)) || ('HTTP ' + r.status); const er = new Error(m); er.status = r.status; throw er; } return b; }
  function take(b) { sess = { at: b.access_token, rt: b.refresh_token, exp: Date.now() + (b.expires_in || 3600) * 1000, uid: b.user && b.user.id, email: b.user && b.user.email }; keep(); return sess; }

  async function sendCode(email) {
    return j(await fetch(URL_ + '/auth/v1/otp', { method: 'POST', headers: H(), body: JSON.stringify({ email, create_user: true }) }));
  }
  async function verify(email, code) {
    const body = JSON.stringify({ type: 'email', email, token: String(code).trim() });
    return take(await j(await fetch(URL_ + '/auth/v1/verify', { method: 'POST', headers: H(), body })));
  }
  async function signUp(email, password) {
    const b = await j(await fetch(URL_ + '/auth/v1/signup', { method: 'POST', headers: H(), body: JSON.stringify({ email, password }) }));
    if (b && b.access_token) { take(b); return 'in'; }
    const u = (b && b.user) || b; if (u && Array.isArray(u.identities) && u.identities.length === 0) throw Object.assign(new Error('User already registered'), { status: 422 });
    return 'confirm'; // Supabase sent a "Confirm your email" mail first
  }
  async function signIn(email, password) {
    return take(await j(await fetch(URL_ + '/auth/v1/token?grant_type=password', { method: 'POST', headers: H(), body: JSON.stringify({ email, password }) })));
  }
  async function refresh() {
    if (!sess || !sess.rt) throw Object.assign(new Error('Not logged in'), { status: 401 });
    try { return take(await j(await fetch(URL_ + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: H(), body: JSON.stringify({ refresh_token: sess.rt }) }))); }
    catch (e) { if (e.status === 400 || e.status === 401) { sess = null; keep(); } throw e; }
  }
  async function token() { if (!sess) return null; if (Date.now() > sess.exp - 60000) await refresh(); return sess && sess.at; }
  async function call(path, opts = {}, retry = true) {
    const t = await token(); if (!t) throw Object.assign(new Error('Not logged in'), { status: 401 });
    const r = await fetch(URL_ + path, { ...opts, headers: { ...H(t, opts.headers), ...(opts.raw ? { 'Content-Type': opts.raw } : {}) } });
    if (r.status === 401 && retry) { await refresh(); return call(path, opts, false); }
    return r;
  }
  async function rest(path, opts) { return j(await call('/rest/v1/' + path, opts)); }
  async function count(table) { const r = await call('/rest/v1/' + table + '?select=user_id', { method: 'HEAD', headers: { Prefer: 'count=exact' } }); const cr = r.headers.get('content-range') || ''; return +(cr.split('/')[1] || 0); }
  function logout() { const t = sess && sess.at; sess = null; keep(); if (t) fetch(URL_ + '/auth/v1/logout', { method: 'POST', headers: H(t) }).catch(() => {}); }
  /* photos (private bucket ojas-photos/<user id>/<photo id>.jpg) */
  async function photoList() { const r = await call('/storage/v1/object/list/ojas-photos', { method: 'POST', body: JSON.stringify({ prefix: sess.uid, limit: 1000 }) }); return (await j(r)) || []; }
  async function photoUp(id, blob) { return j(await call(`/storage/v1/object/ojas-photos/${sess.uid}/${encodeURIComponent(id)}.jpg`, { method: 'POST', body: blob, raw: blob.type || 'image/jpeg', headers: { 'x-upsert': 'true' } })); }
  async function photoDown(name) { const r = await call(`/storage/v1/object/authenticated/ojas-photos/${sess.uid}/${encodeURIComponent(name)}`); if (!r.ok) throw new Error('photo ' + r.status); return r.blob(); }
  return { URL: URL_, sendCode, verify, signUp, signIn, refresh, token, rest, count, logout, photoList, photoUp, photoDown, get user() { return sess ? { uid: sess.uid, email: sess.email } : null; } };
})();
