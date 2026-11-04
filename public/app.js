// Gutterdag – frontend (vanilla JS, ingen frameworks)
(function () {
  'use strict';

  /* ---------- Tilstand i browseren ---------- */
  const LS = { token: 'gd-token', admin: 'gd-admin', fane: 'gd-fane' };
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} },
  };
  let token = ls.get(LS.token);
  let adminToken = ls.get(LS.admin);
  let fane = ls.get(LS.fane) || 'mord';
  let pub = null;        // offentlig status
  let mig = null;        // mine hemmelige data
  let skaerm = 'login';  // login | pin | spil | admin-login | admin
  let pinSpiller = null, pinTast = '', pinFejl = '';
  let vis = { seddel: false, missioner: false };
  let oelKladde = null;  // lokal kladde af øl-arket
  let oelGemTimer = null;

  /* ---------- Hjælpere ---------- */
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const kl = (t) => { const d = new Date(t); return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0'); };

  async function api(sti, metode, body, admin) {
    const h = { 'Content-Type': 'application/json' };
    if (token) h['x-token'] = token;
    if (admin && adminToken) h['x-admin'] = adminToken;
    const r = await fetch(sti, { method: metode || 'GET', headers: h, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.fejl || 'Noget gik galt'); e.status = r.status; throw e; }
    return j;
  }
  function toast(t) {
    const el = $('#toast');
    el.innerHTML = '<div>' + esc(t) + '</div>';
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { el.innerHTML = ''; }, 2400);
  }
  function modal(html) { $('#modal').innerHTML = html ? '<div class="bg" data-act="lukmodal"><div class="sheet" data-stop>' + html + '</div></div>' : ''; }

  /* ---------- Data ---------- */
  async function hent() {
    try {
      pub = await api('/api/offentlig');
      if (token) {
        try {
          mig = await api('/api/mig');
          if (skaerm === 'login' || skaerm === 'pin') skaerm = 'spil';
          if (oelKladde === null) oelKladde = JSON.parse(JSON.stringify(mig.oel || { mitNr: null, vurderinger: {} }));
        } catch (e) {
          if (e.status === 401) { token = null; ls.set(LS.token, null); mig = null; if (skaerm === 'spil') skaerm = 'login'; }
        }
      }
    } catch (e) { toast('Ingen forbindelse til serveren'); }
    tegn();
  }

  /* ---------- Tegning ---------- */
  // Tegn ikke om, mens man skriver i et felt – ellers forsvinder det, man har tastet
  let ventendeTegning = false;
  function skriverNu() {
    const el = document.activeElement;
    return el && $('#app').contains(el) && el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'number');
  }
  document.addEventListener('focusout', () => { setTimeout(() => { if (ventendeTegning && !skriverNu()) { ventendeTegning = false; tegn(); } }, 0); });

  function tegn(tving) {
    if (!tving && skriverNu()) { ventendeTegning = true; return; }
    const app = $('#app');
    if (!pub) { app.innerHTML = '<div class="wrap"><p class="muted">Henter …</p></div>'; return; }
    if (skaerm === 'admin-login') { app.innerHTML = vAdminLogin(); return; }
    if (skaerm === 'admin') { app.innerHTML = vAdmin(); return; }
    if (skaerm === 'pin') { app.innerHTML = vPin(); return; }
    if (skaerm !== 'spil' || !mig) { app.innerHTML = vLogin(); return; }
    let h = '<div class="wrap"><div class="top"><h1>Gutterdag</h1><div class="who">Logget ind som<b>' + esc(mig.navn) + '</b></div></div>';
    if (fane === 'mord') h += vMord();
    else if (fane === 'missioner') h += vMissioner();
    else if (fane === 'oel') h += vOel();
    else h += vStatus();
    h += '</div><nav class="tabs">' + [
      ['mord', '🗡️', 'Mordleg'], ['missioner', '🕵️', 'Missioner'], ['oel', '🍺', 'Øl'], ['status', '🏆', 'Status'],
    ].map(([k, i, t]) => '<button data-act="fane" data-f="' + k + '" class="' + (fane === k ? 'on' : '') + '"><span class="i">' + i + '</span>' + t + '</button>').join('') + '</nav>';
    app.innerHTML = h;
  }

  function vLogin() {
    return '<div class="wrap"><div class="top"><h1>Gutterdag</h1></div>' +
      '<h2>Hvem er du?</h2><div class="grid-names">' +
      pub.spillere.map((s) => '<button class="btn" data-act="vaelg" data-id="' + s.id + '">' + esc(s.navn) + '<small>' + (s.harPin ? 'Har kode' : 'Ny – vælg kode') + '</small></button>').join('') +
      '</div><p class="muted small" style="margin-top:16px">Første gang vælger du selv en kode på 4 cifre. Den beskytter dine hemmelige sedler, så de andre ikke kan kigge.</p>' +
      '<div style="text-align:center;margin-top:24px"><button class="link" data-act="admin">Admin</button></div></div>';
  }
  function vPin() {
    const s = pub.spillere[pinSpiller];
    return '<div class="wrap"><div class="top"><h1>Gutterdag</h1><button class="btn sm ghost" data-act="tilbage">Tilbage</button></div>' +
      '<h2>' + esc(s.navn) + '</h2><p class="muted" style="text-align:center;margin:0">' + (s.harPin ? 'Skriv din kode' : 'Vælg en kode på 4 cifre – husk den!') + '</p>' +
      '<div class="pin">' + [0, 1, 2, 3].map((i) => '<span class="' + (i < pinTast.length ? 'on' : '') + '"></span>').join('') + '</div>' +
      '<div class="pad">' + ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k) => k === '' ? '<span></span>' : '<button class="btn" data-act="tast" data-k="' + k + '">' + k + '</button>').join('') + '</div>' +
      (pinFejl ? '<div class="err">' + esc(pinFejl) + '</div>' : '') +
      '<p class="muted small" style="text-align:center;margin-top:16px">Har du glemt din kode? Bed Kris om at nulstille den.</p></div>';
  }

  /* --- Mordleg --- */
  function regelMord() {
    return '<details><summary>Sådan virker mordlegen</summary><ul>' +
      '<li>Du har ét hemmeligt <b>offer</b>, en <b>ting</b> og et <b>sted</b>. Samtidig er der en anden, der jagter dig.</li>' +
      '<li>Du dræber ved at få dit offer til at <b>tage imod tingen fra din hånd</b>, mens I begge er på stedet. Sig så stille: <i>"Du er død."</i> En ting, offeret selv samler op, tæller ikke.</li>' +
      '<li><b>Undgå at dø:</b> Du må altid sige nej tak. Vær mistænksom, når nogen rækker dig noget, især hvis det sker et bestemt sted.</li>' +
      '<li><b>Afslør din jæger:</b> Du har ét forsøg. Gætter du rigtigt, er din jæger ude, og du får drabet. Gætter du forkert, er dit forsøg brugt, og du skal drikke.</li>' +
      '<li>Bliver du dræbt, trykker <b>du selv</b> på "Jeg er blevet dræbt". Så går din seddel automatisk videre til din drabsmand.</li>' +
      '<li><b>Fredszone:</b> ingen drab, mens du selv spiller en Riftbound-kamp.</li>' +
      '<li>Den sidste overlevende vinder.</li></ul></details>';
  }
  function vMord() {
    const m = mig.mord;
    let h = '<h2>Mordlegen</h2>';
    if (!mig.trukket) return h + '<div class="card"><p style="margin:0">Sedlerne er ikke trukket endnu. Kris starter legen, når alle er her.</p></div>' + regelMord();
    if (m.vinder) return h + '<div class="winner"><div class="t">SIDSTE OVERLEVENDE</div><div class="n">Du vandt mordlegen!</div><p class="muted" style="margin:6px 0 0">' + m.drab + ' drab</p></div>';
    if (m.doed) return h + '<div class="card" style="text-align:center"><div style="font-size:48px">☠️</div><div class="big">Du er død</div><p class="muted" style="margin:0">Du nåede ' + m.drab + ' drab. Du er stadig med i missionerne og øl-smagningen.</p></div>' + regelMord();
    const s = m.seddel;
    h += '<div class="secret">' + (vis.seddel ? '' : '<div class="cover" data-act="visseddel"><span style="font-size:30px">🗡️</span>Tryk for at se din seddel<span class="muted small" style="font-weight:500">Sørg for, at ingen kigger med</span></div>') +
      '<div class="slip" style="' + (vis.seddel ? '' : 'visibility:hidden') + '"><div class="lbl">Dit offer</div><div class="val">' + esc(s.offer) + '</div>' +
      '<div class="lbl">Tingen</div><div class="val">' + esc(s.ting) + '</div><div class="lbl">Stedet</div><div class="val">' + esc(s.sted) + '</div></div></div>';
    h += '<div class="row" style="margin:12px 0"><span class="chip gold">' + m.drab + ' drab</span><span class="chip">' + pub.levende + ' i live</span>' +
      (vis.seddel ? '<button class="btn sm ghost" data-act="skjulseddel" style="margin-left:auto">Skjul</button>' : '') + '</div>';
    h += '<div class="card"><h3>Ved du, hvem der jagter dig?</h3><p class="muted small" style="margin:0 0 10px">Du har ' + m.forsoegTilbage + ' forsøg tilbage. Gætter du rigtigt, er jægeren ude, og du får drabet. Gætter du forkert, skal du drikke.</p>' +
      '<button class="btn full" data-act="afsloer"' + (m.forsoegTilbage > 0 ? '' : ' disabled') + '>🔍 Afslør min jæger</button></div>';
    h += '<button class="btn danger full" data-act="doed">☠️ Jeg er blevet dræbt</button><div style="height:12px"></div>' + regelMord();
    return h;
  }

  /* --- Missioner --- */
  function regelMission() {
    return '<details><summary>Sådan virker missionerne</summary><ul>' +
      '<li>Du har <b>3 hemmelige missioner</b>, som skal klares, uden at nogen opdager det.</li>' +
      '<li>Klarer du en, så tryk <b>"Klaret"</b>. Det kan kun du se.</li>' +
      '<li>Mistænker du nogen, kan du råbe <b>"Mission!"</b> og gætte, hvad den var. Gætter du rigtigt, trykker den anden <b>"Afsløret"</b> og vælger dig, og du får 1 point. Gætter du forkert, skal du drikke.</li>' +
      '<li>Missionerne afsløres i baren. En klaret mission giver 1 point, og en afsløring hos en anden giver 1 point.</li>' +
      '<li><b>Stop-reglen:</b> Siger nogen stop til en fysisk mission, så stopper du. Missionen er bare brændt.</li></ul></details>';
  }
  function vMissioner() {
    let h = '<h2>Hemmelige missioner</h2>';
    if (pub.missionResultat) return h + vMissionResultat() + regelMission();
    if (!mig.trukket) return h + '<div class="card"><p style="margin:0">Missionerne er ikke trukket endnu.</p></div>' + regelMission();
    if (!vis.missioner) return h + '<div class="secret" style="min-height:160px"><div class="cover" data-act="vismissioner"><span style="font-size:30px">🕵️</span>Tryk for at se dine 3 missioner<span class="muted small" style="font-weight:500">Sørg for, at ingen kigger med</span></div></div><div style="height:12px"></div>' + regelMission();
    const andre = pub.spillere.filter((s) => s.id !== mig.id);
    h += mig.missioner.map((m, i) => {
      let knap;
      if (m.status === 'aktiv') knap = '<div class="row"><button class="btn sm teal" data-act="mklaret" data-i="' + i + '">✓ Klaret</button><button class="btn sm" data-act="mbraendt" data-i="' + i + '">Afsløret</button></div>';
      else if (m.status === 'klaret') knap = '<div class="row"><span class="chip ok">Klaret</span><button class="btn sm ghost" data-act="maktiv" data-i="' + i + '">Fortryd</button></div>';
      else knap = '<div class="row"><span class="chip bad">Afsløret af ' + esc((andre.find((s) => s.id === m.afsloeretAf) || {}).navn || '?') + '</span><button class="btn sm ghost" data-act="maktiv" data-i="' + i + '">Fortryd</button></div>';
      return '<div class="mission ' + m.status + '"><div class="t">' + (i + 1) + '. ' + esc(m.tekst) + '</div>' + knap + '</div>';
    }).join('');
    h += '<div class="row" style="margin-bottom:12px"><button class="btn sm ghost" data-act="skjulmissioner">Skjul missioner</button></div>' + regelMission();
    return h;
  }
  function vMissionResultat() {
    const r = pub.missionResultat;
    const bedste = r.filter((p) => p.point === r[0].point).map((p) => p.navn);
    let h = '<div class="winner"><div class="t">MISSIONSMESTER</div><div class="n">' + esc(bedste.join(' & ')) + '</div><p class="muted" style="margin:6px 0 0">' + r[0].point + ' point</p></div>';
    h += r.map((p) => '<div class="card"><div class="row" style="justify-content:space-between"><h3 style="margin:0">' + esc(p.navn) + '</h3><span class="chip gold">' + p.point + ' point</span></div>' +
      '<p class="muted small" style="margin:4px 0 8px">' + p.klaret + ' klaret · ' + p.afsloeringer + ' afsløringer</p>' +
      p.missioner.map((m) => '<div class="small" style="margin:4px 0">' + (m.status === 'klaret' ? '✅' : m.status === 'braendt' ? '❌' : '⬜') + ' ' + esc(m.tekst) + (m.afsloeretAf ? ' <span class="muted">(afsløret af ' + esc(m.afsloeretAf) + ')</span>' : '') + '</div>').join('') + '</div>').join('');
    return h;
  }

  /* --- Mystery-øl --- */
  function vOel() {
    let h = '<h2>Mystery-øl</h2>';
    if (pub.oelResultat) return h + vOelResultat();
    if (!pub.faser.oelAaben) {
      return h + '<div class="card"><p style="margin-top:0"><b>Husk:</b> Tag en øl med (mindst 33 cl), som du tror, de andre ikke kender. Pak den ind hjemmefra i sølvpapir eller en brun pose uden navn.</p>' +
        '<p class="muted" style="margin-bottom:0">Smagningen åbner til aftensmaden. Øllene bliver blandet og nummereret, og så giver alle point og gætter, hvem der har taget hvilken med.</p></div>';
    }
    const n = pub.antalOel, k = oelKladde, andre = pub.spillere.filter((s) => s.id !== mig.id);
    h += '<div class="card"><label class="muted small" for="mitnr">Hvilket nummer er din øl? (kun du kan se det)</label><select id="mitnr" data-oel="mitnr" style="width:100%;margin-top:6px"><option value="">Vælg nummer</option>' +
      Array.from({ length: n }, (_, i) => i + 1).map((nr) => '<option value="' + nr + '"' + (k.mitNr === nr ? ' selected' : '') + '>Nr. ' + nr + '</option>').join('') + '</select></div>';
    for (let nr = 1; nr <= n; nr++) {
      if (nr === k.mitNr) continue;
      const v = k.vurderinger[nr] || {};
      h += '<div class="beer"><div class="hd"><span class="nr">Øl nr. ' + nr + '</span>' + (v.point ? '<span class="chip gold">' + v.point + '/10</span>' : '') + '</div>' +
        '<div class="scale">' + Array.from({ length: 10 }, (_, i) => i + 1).map((p) => '<button data-act="point" data-nr="' + nr + '" data-p="' + p + '" class="' + (v.point === p ? 'on' : '') + '">' + p + '</button>').join('') + '</div>' +
        '<select data-oel="gaet" data-nr="' + nr + '"><option value="">Hvem har taget den med?</option>' +
        andre.map((s) => '<option value="' + s.id + '"' + (v.gaet === s.id ? ' selected' : '') + '>' + esc(s.navn) + '</option>').join('') + '</select></div>';
    }
    h += '<p class="muted small">Dit ark gemmes automatisk. Kris afslører resultatet, når alle er færdige.</p>';
    h += '<div class="card"><h3>Hvem er færdige?</h3><ul class="list">' + pub.oelIndsendt.map((o) => '<li><span>' + esc(o.navn) + '</span>' + (o.faerdig ? '<span class="chip ok">Færdig</span>' : '<span class="chip">I gang</span>') + '</li>').join('') + '</ul></div>';
    return h;
  }
  function vOelResultat() {
    const r = pub.oelResultat, top = r.oel[0], snude = r.snuder[0];
    let h = '';
    if (top && top.snit !== null) {
      const konger = r.oel.filter((o) => o.snit === top.snit);
      h += '<div class="winner"><div class="t">ØLKONGEN</div><div class="n">' + esc(konger.map((o) => o.ejere.join(' & ') || 'Nr. ' + o.nr).join(' & ')) + '</div><p class="muted" style="margin:6px 0 0">Øl nr. ' + konger.map((o) => o.nr).join(' & ') + ' · snit ' + top.snit + '/10</p></div>';
    }
    if (snude && snude.rigtige > 0) h += '<div class="winner"><div class="t">ØLSNUDEN</div><div class="n">' + esc(r.snuder.filter((x) => x.rigtige === snude.rigtige).map((x) => x.navn).join(' & ')) + '</div><p class="muted" style="margin:6px 0 0">' + snude.rigtige + ' rigtige gæt</p></div>';
    h += '<div class="card"><h3>Alle øl</h3><ul class="list">' + r.oel.map((o) => '<li><span><b>Nr. ' + o.nr + '</b> · ' + esc(o.ejere.join(' & ') || 'ukendt') + '</span><span class="chip gold">' + (o.snit === null ? '–' : o.snit + '/10') + '</span></li>').join('') + '</ul></div>';
    h += '<div class="card"><h3>Rigtige gæt</h3><ul class="list">' + r.snuder.map((s) => '<li><span>' + esc(s.navn) + '</span><span class="chip">' + s.rigtige + '</span></li>').join('') + '</ul></div>';
    return h;
  }

  /* --- Status --- */
  function vStatus() {
    let h = '<h2>Status</h2>';
    if (pub.mord) {
      const m = pub.mord;
      if (m.vinder) h += '<div class="winner"><div class="t">MORDLEGENS VINDER</div><div class="n">' + esc(m.vinder) + '</div></div>';
      h += '<div class="card"><h3>Drab</h3><ul class="list">' + m.drab.map((d) => '<li><span class="' + (d.doed ? 'dead' : '') + '">' + esc(d.navn) + '</span><span class="chip gold">' + d.drab + '</span></li>').join('') + '</ul></div>';
    }
    if (!pub.mord) h += '<div class="card"><div class="row" style="justify-content:space-between"><h3 style="margin:0">Mordlegen</h3><span class="chip">' + pub.levende + ' af ' + pub.spillere.length + ' i live</span></div>' +
      '<ul class="list" style="margin-top:6px">' + pub.spillere.map((s) => '<li><span class="' + (s.doed ? 'dead' : '') + '">' + esc(s.navn) + '</span>' + (s.doed ? '☠️' : '<span class="chip ok">I live</span>') + '</li>').join('') + '</ul></div>';
    h += '<div class="card"><h3>Seneste drab</h3>' + (pub.feed.length ? '<ul class="list feed">' + pub.feed.map((f) => '<li><time>' + kl(f.tid) + '</time><span>' + (f.type === 'afsloeret' ? '🔍 <b>' + esc(f.offer) + '</b> blev afsløret og er ude' + (f.draeber ? ' <span class="muted">– af ' + esc(f.draeber) + '</span>' : '') : '☠️ <b>' + esc(f.offer) + '</b> er død' + (f.draeber ? ' <span class="muted">– dræbt af ' + esc(f.draeber) + '</span>' : '')) + '</span></li>').join('') + '</ul>' : '<p class="muted" style="margin:0">Ingen drab endnu …</p>') + '</div>';
    if (pub.missionResultat) h += '<div class="card"><h3>Missioner</h3><ul class="list">' + pub.missionResultat.map((p) => '<li><span>' + esc(p.navn) + '</span><span class="chip gold">' + p.point + '</span></li>').join('') + '</ul></div>';
    h += '<div style="text-align:center;margin-top:16px"><button class="link" data-act="logud">Log ud</button> · <button class="link" data-act="admin">Admin</button></div>';
    return h;
  }

  /* --- Admin --- */
  function vAdminLogin() {
    return '<div class="wrap"><div class="top"><h1>Admin</h1><button class="btn sm ghost" data-act="tilbage">Tilbage</button></div>' +
      '<div class="card" style="margin-top:16px"><label class="muted small">Admin-kode</label><input type="number" inputmode="numeric" id="adminpin" style="width:100%;margin:6px 0 12px"><button class="btn pri full" data-act="adminlogin">Log ind</button>' +
      (pinFejl ? '<div class="err">' + esc(pinFejl) + '</div>' : '') + '</div></div>';
  }
  function vAdmin() {
    const f = pub.faser;
    const sw = (k, t, sub) => '<div class="toggle"><div><b>' + t + '</b><div class="muted small">' + sub + '</div></div><button class="sw ' + (f[k] ? 'on' : '') + '" data-act="fase" data-k="' + k + '" aria-label="' + t + '"></button></div>';
    return '<div class="wrap admin"><div class="top"><h1>Admin</h1><button class="btn sm ghost" data-act="tilbage">Til spillet</button></div>' +
      '<h2>Spillere</h2><div class="card"><div class="names">' + pub.spillere.map((s, i) => '<input type="text" maxlength="24" data-navn="' + i + '" value="' + esc(s.navn) + '">').join('') + '</div><div style="height:10px"></div><button class="btn pri full" data-act="gemnavne">Gem navne</button></div>' +
      '<h2>Start legene</h2><div class="card"><p class="muted small" style="margin-top:0">Trækker mordleg-sedler og 3 missioner til hver spiller. Alt er tilfældigt, og du kan heller ikke se de andres.</p>' +
      '<button class="btn pri full" data-act="traek">' + (pub.trukket ? 'Træk forfra (nulstiller mord og missioner)' : 'Træk sedler og missioner') + '</button>' +
      '<div style="height:8px"></div><button class="btn full" data-act="fortryd">Fortryd sidste drab</button></div>' +
      '<h2>Faser</h2><div class="card">' +
      sw('oelAaben', 'Åbn øl-smagning', 'Så kan alle udfylde deres øl-ark') +
      sw('oelAfsloeret', 'Afslør øl-resultat', 'Ølkongen og Ølsnuden vises for alle') +
      sw('missionerAfsloeret', 'Afslør missioner', 'Alle missioner og point vises') +
      sw('mordAfsloeret', 'Afslør mordlegen', 'Hvem dræbte hvem vises') +
      '<label>Antal øl i smagningen</label><div class="row"><input type="number" min="2" max="20" id="antaloel" value="' + pub.antalOel + '" style="width:90px"><button class="btn sm" data-act="antaloel">Gem</button></div></div>' +
      '<h2>Hjælp</h2><div class="card"><label>Nulstil kode for en spiller</label><div class="row"><select id="nulstilid" style="flex:1">' + pub.spillere.map((s) => '<option value="' + s.id + '">' + esc(s.navn) + '</option>').join('') + '</select><button class="btn sm" data-act="nulstilkode">Nulstil</button></div>' +
      '<div style="height:14px"></div><button class="btn danger full" data-act="nulstilalt">Nulstil alt (navne beholdes)</button></div>' +
      '<div style="text-align:center;margin-top:12px"><button class="link" data-act="adminlogud">Log ud af admin</button></div></div>';
  }

  /* ---------- Handlinger ---------- */
  function bekraeft(titel, tekst, knap, handling) {
    bekraeft.handling = handling;
    modal('<h3>' + titel + '</h3><p class="muted" style="margin:6px 0 0">' + tekst + '</p><div class="row"><button class="btn ghost" data-act="lukmodal">Annullér</button><button class="btn danger" data-act="okmodal">' + knap + '</button></div>');
  }
  async function gemOel() {
    try { await api('/api/oel', 'POST', oelKladde); } catch (e) { toast(e.message); }
  }
  function planlaegOelGem() { clearTimeout(oelGemTimer); oelGemTimer = setTimeout(gemOel, 500); }

  document.addEventListener('click', async (e) => {
    if (e.target.closest('[data-stop]') && !e.target.closest('[data-act]')) return;
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const a = t.dataset.act;
    if (skriverNu()) document.activeElement.blur();
    try {
      if (a === 'lukmodal') { if (e.target.closest('[data-stop]') && t.classList.contains('bg')) return; modal(''); return; }
      if (a === 'okmodal') { const h = bekraeft.handling; modal(''); if (h) await h(); return; }
      if (a === 'vaelg') { pinSpiller = +t.dataset.id; pinTast = ''; pinFejl = ''; skaerm = 'pin'; tegn(); return; }
      if (a === 'tilbage') { skaerm = mig ? 'spil' : 'login'; pinFejl = ''; tegn(); return; }
      if (a === 'tast') {
        if (t.dataset.k === '⌫') pinTast = pinTast.slice(0, -1);
        else if (pinTast.length < 4) pinTast += t.dataset.k;
        pinFejl = '';
        tegn();
        if (pinTast.length === 4) {
          try {
            const r = await api('/api/login', 'POST', { id: pinSpiller, pin: pinTast });
            token = r.token; ls.set(LS.token, token); oelKladde = null; vis = { seddel: false, missioner: false };
            skaerm = 'spil'; await hent();
          } catch (err) { pinFejl = err.message; pinTast = ''; tegn(); }
        }
        return;
      }
      if (a === 'fane') { fane = t.dataset.f; ls.set(LS.fane, fane); vis = { seddel: false, missioner: false }; tegn(); window.scrollTo(0, 0); return; }
      if (a === 'visseddel') { vis.seddel = true; tegn(); return; }
      if (a === 'skjulseddel') { vis.seddel = false; tegn(); return; }
      if (a === 'vismissioner') { vis.missioner = true; tegn(); return; }
      if (a === 'skjulmissioner') { vis.missioner = false; tegn(); return; }
      if (a === 'doed') {
        bekraeft('Er du blevet dræbt?', 'Din seddel går videre til din drabsmand, og det kan kun Kris fortryde.', '☠️ Ja, jeg er død', async () => {
          await api('/api/mord/doed', 'POST', {}); toast('RIP'); await hent();
        });
        return;
      }
      if (a === 'afsloer') {
        const levende = pub.spillere.filter((s) => s.id !== mig.id && !s.doed);
        modal('<h3>Hvem jagter dig?</h3><p class="muted small" style="margin:6px 0 10px">Du har kun ét forsøg, så vælg med omhu.</p><div class="grid-names">' +
          levende.map((s) => '<button class="btn" data-act="afsloervalg" data-id="' + s.id + '">' + esc(s.navn) + '</button>').join('') +
          '</div><div class="row"><button class="btn ghost" data-act="lukmodal">Annullér</button></div>');
        return;
      }
      if (a === 'afsloervalg') {
        const id = +t.dataset.id, n = (pub.spillere.find((s) => s.id === id) || {}).navn;
        bekraeft('Afslør ' + esc(n) + '?', 'Er du sikker på, at ' + esc(n) + ' jagter dig? Det er dit eneste forsøg.', '🔍 Afslør', async () => {
          const r = await api('/api/mord/afsloer', 'POST', { mistaenkt: id });
          await hent();
          modal(r.rigtigt
            ? '<div style="text-align:center"><div style="font-size:44px">🎯</div><h3>Rigtigt!</h3><p class="muted">' + esc(r.navn) + ' jagtede dig og er nu ude. Du får drabet.</p></div><div class="row"><button class="btn pri" data-act="lukmodal">Fedt</button></div>'
            : '<div style="text-align:center"><div style="font-size:44px">🍺</div><h3>Forkert!</h3><p class="muted">' + esc(r.navn) + ' jagter dig ikke. Dit forsøg er brugt, så du skal drikke.</p></div><div class="row"><button class="btn pri" data-act="lukmodal">Skål</button></div>');
        });
        return;
      }
      if (a === 'mklaret' || a === 'maktiv') { await api('/api/mission', 'POST', { idx: +t.dataset.i, status: a === 'mklaret' ? 'klaret' : 'aktiv' }); await hent(); return; }
      if (a === 'mbraendt') {
        const i = +t.dataset.i;
        const andre = pub.spillere.filter((s) => s.id !== mig.id);
        modal('<h3>Hvem afslørede missionen?</h3><p class="muted small" style="margin:6px 0 10px">Personen får 1 point.</p><div class="grid-names">' +
          andre.map((s) => '<button class="btn" data-act="afsloeret" data-i="' + i + '" data-id="' + s.id + '">' + esc(s.navn) + '</button>').join('') +
          '</div><div class="row"><button class="btn ghost" data-act="lukmodal">Annullér</button></div>');
        return;
      }
      if (a === 'afsloeret') { modal(''); await api('/api/mission', 'POST', { idx: +t.dataset.i, status: 'braendt', afsloeretAf: +t.dataset.id }); toast('Mission brændt'); await hent(); return; }
      if (a === 'point') {
        const nr = +t.dataset.nr, p = +t.dataset.p;
        oelKladde.vurderinger[nr] = Object.assign({ gaet: null }, oelKladde.vurderinger[nr], { point: p });
        tegn(); planlaegOelGem(); return;
      }
      if (a === 'logud') { token = null; ls.set(LS.token, null); mig = null; oelKladde = null; skaerm = 'login'; tegn(); return; }
      if (a === 'admin') { pinFejl = ''; skaerm = adminToken ? 'admin' : 'admin-login'; if (adminToken) { try { await api('/api/admin/status', 'GET', null, true); } catch (err) { adminToken = null; ls.set(LS.admin, null); skaerm = 'admin-login'; } } tegn(); return; }
      if (a === 'adminlogin') {
        try { const r = await api('/api/admin/login', 'POST', { pin: $('#adminpin').value }); adminToken = r.token; ls.set(LS.admin, adminToken); skaerm = 'admin'; pinFejl = ''; }
        catch (err) { pinFejl = err.message; }
        tegn(); return;
      }
      if (a === 'adminlogud') { adminToken = null; ls.set(LS.admin, null); skaerm = mig ? 'spil' : 'login'; tegn(); return; }
      if (a === 'gemnavne') { const navne = [...document.querySelectorAll('[data-navn]')].map((i) => i.value); await api('/api/admin/navne', 'POST', { navne }, true); toast('Navne gemt'); await hent(); return; }
      if (a === 'traek') {
        bekraeft(pub.trukket ? 'Træk forfra?' : 'Træk sedler?', pub.trukket ? 'Alle drab og missioner nulstilles, og alle får nye sedler.' : 'Alle får en mordleg-seddel og 3 missioner.', 'Træk', async () => {
          await api('/api/admin/traek', 'POST', {}, true); toast('Sedlerne er trukket'); await hent();
        });
        return;
      }
      if (a === 'fortryd') { await api('/api/admin/fortryd-drab', 'POST', {}, true); toast('Sidste drab fortrudt'); await hent(); return; }
      if (a === 'fase') { await api('/api/admin/fase', 'POST', { noegle: t.dataset.k, vaerdi: !pub.faser[t.dataset.k] }, true); await hent(); return; }
      if (a === 'antaloel') { await api('/api/admin/antal-oel', 'POST', { antal: +$('#antaloel').value }, true); toast('Gemt'); await hent(); return; }
      if (a === 'nulstilkode') { await api('/api/admin/nulstil-kode', 'POST', { id: +$('#nulstilid').value }, true); toast('Koden er nulstillet'); await hent(); return; }
      if (a === 'nulstilalt') {
        bekraeft('Nulstil alt?', 'Koder, sedler, drab, missioner og øl-ark slettes. Navnene beholdes.', 'Nulstil', async () => {
          await api('/api/admin/nulstil-alt', 'POST', {}, true); token = null; ls.set(LS.token, null); mig = null; oelKladde = null; toast('Alt er nulstillet'); await hent();
        });
        return;
      }
    } catch (err) {
      if (err.status === 401 && a !== 'adminlogin') {
        if (skaerm === 'admin') { adminToken = null; ls.set(LS.admin, null); skaerm = 'admin-login'; tegn(); }
      }
      toast(err.message);
    }
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.oel === 'mitnr') {
      oelKladde.mitNr = t.value ? +t.value : null;
      if (oelKladde.mitNr) delete oelKladde.vurderinger[oelKladde.mitNr];
      tegn(); planlaegOelGem();
    } else if (t.dataset.oel === 'gaet') {
      const nr = +t.dataset.nr;
      oelKladde.vurderinger[nr] = Object.assign({ point: null }, oelKladde.vurderinger[nr], { gaet: t.value === '' ? null : +t.value });
      planlaegOelGem();
    }
  });

  /* ---------- Live-opdatering ---------- */
  try {
    const socket = io();
    socket.on('opdatering', () => { clearTimeout(hent.t); hent.t = setTimeout(hent, 150); });
    socket.on('connect', hent);
  } catch (e) { setInterval(hent, 5000); }
  hent();
})();
