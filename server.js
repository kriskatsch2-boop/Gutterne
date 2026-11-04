// Gutterdag – mordleg, hemmelige missioner og mystery-øl
// Express + Socket.IO + PostgreSQL (Railway). Uden DATABASE_URL gemmes der i en lokal fil.

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Server } = require('socket.io');
const data = require('./data');

const PORT = process.env.PORT || 3000;
const ADMIN_PIN = String(process.env.ADMIN_PIN || '1234');
const ANTAL_SPILLERE = 7;

/* ---------- Tilstand ---------- */
function nyTilstand(navne) {
  return {
    spillere: (navne || ['Kris', 'Spiller 2', 'Spiller 3', 'Spiller 4', 'Spiller 5', 'Spiller 6', 'Spiller 7'])
      .map((navn, id) => ({ id, navn, pinHash: null, salt: null })),
    tokens: {},          // token -> spiller-id
    adminTokens: [],
    trukket: false,
    mord: { sedler: {}, doed: {}, drab: {}, log: [], vinder: null, forsoeg: {} },
    mordHistorik: [],    // til "fortryd sidste drab"
    missioner: {},       // id -> [{ tekst, status, afsloeretAf }]
    oel: {},             // id -> { mitNr, vurderinger: { nr: { point, gaet } } }
    antalOel: ANTAL_SPILLERE,
    faser: { oelAaben: false, oelAfsloeret: false, missionerAfsloeret: false, mordAfsloeret: false },
  };
}
let tilstand = nyTilstand();

/* ---------- Lagring ---------- */
let pool = null;
const FIL = path.join(__dirname, 'gemt-tilstand.json');
async function indlaes() {
  if (process.env.DATABASE_URL) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
    });
    await pool.query('CREATE TABLE IF NOT EXISTS gutterdag_tilstand (id INT PRIMARY KEY, data JSONB NOT NULL)');
    const r = await pool.query('SELECT data FROM gutterdag_tilstand WHERE id = 1');
    if (r.rows[0]) tilstand = Object.assign(nyTilstand(), r.rows[0].data);
    console.log('Tilstand indlæst fra PostgreSQL');
  } else if (fs.existsSync(FIL)) {
    tilstand = Object.assign(nyTilstand(), JSON.parse(fs.readFileSync(FIL, 'utf8')));
    console.log('Tilstand indlæst fra fil');
  }
}
let gemKoe = Promise.resolve();
function gem() {
  const snapshot = JSON.stringify(tilstand);
  gemKoe = gemKoe.then(async () => {
    if (pool) {
      await pool.query(
        'INSERT INTO gutterdag_tilstand (id, data) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data',
        [snapshot]
      );
    } else {
      fs.writeFileSync(FIL, snapshot);
    }
  }).catch((e) => console.error('Kunne ikke gemme:', e.message));
  io.emit('opdatering');
}

/* ---------- Hjælpere ---------- */
const bland = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const hashPin = (pin, salt) => crypto.scryptSync(String(pin), salt, 32).toString('hex');
const navn = (id) => (tilstand.spillere[id] ? tilstand.spillere[id].navn : '?');
const nytToken = () => crypto.randomBytes(24).toString('hex');
// Missionstekst med navnet indsat (navnet slås op ved visning, så omdøbning virker)
const genitiv = (n) => (/[sxz]$/i.test(n) ? n + "'" : n + 's');   // Jonas' / Mads' / Emils
const missionTekst = (m) => {
  const n = m.personId === null || m.personId === undefined ? 'en anden' : navn(m.personId);
  return m.tekst.replace(/\{persons\}/g, genitiv(n)).replace(/\{person\}/g, n);
};

function spillerFraReq(req) {
  const t = req.get('x-token');
  return t && tilstand.tokens[t] !== undefined ? tilstand.tokens[t] : null;
}
function kraevSpiller(req, res, next) {
  const id = spillerFraReq(req);
  if (id === null) return res.status(401).json({ fejl: 'Log ind igen' });
  req.spillerId = id;
  next();
}
function kraevAdmin(req, res, next) {
  const t = req.get('x-admin');
  if (!t || !tilstand.adminTokens.includes(t)) return res.status(401).json({ fejl: 'Kun for admin' });
  next();
}

/* ---------- Træk mordleg og missioner ---------- */
function traek() {
  const ids = tilstand.spillere.map((s) => s.id);
  const kaede = bland(ids);              // én lang kæde: A -> B -> ... -> A
  const tingListe = bland(data.ting);
  const stedListe = bland(data.steder);
  const sedler = {};
  kaede.forEach((id, i) => {
    sedler[id] = {
      offer: kaede[(i + 1) % kaede.length],
      ting: tingListe[i % tingListe.length],
      sted: stedListe[i % stedListe.length],
    };
  });
  tilstand.mord = { sedler, doed: {}, drab: {}, log: [], vinder: null, forsoeg: {} };
  tilstand.mordHistorik = [];

  const pulje = bland(data.missioner);
  tilstand.missioner = {};
  ids.forEach((id, i) => {
    const andre = ids.filter((x) => x !== id);
    tilstand.missioner[id] = pulje.slice(i * 3, i * 3 + 3).map((tekst) => ({
      tekst,
      personId: tekst.includes('{person') ? andre[crypto.randomInt(andre.length)] : null,
      status: 'aktiv', afsloeretAf: null,
    }));
  });
  tilstand.trukket = true;
}

/* ---------- Resultater ---------- */
function missionResultat() {
  const afsl = {};
  Object.values(tilstand.missioner).forEach((liste) =>
    liste.forEach((m) => { if (m.status === 'braendt' && m.afsloeretAf !== null) afsl[m.afsloeretAf] = (afsl[m.afsloeretAf] || 0) + 1; })
  );
  return tilstand.spillere.map((s) => {
    const liste = tilstand.missioner[s.id] || [];
    const klaret = liste.filter((m) => m.status === 'klaret').length;
    return {
      id: s.id, navn: s.navn, klaret, afsloeringer: afsl[s.id] || 0,
      point: klaret + (afsl[s.id] || 0),
      missioner: liste.map((m) => ({ tekst: missionTekst(m), status: m.status, afsloeretAf: m.afsloeretAf === null ? null : navn(m.afsloeretAf) })),
    };
  }).sort((a, b) => b.point - a.point);
}

function oelResultat() {
  const ejere = {};  // nr -> [ids]
  Object.entries(tilstand.oel).forEach(([id, o]) => {
    if (o.mitNr) (ejere[o.mitNr] = ejere[o.mitNr] || []).push(Number(id));
  });
  const oelListe = [];
  for (let nr = 1; nr <= tilstand.antalOel; nr++) {
    const ej = ejere[nr] || [];
    const point = [];
    Object.entries(tilstand.oel).forEach(([id, o]) => {
      if (ej.includes(Number(id))) return;
      const v = o.vurderinger && o.vurderinger[nr];
      if (v && Number.isFinite(v.point)) point.push(v.point);
    });
    const snit = point.length ? point.reduce((a, b) => a + b, 0) / point.length : null;
    oelListe.push({ nr, ejere: ej.map(navn), snit: snit === null ? null : Math.round(snit * 10) / 10, antal: point.length });
  }
  const snuder = tilstand.spillere.map((s) => {
    const o = tilstand.oel[s.id];
    let rigtige = 0;
    if (o && o.vurderinger) {
      Object.entries(o.vurderinger).forEach(([nr, v]) => {
        if (Number(nr) === o.mitNr) return;
        if (v.gaet !== null && v.gaet !== undefined && (ejere[nr] || []).includes(Number(v.gaet))) rigtige++;
      });
    }
    return { navn: s.navn, rigtige };
  }).sort((a, b) => b.rigtige - a.rigtige);
  const rangeret = oelListe.filter((o) => o.snit !== null).sort((a, b) => b.snit - a.snit);
  return { oel: rangeret.concat(oelListe.filter((o) => o.snit === null)), snuder };
}

function mordResultat() {
  const m = tilstand.mord;
  return {
    vinder: m.vinder === null ? null : navn(m.vinder),
    drab: tilstand.spillere.map((s) => ({ navn: s.navn, drab: m.drab[s.id] || 0, doed: !!m.doed[s.id] }))
      .sort((a, b) => b.drab - a.drab),
    log: m.log.map((l) => ({ tid: l.tid, draeber: navn(l.draeber), offer: navn(l.offer), type: l.type || 'drab' })),
  };
}

/* ---------- App ---------- */
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Offentlig status – ingen hemmeligheder
app.get('/api/offentlig', (req, res) => {
  const m = tilstand.mord;
  const levende = tilstand.spillere.filter((s) => !m.doed[s.id]).length;
  const mordSlut = m.vinder !== null || tilstand.faser.mordAfsloeret;
  res.json({
    spillere: tilstand.spillere.map((s) => ({ id: s.id, navn: s.navn, harPin: !!s.pinHash, doed: !!m.doed[s.id] })),
    trukket: tilstand.trukket,
    faser: tilstand.faser,
    antalOel: tilstand.antalOel,
    levende,
    feed: m.log.slice().reverse().map((l) => ({ tid: l.tid, offer: navn(l.offer), type: l.type || 'drab', draeber: mordSlut ? navn(l.draeber) : null })),
    mord: mordSlut ? mordResultat() : null,
    missionResultat: tilstand.faser.missionerAfsloeret ? missionResultat() : null,
    oelResultat: tilstand.faser.oelAfsloeret ? oelResultat() : null,
    oelIndsendt: tilstand.spillere.map((s) => {
      const o = tilstand.oel[s.id];
      return { navn: s.navn, faerdig: !!(o && o.mitNr && Object.keys(o.vurderinger || {}).length >= tilstand.antalOel - 1) };
    }),
  });
});

// Log ind: første gang vælger man selv en kode på 4 cifre
app.post('/api/login', (req, res) => {
  const { id, pin } = req.body || {};
  const s = tilstand.spillere[id];
  if (!s) return res.status(400).json({ fejl: 'Ukendt spiller' });
  if (!/^\d{4}$/.test(String(pin || ''))) return res.status(400).json({ fejl: 'Koden skal være 4 cifre' });
  if (!s.pinHash) {
    s.salt = crypto.randomBytes(8).toString('hex');
    s.pinHash = hashPin(pin, s.salt);
  } else if (hashPin(pin, s.salt) !== s.pinHash) {
    return res.status(403).json({ fejl: 'Forkert kode' });
  }
  const token = nytToken();
  tilstand.tokens[token] = s.id;
  gem();
  res.json({ token, id: s.id, navn: s.navn });
});

// Min hemmelige side
app.get('/api/mig', kraevSpiller, (req, res) => {
  const id = req.spillerId;
  const m = tilstand.mord;
  const seddel = m.sedler[id];
  res.json({
    id, navn: navn(id), trukket: tilstand.trukket,
    mord: {
      doed: !!m.doed[id],
      vinder: m.vinder === id,
      drab: m.drab[id] || 0,
      forsoegTilbage: Math.max(0, AFSLOERINGS_FORSOEG - ((m.forsoeg || {})[id] || 0)),
      seddel: seddel && !m.doed[id] ? { offer: navn(seddel.offer), ting: seddel.ting, sted: seddel.sted } : null,
    },
    missioner: (tilstand.missioner[id] || []).map((x) => ({ tekst: missionTekst(x), status: x.status, afsloeretAf: x.afsloeretAf })),
    oel: tilstand.oel[id] || { mitNr: null, vurderinger: {} },
  });
});

// Jeg er blevet dræbt – offeret trykker selv, og sedlen går videre til drabsmanden
// Fælles: 'offer' er ude. Den, der jagtede offeret, arver sedlen. 'kredit' får drabet.
function slaaUd(offer, kredit, type) {
  const m = tilstand.mord;
  const arving = Object.keys(m.sedler).map(Number).find((k) => !m.doed[k] && m.sedler[k] && m.sedler[k].offer === offer);
  if (arving === undefined) return false;
  tilstand.mordHistorik.push(JSON.stringify(m));
  m.sedler[arving] = m.sedler[offer];
  m.sedler[offer] = null;
  m.doed[offer] = true;
  m.drab[kredit] = (m.drab[kredit] || 0) + 1;
  m.log.push({ tid: Date.now(), draeber: kredit, offer, type });
  if (m.sedler[arving] && m.sedler[arving].offer === arving) { m.vinder = arving; m.sedler[arving] = null; }
  return true;
}
function mordAktiv(id, res) {
  const m = tilstand.mord;
  if (!tilstand.trukket) { res.status(400).json({ fejl: 'Legen er ikke startet' }); return false; }
  if (m.vinder !== null) { res.status(400).json({ fejl: 'Mordlegen er slut' }); return false; }
  if (m.doed[id]) { res.status(400).json({ fejl: 'Du er allerede død' }); return false; }
  return true;
}

// Jeg er blevet dræbt – offeret trykker selv, og sedlen går videre til drabsmanden
app.post('/api/mord/doed', kraevSpiller, (req, res) => {
  const offer = req.spillerId;
  if (!mordAktiv(offer, res)) return;
  const m = tilstand.mord;
  const draeber = Object.keys(m.sedler).map(Number).find((k) => !m.doed[k] && m.sedler[k] && m.sedler[k].offer === offer);
  if (draeber === undefined) return res.status(400).json({ fejl: 'Fandt ingen drabsmand' });
  slaaUd(offer, draeber, 'drab');
  gem();
  res.json({ ok: true });
});

// Afslør din jæger: ét forsøg pr. spiller. Rigtigt = jægeren er ude, og du får drabet.
const AFSLOERINGS_FORSOEG = 1;
app.post('/api/mord/afsloer', kraevSpiller, (req, res) => {
  const id = req.spillerId;
  if (!mordAktiv(id, res)) return;
  const m = tilstand.mord;
  m.forsoeg = m.forsoeg || {};
  if ((m.forsoeg[id] || 0) >= AFSLOERINGS_FORSOEG) return res.status(400).json({ fejl: 'Du har brugt dit forsøg' });
  const mistaenkt = Number((req.body || {}).mistaenkt);
  if (!tilstand.spillere[mistaenkt] || mistaenkt === id || m.doed[mistaenkt]) return res.status(400).json({ fejl: 'Vælg en spiller, der er i live' });
  const jaeger = Object.keys(m.sedler).map(Number).find((k) => !m.doed[k] && m.sedler[k] && m.sedler[k].offer === id);
  if (mistaenkt === jaeger) {
    slaaUd(jaeger, id, 'afsloeret');
    m.forsoeg[id] = (m.forsoeg[id] || 0) + 1;
    gem();
    return res.json({ rigtigt: true, navn: navn(jaeger) });
  }
  tilstand.mordHistorik.push(JSON.stringify(m));
  m.forsoeg[id] = (m.forsoeg[id] || 0) + 1;
  gem();
  res.json({ rigtigt: false, navn: navn(mistaenkt) });
});

// Opdater en mission: aktiv / klaret / braendt (+ hvem der afslørede den)
app.post('/api/mission', kraevSpiller, (req, res) => {
  const { idx, status, afsloeretAf } = req.body || {};
  const liste = tilstand.missioner[req.spillerId] || [];
  const ms = liste[idx];
  if (!ms) return res.status(400).json({ fejl: 'Ukendt mission' });
  if (tilstand.faser.missionerAfsloeret) return res.status(400).json({ fejl: 'Missionerne er afsløret' });
  if (!['aktiv', 'klaret', 'braendt'].includes(status)) return res.status(400).json({ fejl: 'Ukendt status' });
  ms.status = status;
  ms.afsloeretAf = status === 'braendt' && tilstand.spillere[afsloeretAf] && afsloeretAf !== req.spillerId ? afsloeretAf : null;
  gem();
  res.json({ ok: true });
});

// Mystery-øl: mit nummer + point og gæt
app.post('/api/oel', kraevSpiller, (req, res) => {
  if (!tilstand.faser.oelAaben || tilstand.faser.oelAfsloeret) return res.status(400).json({ fejl: 'Smagningen er ikke åben' });
  const { mitNr, vurderinger } = req.body || {};
  const n = tilstand.antalOel;
  const ren = {};
  Object.entries(vurderinger || {}).forEach(([nr, v]) => {
    const k = Number(nr);
    if (k < 1 || k > n || k === mitNr) return;
    const point = Number.isFinite(v.point) ? Math.max(1, Math.min(10, Math.round(v.point))) : null;
    const gaet = tilstand.spillere[v.gaet] ? v.gaet : null;
    ren[k] = { point, gaet };
  });
  tilstand.oel[req.spillerId] = { mitNr: Number.isInteger(mitNr) && mitNr >= 1 && mitNr <= n ? mitNr : null, vurderinger: ren };
  gem();
  res.json({ ok: true });
});

/* ---------- Admin ---------- */
app.post('/api/admin/login', (req, res) => {
  if (String((req.body || {}).pin) !== ADMIN_PIN) return res.status(403).json({ fejl: 'Forkert admin-kode' });
  const t = nytToken();
  tilstand.adminTokens.push(t);
  gem();
  res.json({ token: t });
});
app.get('/api/admin/status', kraevAdmin, (req, res) => res.json({ ok: true }));
app.post('/api/admin/navne', kraevAdmin, (req, res) => {
  const navne = (req.body || {}).navne;
  if (!Array.isArray(navne) || navne.length !== ANTAL_SPILLERE) return res.status(400).json({ fejl: 'Der skal være 7 navne' });
  navne.forEach((n, i) => { tilstand.spillere[i].navn = String(n).trim().slice(0, 24) || 'Spiller ' + (i + 1); });
  gem();
  res.json({ ok: true });
});
app.post('/api/admin/traek', kraevAdmin, (req, res) => { traek(); gem(); res.json({ ok: true }); });
app.post('/api/admin/fase', kraevAdmin, (req, res) => {
  const { noegle, vaerdi } = req.body || {};
  if (!(noegle in tilstand.faser)) return res.status(400).json({ fejl: 'Ukendt fase' });
  tilstand.faser[noegle] = !!vaerdi;
  gem();
  res.json({ ok: true });
});
app.post('/api/admin/antal-oel', kraevAdmin, (req, res) => {
  const n = parseInt((req.body || {}).antal, 10);
  if (!(n >= 2 && n <= 20)) return res.status(400).json({ fejl: 'Mellem 2 og 20' });
  tilstand.antalOel = n;
  gem();
  res.json({ ok: true });
});
app.post('/api/admin/nulstil-kode', kraevAdmin, (req, res) => {
  const s = tilstand.spillere[(req.body || {}).id];
  if (!s) return res.status(400).json({ fejl: 'Ukendt spiller' });
  s.pinHash = null; s.salt = null;
  Object.keys(tilstand.tokens).forEach((t) => { if (tilstand.tokens[t] === s.id) delete tilstand.tokens[t]; });
  gem();
  res.json({ ok: true });
});
app.post('/api/admin/fortryd-drab', kraevAdmin, (req, res) => {
  const forrige = tilstand.mordHistorik.pop();
  if (!forrige) return res.status(400).json({ fejl: 'Intet at fortryde' });
  tilstand.mord = JSON.parse(forrige);
  gem();
  res.json({ ok: true });
});
app.post('/api/admin/nulstil-alt', kraevAdmin, (req, res) => {
  const navne = tilstand.spillere.map((s) => s.navn);
  const adm = tilstand.adminTokens;
  tilstand = nyTilstand(navne);
  tilstand.adminTokens = adm;
  gem();
  res.json({ ok: true });
});

app.get('/health', (req, res) => res.send('ok'));

indlaes().then(() => {
  server.listen(PORT, () => console.log('Gutterdag kører på port ' + PORT));
}).catch((e) => { console.error('Kunne ikke starte:', e); process.exit(1); });
