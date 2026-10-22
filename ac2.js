// AC2 helper functions. Paste into (or evaluate in) a browser tab logged in to
// https://<controller-ip>/scada-main . Defines window.AC2. All functions are
// async and use the page's own session. Read-only helpers never change the
// controller; write helpers verify by reading back.

window.AC2 = (() => {
  const H = { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function post(path, body = '') {
    const r = await fetch('/scada-main/' + path, { method: 'POST', credentials: 'include', headers: H, body });
    const t = await r.text();
    try { return JSON.parse(t); } catch (e) { throw new Error(`HTTP ${r.status} from ${path} (logged out?)`); }
  }
  const data = obj => 'data=' + encodeURIComponent(JSON.stringify(obj));
  const rows = j => (Array.isArray(j) ? j : (j.data || j.objects || j.items));

  async function sha256(s) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  // ---- objects -----------------------------------------------------------
  async function objects() { return rows(await post('objects/main', 'start=0&limit=5000')); }
  const addr = o => Scada.decodeGroupAddress(o.address);
  async function object(a) { return (await objects()).find(o => addr(o) === a) || null; }
  async function now() { return Math.max(...(await objects()).map(o => o.updatetime || 0)); } // controller clock
  async function setValue(a, v) {
    const id = Cbuslib.encodeObjectAddress(a), type = Cbuscore.getAppName(id);
    const value = type === 'lighting' ? JSON.stringify({ target: v, ramprate: 0 }) : v;
    return post('objects/setvalue', data({ value, type, datatype: 0, address: a }));
  }

  // ---- tag map -----------------------------------------------------------
  async function tags() { return rows(await post('cbustagmap/main')); }
  async function groupTag(net, app, grp) {
    return (await tags()).find(x => x.tagtype === 'G' && +x.net === net && +x.app === app && +x.tagid === grp) || null;
  }
  // create (no existing entry) or rename; name must be unique controller-wide
  async function saveGroupTag(net, app, grp, name) {
    const ex = await groupTag(net, app, grp);
    const r = await post('cbustagmap/save', data({ tagtype: 'G', net: String(net), app: String(app), objectType: '',
      tagid: String(grp), tag: name, id: ex ? String(ex.id) : '0' }));
    const back = await groupTag(net, app, grp);
    return { ok: !!(r.success && back && back.tag === name), resp: r, now: back };
  }

  // ---- objects form (needs the page's $O; reload page after tag map edits)
  function selectCombo(c, pred) {
    const i = c.store.findBy(r => pred(r.data)); if (i < 0) return null;
    const r = c.store.getAt(i); c.setValue(r.get(c.valueField)); c.fireEvent('select', c, r, i); return r.get(c.valueField);
  }
  async function createObject(net, app, grp, keywords) {
    const a = `${net}/${app}/${grp}`;
    if (await object(a)) return { ok: false, reason: 'exists' };
    $O.showForm(); await sleep(1000);
    const tc = $O.tagCombos;
    selectCombo(tc.net, d => d.tagid == net); await sleep(600);
    selectCombo(tc.app, d => d.id == app); await sleep(600);
    if (selectCombo(tc.grp, d => d.id == grp) !== grp) return { ok: false, reason: 'group not in tag map (reload page?)' };
    await sleep(500);
    $O.form.findField('tags').setValue(keywords); $O.submitForm(); await sleep(2000);
    const o = await object(a);
    return { ok: !!o, object: o && { addr: a, tags: o.tagcache, datatype: o.datatype } };
  }
  async function setKeywords(a, keywords) {
    const o = await object(a); if (!o) return { ok: false, reason: 'no object' };
    $O.showForm(o.id); await sleep(1200);
    $O.form.findField('tags').setValue(keywords); $O.submitForm(); await sleep(1800);
    const b = await object(a); return { ok: b.tagcache === keywords, tags: b.tagcache };
  }

  // ---- scripts -----------------------------------------------------------
  async function scripts() { return rows(await post('scripting/main', 'start=0&limit=300')); }
  async function script(id) { return (await post('scripting/form', 'id=' + id)).data; }
  async function createScript(meta) { // {name, params, category, type, description} - created disabled
    if ((await scripts()).some(s => s.name === meta.name)) return { ok: false, reason: 'name exists' };
    await post('scripting/save', data({ active: 0, subparams: 0, ...meta }));
    const s = (await scripts()).find(x => x.name === meta.name);
    return { ok: !!s, id: s && s.id };
  }
  async function setActive(id, name, want) { // checks the name, toggles only if needed
    const s = (await scripts()).find(x => x.id == id);
    if (!s || s.name !== name) return { ok: false, reason: 'name mismatch: ' + (s && s.name) };
    if (+s.active !== +want) await post('scripting/status', data({ id }));
    await sleep(1000);
    const b = (await scripts()).find(x => x.id == id); return { ok: +b.active === +want, active: b.active };
  }
  // run inside /scada-main/main/editor?id=<id>
  async function uploadInEditor(id, name, src, expectSha, expectOldSha) {
    for (let i = 0; i < 30 && !(window.$S && window.$CM && window.$E && $S.data); i++) await sleep(300);
    if ($S.data.id != id || $S.data.name !== name) return { ok: false, reason: 'wrong script open' };
    if ((await sha256(src)) !== expectSha) return { ok: false, reason: 'source hash mismatch' };
    if (expectOldSha !== undefined && (await sha256($CM.getValue())) !== expectOldSha) return { ok: false, reason: 'controller copy changed' };
    $CM.setValue(src); $E.changed = true; $E.submitForm(); await sleep(2500);
    return { ok: (await sha256((await script(id)).script)) === expectSha };
  }

  // ---- logs --------------------------------------------------------------
  async function logs(n = 100, filter) {
    const l = (await post('logs/main', 'start=0&limit=' + n)).data;
    return filter ? l.filter(x => filter.test(x.scriptname + ' ' + x.log)) : l;
  }
  async function errors(n = 5) { return (await post('errorlog/main', 'start=0&limit=' + n)).data; }

  return { post, data, sha256, objects, object, addr, now, setValue, tags, groupTag, saveGroupTag,
           createObject, setKeywords, scripts, script, createScript, setActive, uploadInEditor, logs, errors, sleep };
})();
'AC2 helpers loaded';
