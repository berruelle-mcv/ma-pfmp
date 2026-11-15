// Dossier de PFMP en PDF, fabriqué dans le navigateur (pdfmake) : identique sur téléphone, tablette et ordinateur.
// Mise en page validée le 15/11/2026 (maquette) : page de garde, sommaire, chiffres, ouvertures de parties, cadres.
import { etat } from './app.js';
import { donneesImage } from './api.js';
import { FICHE_IDENTITE, TRAME_MISSION, MODES, CHAMPS_BILAN, NIV_AUTO, CHAMPS_CONCURRENT, texteIntroduction } from './rubriques.js';
import { MOMENTS, MOTIFS } from './ui.js';

const NAVY = '#0C3274'; const CLAIR = '#E9EEF7'; const TRAIT = '#C5D0E3'; const GRIS = '#6B7280'; const ORANGE = '#D9661F';
const LARGEUR = 495; // largeur utile d'une page A4 avec des marges de 50

// ---------------------------------------------------------------- Chargement de l'outil PDF (seulement au premier téléchargement)
let chargement = null;
const script = (src) => new Promise((ok, ko) => {
  const s = document.createElement('script');
  s.src = src; s.onload = ok;
  s.onerror = () => ko(new Error('Impossible de charger l’outil PDF. Vérifie ta connexion puis réessaie.'));
  document.head.appendChild(s);
});
async function pdfMake() {
  if (!chargement) chargement = script('lib/pdfmake.min.js').then(() => script('lib/vfs_fonts.js')).catch((e) => { chargement = null; throw e; });
  await chargement;
  return window.pdfMake;
}
const enDataUrl = (blob) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(blob); });

// ---------------------------------------------------------------- Petites briques de mise en page
const plein = (v) => (typeof v === 'string' ? v.trim() !== '' : !!v);
const cadre = {
  hLineColor: () => TRAIT, vLineColor: () => TRAIT, hLineWidth: () => 0.8, vLineWidth: () => 0.8,
  paddingLeft: () => 9, paddingRight: () => 9, paddingTop: () => 7, paddingBottom: () => 8,
};
const champ = (q, r) => ({ stack: [{ text: q, style: 'q' }, typeof r === 'string' ? { text: r.trim(), style: 'r' } : r] });
const boite = (q, r, opts = {}) => (plein(r) ? { table: { widths: ['*'], body: [[champ(q, r)]] }, layout: { ...cadre, ...(opts.fond ? { fillColor: () => opts.fond } : {}) }, margin: [0, 0, 0, 8] } : null);
function deux(a, b) {
  const pa = plein(a[1]); const pb = plein(b[1]);
  if (pa && pb) return { table: { widths: ['*', '*'], body: [[champ(...a), champ(...b)]] }, layout: cadre, margin: [0, 0, 0, 8] };
  if (pa) return boite(...a);
  if (pb) return boite(...b);
  return null;
}
const nonComplete = { text: 'Partie non complétée.', italics: true, color: GRIS, margin: [0, 0, 0, 8] };

function titreRubrique(num, titre) {
  return {
    table: { widths: ['*'], body: [[{ text: `${num}  ${titre}`, color: '#fff', bold: true, fontSize: 14, margin: [0, 5, 0, 5], tocItem: true, tocMargin: [14, 2, 0, 0], tocStyle: { fontSize: 10.5 } }]] },
    layout: { fillColor: () => NAVY, hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 10, paddingRight: () => 10 },
    margin: [0, 0, 0, 12],
    pageBreak: 'before',
  };
}

function ouverture(num, titre, phrase) {
  return [
    { text: '', pageBreak: 'before' },
    { canvas: [{ type: 'rect', x: 0, y: 0, w: LARGEUR, h: 6, color: NAVY }], margin: [0, 170, 0, 30] },
    { text: String(num), fontSize: 90, bold: true, color: '#C9D5EA', margin: [0, 0, 0, -30] },
    { text: titre, fontSize: 30, bold: true, color: NAVY, tocItem: true, tocStyle: { bold: true, fontSize: 11.5, color: NAVY }, tocMargin: [0, 8, 0, 0] },
    { text: phrase, fontSize: 13, color: GRIS, margin: [0, 12, 0, 0], lineHeight: 1.3 },
    { canvas: [{ type: 'rect', x: 0, y: 0, w: 60, h: 4, color: ORANGE }], margin: [0, 26, 0, 0] },
  ];
}

const pastille = (texte, couleur = NAVY) => ({
  table: { body: [[{ text: texte, color: '#fff', bold: true, fontSize: 9 }]] },
  layout: { fillColor: () => couleur, hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 2, paddingBottom: () => 2 },
});
const coche = () => ({ canvas: [{ type: 'polyline', points: [{ x: 0, y: 5 }, { x: 4, y: 9 }, { x: 11, y: 0 }], lineWidth: 2, lineColor: NAVY }], margin: [11, 3, 0, 0] });

// Images : une, deux ou trois côte à côte, avec leur légende.
function rangeeImages(liste) {
  if (!liste.length) return null;
  const n = liste.length;
  const l = n === 1 ? 300 : n === 2 ? 235 : 152;
  const h = n === 1 ? 210 : n === 2 ? 150 : 120;
  return {
    unbreakable: true,
    columns: liste.map((im) => ({ stack: [
      { image: im.data, fit: [l, h], alignment: 'center' },
      ...(im.legende ? [{ text: im.legende, style: 'legende', alignment: 'center', margin: [0, 4, 0, 0] }] : []),
    ] })),
    columnGap: 12,
    margin: [0, 6, 0, 10],
  };
}

// ---------------------------------------------------------------- Organigramme dessiné sur un canevas (puis inséré comme image)
function organigrammeImage(noeuds) {
  if (!noeuds.length) return null;
  const L = 170; const H = 50; const EH = 26; const EV = 46; const S = 2;
  const enfants = (id) => noeuds.filter((n) => (n.parent || null) === id);
  const pos = new Map();
  let x = 0;
  const placer = (n, prof) => {
    const e = enfants(n.id);
    if (!e.length) { pos.set(n.id, { x, y: prof }); x += L + EH; return; }
    e.forEach((c) => placer(c, prof + 1));
    const xs = e.map((c) => pos.get(c.id).x);
    pos.set(n.id, { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: prof });
  };
  enfants(null).forEach((r) => placer(r, 0));
  const largeur = Math.max(L, x - EH); const hauteur = (Math.max(...[...pos.values()].map((p) => p.y)) + 1) * (H + EV) - EV;
  const c = document.createElement('canvas');
  c.width = (largeur + 20) * S; c.height = (hauteur + 20) * S;
  const g = c.getContext('2d');
  g.scale(S, S); g.translate(10, 10);
  g.fillStyle = '#fff'; g.fillRect(-10, -10, largeur + 20, hauteur + 20);
  g.strokeStyle = '#9AA8C4'; g.lineWidth = 1.2;
  for (const n of noeuds) {
    const p = pos.get(n.id); const pp = n.parent && pos.get(n.parent);
    if (!p || !pp) continue;
    const y1 = pp.y * (H + EV) + H; const y2 = p.y * (H + EV); const ym = (y1 + y2) / 2;
    g.beginPath(); g.moveTo(pp.x + L / 2, y1); g.lineTo(pp.x + L / 2, ym); g.lineTo(p.x + L / 2, ym); g.lineTo(p.x + L / 2, y2); g.stroke();
  }
  const couper = (t, max) => {
    const mots = String(t).split(/\s+/); const lignes = []; let l = '';
    for (const m of mots) { const essai = l ? `${l} ${m}` : m; if (g.measureText(essai).width > max && l) { lignes.push(l); l = m; } else l = essai; }
    if (l) lignes.push(l);
    return lignes.slice(0, 2);
  };
  for (const n of noeuds) {
    const p = pos.get(n.id); if (!p) continue;
    const bx = p.x; const by = p.y * (H + EV);
    g.fillStyle = n.moi ? '#FFF1E6' : '#F3F6FB'; g.strokeStyle = n.moi ? ORANGE : NAVY; g.lineWidth = n.moi ? 2 : 1.2;
    g.beginPath(); if (g.roundRect) g.roundRect(bx, by, L, H, 6); else g.rect(bx, by, L, H); g.fill(); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 12px Helvetica, Arial, sans-serif'; g.fillStyle = n.moi ? '#9A3F0B' : NAVY;
    const titre = n.moi ? `★ ${n.poste || 'Moi'}` : (n.poste || '');
    const lignes = couper(titre, L - 12);
    const sous = n.moi ? 'C’est moi' : (n.nom || '');
    const total = lignes.length + (sous ? 1 : 0);
    let y = by + H / 2 - ((total - 1) * 14) / 2;
    for (const l of lignes) { g.fillText(l, bx + L / 2, y); y += 14; }
    if (sous) { g.font = '11px Helvetica, Arial, sans-serif'; g.fillStyle = GRIS; g.fillText(sous, bx + L / 2, y); }
  }
  return { data: c.toDataURL('image/png'), largeur: largeur + 20 };
}

// ---------------------------------------------------------------- Construction du document
const joursOuvres = (du, au) => { let n = 0; for (let d = new Date(`${du}T12:00:00Z`); d <= new Date(`${au}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) { const j = d.getUTCDay(); if (j >= 1 && j <= 5) n += 1; } return n; };
const dateLongue = (j) => new Date(`${j}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dateCourte = (j) => new Date(`${j}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const ROLE_MISSION = { observe: 'MISSION OBSERVÉE', participe: 'J’Y AI PARTICIPÉ', realise: 'MISSION RÉALISÉE' };
const ROLE_COURT = { observe: 'Observé', participe: 'Participé', realise: 'Réalisé' };

async function construire(d, { prefixe, logo }) {
  const cfg = etat.config;
  const p = cfg.pfmp;
  const S = d.sections;
  const C = (cle) => (S[cle] ? S[cle].contenu : {});
  const commence = (cle) => S[cle] && (S[cle].modifie_le || S[cle].statut !== 'brouillon');
  const nom = `${d.eleve.prenom} ${d.eleve.nom.toUpperCase()}`;
  const id = C('identite');
  const acts = [...(d.journal.activites || [])].sort((a, b) => (a.jour + a.moment).localeCompare(b.jour + b.moment));

  // Images du dossier, converties pour le PDF.
  const imgs = {};
  for (const im of d.images || []) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const data = await donneesImage(`${prefixe}/images/${im.id}/fichier`);
      (imgs[im.cle] = imgs[im.cle] || []).push({ ...im, data });
    } catch { /* image indisponible : on continue sans elle */ }
  }
  const imagesDe = (cle, empl) => (imgs[cle] || []).filter((x) => !empl || x.emplacement === empl);

  const contenu = [];

  // ---------- Page de garde
  const facade = imagesDe('identite', 'facade')[0];
  contenu.push(
    { image: logo, width: 78, alignment: 'center', margin: [0, 0, 0, 22] },
    { text: 'DOSSIER DE PFMP', alignment: 'center', fontSize: 13, bold: true, color: NAVY, characterSpacing: 3 },
    { text: 'Période de formation en milieu professionnel', alignment: 'center', color: GRIS, fontSize: 10.5, margin: [0, 3, 0, 18] },
    { text: nom, alignment: 'center', fontSize: 32, bold: true, color: NAVY },
    { text: `${p.libelleClasse} · ${p.classe}`, alignment: 'center', fontSize: 11, margin: [0, 4, 0, 20] },
  );
  if (facade) {
    contenu.push({ image: facade.data, fit: [380, 230], alignment: 'center' }, { canvas: [{ type: 'rect', x: 57, y: 0, w: 380, h: 4, color: NAVY }] });
  } else {
    contenu.push({ canvas: [{ type: 'rect', x: 157, y: 0, w: 180, h: 4, color: NAVY }], margin: [0, 30, 0, 10] });
  }
  if (id.denomination) contenu.push({ text: id.denomination, alignment: 'center', fontSize: 18, bold: true, margin: [0, 14, 0, 2] });
  const sousEnt = [id.activite && id.activite.length < 90 ? id.activite : '', (id.adresse || '').split(/\n|,/).slice(-1)[0].replace(/^\s*\d{5}\s*/, '').trim()].filter(Boolean).join(' · ');
  if (sousEnt) contenu.push({ text: sousEnt, alignment: 'center', color: GRIS });
  const lignesGarde = [
    id.tuteur_nom ? ['Tuteur', [id.tuteur_nom, id.tuteur_fonction].filter(Boolean).join(', ')] : null,
    ['Dates', `du ${dateLongue(p.debut).replace(/ \d{4}$/, '')} au ${dateLongue(p.fin)}`],
    ['Durée', `${Math.round(joursOuvres(p.debut, p.fin) / 5)} semaines (${joursOuvres(p.debut, p.fin)} jours)`],
  ].filter(Boolean);
  contenu.push(
    { columns: [{ width: '*', text: '' }, { width: 'auto', table: { body: lignesGarde.map(([a, b]) => [{ text: a, style: 'q' }, { text: b }]) }, layout: 'noBorders' }, { width: '*', text: '' }], margin: [0, 18, 0, 0] },
    { text: p.enseignants, alignment: 'center', bold: true, color: NAVY, margin: [0, 34, 0, 2] },
    { text: `${p.etablissement} · ${p.ville} · ${p.annee}`, alignment: 'center', color: GRIS, fontSize: 9.5 },
  );

  // ---------- Sommaire et chiffres
  const codesTravailles = new Set(acts.map((a) => a.competence).filter(Boolean));
  const blocsCouverts = cfg.blocs.filter((b) => b.competences.some((c) => codesTravailles.has(c.code))).length;
  const nb = { observe: 0, participe: 0, realise: 0 };
  acts.forEach((a) => { nb[a.niveau] = (nb[a.niveau] || 0) + 1; });
  const total = acts.length || 1;
  const tuile = (n, lib) => ({ stack: [{ text: n, fontSize: 22, bold: true, color: NAVY, alignment: 'center' }, { text: lib, fontSize: 8.5, color: GRIS, alignment: 'center' }], fillColor: CLAIR, margin: [0, 6, 0, 6] });
  const nbComp = cfg.blocs.reduce((s, b) => s + b.competences.length, 0);
  let x0 = 0;
  const barres = [['observe', '#9AAFD6'], ['participe', '#4C6FB0'], ['realise', NAVY]].map(([k, coul]) => {
    const w = acts.length ? (LARGEUR * nb[k]) / total : LARGEUR / 3;
    const r = { type: 'rect', x: x0, y: 0, w, h: 16, color: acts.length ? coul : '#E5E7EB' }; x0 += w; return r;
  });
  const pct = (k) => (acts.length ? ` (${Math.round((100 * nb[k]) / total)} %)` : '');
  contenu.push(
    { text: 'Sommaire', fontSize: 22, bold: true, color: NAVY, pageBreak: 'before', margin: [0, 0, 0, 12] },
    { toc: { numberStyle: { color: NAVY } } },
    { text: 'Ma PFMP en chiffres', fontSize: 16, bold: true, color: NAVY, margin: [0, 28, 0, 10] },
    { table: { widths: ['*', '*', '*', '*'], body: [[tuile(String(joursOuvres(p.debut, p.fin)), 'jours de PFMP'), tuile(String(acts.length), 'activités notées'),
      tuile(`${codesTravailles.size} / ${nbComp}`, 'compétences travaillées'), tuile(`${blocsCouverts} / ${cfg.blocs.length}`, 'blocs couverts')]] },
    layout: { hLineWidth: () => 0, vLineWidth: () => 3, vLineColor: () => '#fff' } },
    { text: 'Répartition de mes activités', style: 'q', margin: [0, 14, 0, 4] },
    { canvas: barres },
    { columns: [
      { text: `Observé : ${nb.observe}${pct('observe')}`, fontSize: 9 },
      { text: `Avec participation : ${nb.participe}${pct('participe')}`, fontSize: 9, alignment: 'center' },
      { text: `Réalisé seul·e : ${nb.realise}${pct('realise')}`, fontSize: 9, alignment: 'right' },
    ], margin: [0, 4, 0, 0] },
  );

  // ---------- 1. Introduction
  contenu.push(...ouverture(1, 'Introduction', 'Mon arrivée dans l’entreprise.'));
  contenu.push(titreRubrique('1.1', 'Mon arrivée dans l’entreprise'));
  const intro = texteIntroduction(C('introduction'));
  contenu.push(intro ? { text: intro, fontSize: 11.5, lineHeight: 1.45, alignment: 'justify' } : nonComplete);

  // ---------- 2. L'entreprise
  contenu.push(...ouverture(2, 'L’entreprise', 'Mon entreprise d’accueil, son organisation et son marché.'));
  contenu.push(titreRubrique('2.1', 'Fiche d’identité'));
  if (commence('identite')) {
    const corps = [];
    for (const g of FICHE_IDENTITE) {
      const lignes = g.champs.filter((ch) => plein(id[ch.cle]));
      if (!lignes.length) continue;
      corps.push([{ text: g.groupe.toUpperCase(), colSpan: 2, style: 'sousTitre' }, {}]);
      for (const ch of lignes) corps.push([{ text: ch.lib.replace(/ \(.*\)$/, ''), style: 'q' }, { text: id[ch.cle] }]);
    }
    if (corps.length) contenu.push({ table: { widths: [130, '*'], body: corps }, layout: cadre });
    contenu.push(rangeeImages(imagesDe('identite')));
  } else contenu.push(nonComplete);

  contenu.push(titreRubrique('2.2', 'Organigramme'));
  const orga = commence('organigramme') && organigrammeImage(C('organigramme').noeuds || []);
  if (orga) {
    contenu.push({ image: orga.data, width: Math.min(LARGEUR, orga.largeur * 0.75), alignment: 'center', margin: [0, 6, 0, 8] },
      { text: 'La case orange, c’est ma place dans l’entreprise.', style: 'legende', alignment: 'center' });
  } else contenu.push(nonComplete);

  contenu.push(titreRubrique('2.3', 'Veille concurrentielle et commerciale'));
  const v = C('veille');
  if (commence('veille')) {
    const conc = (v.concurrents || []).filter((x) => x.nom || x.offre);
    if (conc.length) {
      const cols = CHAMPS_CONCURRENT.filter((ch) => conc.some((x) => plein(x[ch.cle])));
      contenu.push({ text: 'Mes concurrents', style: 'sousTitreLibre', margin: [0, 0, 0, 6] }, {
        table: { headerRows: 1, widths: cols.map((ch) => (ch.cle === 'nom' ? 80 : '*')), body: [
          cols.map((ch) => ({ text: ch.lib.split(' (')[0], bold: true, color: '#fff', fontSize: 8.5 })),
          ...conc.map((x) => cols.map((ch) => ({ text: x[ch.cle] || '', fontSize: 9, bold: ch.cle === 'nom' }))),
        ] },
        layout: { ...cadre, paddingLeft: () => 6, paddingRight: () => 6, fillColor: (r) => (r === 0 ? NAVY : null) },
        margin: [0, 0, 0, 10],
      });
    }
    contenu.push(
      boite('La comparaison avec mon entreprise', v.comparaison),
      boite('Les sources de veille de l’entreprise', [...(v.sources || []), v.sources_autre].filter(Boolean).join(' · ')),
      boite('Les offres et actions commerciales en cours', v.actions),
      boite('Ce que j’ai appris sur le marché', v.appris),
      rangeeImages(imagesDe('veille')),
    );
  } else contenu.push(nonComplete);

  // ---------- 3. Mes activités et mes missions
  contenu.push(...ouverture(3, 'Mes activités et mes missions', 'Ce que j’ai observé, ce à quoi j’ai participé et ce que j’ai réalisé, bloc par bloc.'));
  contenu.push(titreRubrique('3.1', 'Les compétences que j’ai travaillées'));
  contenu.push({ text: `D’après mon journal : nombre d’activités par compétence et par rôle (${acts.length} activités notées).`, color: GRIS, fontSize: 9.5, margin: [0, 0, 0, 8] });
  for (const b of cfg.blocs) {
    const lignes = b.competences.map((c) => {
      const a = acts.filter((x) => x.competence === c.code);
      const n = (k) => a.filter((x) => x.niveau === k).length;
      const vide = !a.length;
      const cell = (k) => ({ text: n(k) || '', alignment: 'center', bold: true, color: NAVY });
      return [{ text: c.libelle, fontSize: 9, color: vide ? '#9CA3AF' : '#1F2937' }, cell('observe'), cell('participe'), cell('realise')];
    });
    contenu.push({
      table: { headerRows: 1, widths: ['*', 52, 52, 52], body: [
        [{ text: `${b.code} — ${b.titre}`, bold: true, color: '#fff', fontSize: 9.5 }, ...['Observé', 'Participé', 'Réalisé'].map((t) => ({ text: t, color: '#fff', fontSize: 8, alignment: 'center' }))],
        ...lignes,
      ] },
      layout: { ...cadre, paddingTop: () => 4, paddingBottom: () => 4, fillColor: (r) => (r === 0 ? NAVY : null) },
      margin: [0, 0, 0, 10],
    });
  }

  cfg.blocs.forEach((b, i) => {
    const cle = `mission_${b.code.toLowerCase()}`;
    const m = C(cle);
    contenu.push(titreRubrique(`3.${i + 2}`, `Fiche mission — ${b.titre}`));
    if (!commence(cle)) { contenu.push(nonComplete); return; }
    const T = Object.fromEntries(TRAME_MISSION.map((t) => [t.cle, t.lib]));
    const comp = b.competences.filter((c) => (m.competences || []).includes(c.code)).map((c) => `${c.code} · ${c.libelle}`);
    contenu.push(
      { table: { widths: ['*', 'auto'], body: [[
        { stack: [{ text: 'Intitulé de la mission', style: 'q' }, { text: m.titre || '', bold: true, fontSize: 12 }] },
        m.role ? { stack: [{ text: 'Mon rôle', style: 'q' }, pastille(ROLE_MISSION[m.role])] } : { text: '' },
      ]] }, layout: { ...cadre, fillColor: () => CLAIR }, margin: [0, 0, 0, 8] },
      deux([T.contexte, m.contexte], [T.objectifs, m.objectifs]),
      deux([T.moyens_materiels, m.moyens_materiels], [T.moyens_humains, m.moyens_humains]),
      boite('Comment ça s’est passé', m.deroulement),
      deux([T.difficultes, m.difficultes], [T.resultats, m.resultats]),
      deux([T.ameliorations, m.ameliorations], ['Les compétences mobilisées', comp.length ? { ul: comp, fontSize: 9.5 } : '']),
    );
    const preuves = imagesDe(cle);
    if (plein(m.preuves) || preuves.length) {
      contenu.push({ unbreakable: true, stack: [
        { text: 'Mes preuves', style: 'sousTitreLibre', margin: [0, 4, 0, 4] },
        ...(plein(m.preuves) ? [{ text: m.preuves, margin: [0, 0, 0, 4] }] : []),
        ...(preuves.length ? [rangeeImages(preuves)] : []),
      ] });
    }
  });

  // ---------- 4. Le professionnel
  contenu.push(...ouverture(4, 'Le professionnel', 'L’interview d’un professionnel de mon entreprise.'));
  contenu.push(titreRubrique('4.1', 'Interview d’un professionnel'));
  const itv = C('interview');
  if (commence('interview')) {
    const qui = [itv.poste, itv.prenom ? `(${itv.prenom})` : ''].filter(Boolean).join(' ');
    const quand = [itv.date ? `le ${itv.date}` : '', itv.mode ? MODES[itv.mode].toLowerCase() : ''].filter(Boolean).join(', ');
    if (qui) contenu.push(boite('La personne interrogée', `${qui}${quand ? ` — interview réalisée ${quand}` : ''}`, { fond: CLAIR }));
    cfg.questionsInterview.forEach((q, i) => {
      const r = (itv.reponses || [])[i];
      if (!plein(r)) return;
      contenu.push({ table: { widths: ['*'], body: [
        [{ text: `${i + 1}. ${q}`, bold: true, color: NAVY, fontSize: 9.5, fillColor: '#F1F4F9' }],
        [{ text: r.trim() }],
      ] }, layout: cadre, margin: [0, 0, 0, 6], unbreakable: r.length < 900 });
    });
    if (plein(itv.appris)) {
      contenu.push({ table: { widths: ['*'], body: [[{ stack: [
        { text: 'Ce que cette interview m’a appris', bold: true, color: ORANGE, fontSize: 11, margin: [0, 0, 0, 4] },
        { text: itv.appris.trim() },
      ] }]] }, layout: { hLineWidth: () => 0, vLineWidth: (i) => (i === 0 ? 4 : 0), vLineColor: () => ORANGE, fillColor: () => '#FFF4EC', paddingLeft: () => 12, paddingRight: () => 10, paddingTop: () => 8, paddingBottom: () => 10 }, margin: [0, 6, 0, 0] });
    }
  } else contenu.push(nonComplete);

  // ---------- 5. Mon bilan
  contenu.push(...ouverture(5, 'Mon bilan', 'Ce que je retiens de ma PFMP, mon projet et mon auto-évaluation.'));
  contenu.push(titreRubrique('5.1', 'Mon bilan'));
  const bil = C('bilan');
  if (commence('bilan')) CHAMPS_BILAN.forEach((ch) => contenu.push(boite(ch.lib, bil[ch.cle])));
  else contenu.push(nonComplete);

  contenu.push(titreRubrique('5.2', 'Mon projet professionnel'));
  const pro = C('projet');
  if (commence('projet')) cfg.amorcesProjet.forEach((a, i) => contenu.push(boite(a, (pro.reponses || [])[i])));
  else contenu.push(nonComplete);

  contenu.push(titreRubrique('5.3', 'Auto-évaluation des attitudes professionnelles'));
  const au = C('autoeval');
  if (commence('autoeval')) {
    const ent = (t) => ({ text: t, bold: true, color: '#fff', fontSize: 8.5, alignment: 'center' });
    contenu.push({ table: { headerRows: 1, widths: ['*', 46, 46, 46, 46], body: [
      [{ text: 'Attitude', bold: true, color: '#fff', fontSize: 9 }, ...NIV_AUTO.map(([, l]) => ent(l))],
      ...cfg.attitudes.map((a) => [
        { stack: [{ text: a.libelle, fontSize: 10 }, ...(plein((au.exemples || {})[a.code]) ? [{ text: `Exemple : ${au.exemples[a.code]}`, fontSize: 8.5, italics: true, color: GRIS, margin: [0, 2, 0, 0] }] : [])] },
        ...NIV_AUTO.map(([k]) => ((au.niveaux || {})[a.code] === k ? coche() : { text: '' })),
      ]),
    ] }, layout: { ...cadre, fillColor: (r) => (r === 0 ? NAVY : r % 2 === 0 ? '#F5F7FB' : null) }, margin: [0, 0, 0, 10] },
    deux(['L’attitude dont je suis le plus fier ou la plus fière', au.fierte], ['L’attitude que je veux améliorer', au.progres]));
  } else contenu.push(nonComplete);

  // ---------- 6. Annexes
  contenu.push(...ouverture(6, 'Annexes', 'La trame de mon oral et mon journal de bord.'));
  contenu.push(titreRubrique('6.1', 'Trame de mon oral'));
  const oral = C('oral');
  if (commence('oral')) {
    const diapo = (x, i) => {
      const dd = (oral.diapos || {})[x.cle] || {};
      const pts = (dd.points || []).filter(plein);
      return { stack: [
        { text: `${i + 1}/4`, color: '#AFC0E0', fontSize: 8, alignment: 'right' },
        { text: dd.titre || x.titre, color: '#fff', bold: true, fontSize: 13, margin: [0, 0, 0, 6] },
        pts.length ? { ul: pts, color: '#fff', fontSize: 9.5 } : { text: '(à compléter)', color: '#AFC0E0', italics: true },
      ], fillColor: NAVY };
    };
    const D = cfg.diaposOral;
    contenu.push({ table: { widths: ['*', '*'], heights: 150, body: [[diapo(D[0], 0), diapo(D[1], 1)], [diapo(D[2], 2), diapo(D[3], 3)]] },
      layout: { hLineWidth: () => 5, vLineWidth: () => 5, hLineColor: () => '#fff', vLineColor: () => '#fff', paddingLeft: () => 12, paddingRight: () => 12, paddingTop: () => 8, paddingBottom: () => 8 } });
  } else contenu.push(nonComplete);

  contenu.push(titreRubrique('6.2', 'Mon journal de bord'));
  const abs = (d.journal.absences || []).map((a) => ({ ...a, absence: true }));
  const lignes = [...acts, ...abs].sort((a, b) => (a.jour + (a.moment === 'matin' ? 0 : 1)).localeCompare(b.jour + (b.moment === 'matin' ? 0 : 1)));
  if (lignes.length) {
    let dernier = '';
    contenu.push({ table: { headerRows: 1, widths: [62, 44, '*', 52, 40], body: [
      ['Date', 'Moment', 'Activité', 'Rôle', 'Comp.'].map((t) => ({ text: t, bold: true, color: '#fff', fontSize: 8.5 })),
      ...lignes.map((a) => {
        const date = a.jour === dernier ? '' : dateCourte(a.jour); dernier = a.jour;
        return a.absence
          ? [{ text: date, fontSize: 8.5 }, { text: MOMENTS[a.moment], fontSize: 8.5 }, { text: MOTIFS[a.motif], italics: true, color: GRIS, fontSize: 9, colSpan: 3 }, {}, {}]
          : [{ text: date, fontSize: 8.5 }, { text: MOMENTS[a.moment], fontSize: 8.5 }, { text: a.texte, fontSize: 9 }, { text: ROLE_COURT[a.niveau] || '', fontSize: 8.5 }, { text: a.competence || '', fontSize: 8.5, color: GRIS }];
      }),
    ] }, layout: { ...cadre, paddingTop: () => 3, paddingBottom: () => 3, paddingLeft: () => 5, paddingRight: () => 5, fillColor: (r) => (r === 0 ? NAVY : null) } });
  } else contenu.push({ text: 'Aucune activité notée.', italics: true, color: GRIS });

  const aujourdhui = new Date().toLocaleDateString('fr-FR');
  return {
    pageSize: 'A4',
    pageMargins: [50, 66, 50, 52],
    info: { title: `Dossier de PFMP — ${nom}`, author: nom, subject: `${p.classe} ${p.annee}` },
    defaultStyle: { fontSize: 10.5, lineHeight: 1.2, color: '#1F2937' },
    styles: {
      q: { fontSize: 8.5, color: GRIS, bold: true, margin: [0, 0, 0, 2] },
      r: { fontSize: 10.5 },
      legende: { fontSize: 8.5, italics: true, color: GRIS },
      sousTitre: { fontSize: 8.5, bold: true, color: NAVY, fillColor: CLAIR, characterSpacing: 1 },
      sousTitreLibre: { fontSize: 11, bold: true, color: NAVY },
    },
    header: (page) => (page === 1 ? null : {
      margin: [50, 22, 50, 0],
      stack: [
        { columns: [
          { image: logo, width: 20 },
          { text: [{ text: 'Dossier de PFMP — ', color: GRIS }, { text: nom, bold: true, color: NAVY }, { text: `  ·  ${p.classe} ${p.annee}`, color: GRIS }], fontSize: 9, alignment: 'right', margin: [0, 9, 0, 0] },
        ] },
        { canvas: [{ type: 'line', x1: 0, y1: 4, x2: LARGEUR, y2: 4, lineWidth: 0.8, lineColor: NAVY }] },
      ],
    }),
    footer: (page, nbPages) => (page === 1 ? null : {
      margin: [50, 14, 50, 0],
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: LARGEUR, y2: 0, lineWidth: 0.5, lineColor: TRAIT }] },
        { columns: [
          { text: `${p.etablissement.replace('Lycée professionnel', 'LP')} · ${p.enseignants} · Dossier créé le ${aujourdhui}`, fontSize: 8, color: GRIS },
          { text: `Page ${page} / ${nbPages}`, fontSize: 8.5, bold: true, color: NAVY, alignment: 'right', width: 70 },
        ], margin: [0, 6, 0, 0] },
      ],
    }),
    content: contenu.filter(Boolean),
  };
}

// Nom de fichier standard pour Pearltrees : PFMP_1MCVB_MARTIN_Lea.pdf
export function nomFichier(eleve) {
  const propre = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-|-$/g, '');
  return `PFMP_${propre(etat.config.pfmp.classe)}_${propre(eleve.nom).toUpperCase()}_${propre(eleve.prenom)}.pdf`;
}

// Fabrique le PDF ; renvoie un Blob.
export async function fabriquerPdf(d, { prefixe = '/eleve' } = {}) {
  const [pm, logo] = await Promise.all([pdfMake(), fetch('icones/logo-lycee.png').then((r) => r.blob()).then(enDataUrl)]);
  const doc = await construire(d, { prefixe, logo });
  return new Promise((ok, ko) => { try { pm.createPdf(doc).getBlob(ok); } catch (e) { ko(e); } });
}

export function telecharger(blob, nom) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nom; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
