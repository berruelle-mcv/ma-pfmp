// Diapos de l'oral en PowerPoint (.pptx), fabriquées dans le navigateur : l'élève les modifie ensuite librement.
import { etat } from './app.js';
import { get, donneesImage } from './api.js';
import { nomFichier } from './pdf.js';

const NAVY = '0C3274'; const ORANGE = 'D9661F'; const GRIS = '6B7280'; const CLAIR = 'E9EEF7';
const L = 13.333; const H = 7.5; // format 16:9

let chargement = null;
const script = (src) => new Promise((ok, ko) => {
  const s = document.createElement('script');
  s.src = src; s.onload = ok;
  s.onerror = () => ko(new Error('Impossible de charger l’outil PowerPoint. Vérifie ta connexion puis réessaie.'));
  document.head.appendChild(s);
});
async function outil() {
  if (!chargement) chargement = (window.JSZip ? Promise.resolve() : script('lib/jszip.min.js')).then(() => script('lib/pptxgen.min.js')).catch((e) => { chargement = null; throw e; });
  await chargement;
  return window.PptxGenJS;
}

const dataUrl = (blob) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(blob); });
const dimensions = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok({ l: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => ok({ l: 4, h: 3 }); i.src = src; });

// Place une image entière dans un cadre (sans la déformer).
async function image(diapo, data, x, y, w, h) {
  const d = await dimensions(data);
  const r = Math.min(w / d.l, h / d.h);
  const iw = d.l * r; const ih = d.h * r;
  diapo.addImage({ data: data.replace(/^data:/, ''), x: x + (w - iw) / 2, y: y + (h - ih) / 2, w: iw, h: ih });
}

const dateCourte = (j) => new Date(`${j}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });

export async function telechargerDiapos(oral) {
  const PptxGenJS = await outil();
  const u = etat.utilisateur;
  const p = etat.config.pfmp;
  const stage = u.stage || { debut: p.debut, fin: p.fin };
  const [identite, { images }, logo] = await Promise.all([
    get('/eleve/sections/identite').then((r) => r.contenu).catch(() => ({})),
    get('/eleve/images').catch(() => ({ images: [] })),
    fetch('icones/logo-lycee.png').then((r) => r.blob()).then(dataUrl),
  ]);
  const img = async (cle, empl) => {
    const im = images.find((x) => x.cle === cle && (!empl || x.emplacement === empl));
    if (!im) return null;
    try { return { data: await donneesImage(`/eleve/images/${im.id}/fichier`), legende: im.legende }; } catch { return null; }
  };
  const facade = await img('identite', 'facade');
  const preuve = oral.mission_choisie ? await img(oral.mission_choisie) : null;
  const nom = `${u.prenom} ${u.nom.toUpperCase()}`;

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = nom;
  pptx.title = `Oral de PFMP — ${nom}`;
  pptx.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial' };

  // 1. Page de titre
  const t = pptx.addSlide();
  t.background = { color: NAVY };
  t.addShape(pptx.ShapeType.rect, { x: 0.6, y: 0.55, w: 1.25, h: 1.45, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' } });
  await image(t, logo, 0.7, 0.62, 1.05, 1.3);
  const largeurTexte = facade ? 6.6 : 12;
  t.addText('ORAL DE PFMP', { x: 0.6, y: 2.4, w: largeurTexte, h: 0.5, fontSize: 16, bold: true, color: 'AFC0E0', charSpacing: 4 });
  t.addText(nom, { x: 0.6, y: 2.9, w: largeurTexte, h: 1.1, fontSize: 40, bold: true, color: 'FFFFFF' });
  t.addShape(pptx.ShapeType.rect, { x: 0.6, y: 4.15, w: 1.2, h: 0.08, fill: { color: ORANGE }, line: { color: ORANGE } });
  t.addText([
    ...(identite.denomination ? [{ text: identite.denomination, options: { fontSize: 22, bold: true, color: 'FFFFFF', breakLine: true } }] : []),
    { text: `Du ${dateCourte(stage.debut)} au ${dateCourte(stage.fin)} ${stage.fin.slice(0, 4)}`, options: { fontSize: 16, color: 'D6DEEE', breakLine: true } },
    { text: `${p.classe} · ${p.etablissement} · ${p.annee}`, options: { fontSize: 13, color: 'AFC0E0' } },
  ], { x: 0.6, y: 4.4, w: largeurTexte, h: 1.6, valign: 'top' });
  if (facade) {
    t.addShape(pptx.ShapeType.rect, { x: 7.55, y: 0.85, w: 5.2, h: 5.8, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' } });
    await image(t, facade.data, 7.7, 1.0, 4.9, 5.5);
  }

  // 2 à 5. Les quatre diapos préparées dans Ma PFMP
  const D = etat.config.diaposOral;
  for (let i = 0; i < D.length; i += 1) {
    const x = D[i];
    const d = (oral.diapos || {})[x.cle] || {};
    const points = (d.points || []).map((v) => String(v || '').trim()).filter(Boolean);
    const s = pptx.addSlide();
    s.background = { color: 'FFFFFF' };
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: L, h: 0.18, fill: { color: NAVY }, line: { color: NAVY } });
    s.addText(String(i + 1), { x: 0.6, y: 0.45, w: 0.9, h: 0.9, fontSize: 40, bold: true, color: 'C9D5EA' });
    s.addText(d.titre || x.titre, { x: 1.45, y: 0.5, w: 11, h: 0.85, fontSize: 32, bold: true, color: NAVY });
    s.addShape(pptx.ShapeType.rect, { x: 1.5, y: 1.42, w: 1.0, h: 0.07, fill: { color: ORANGE }, line: { color: ORANGE } });
    const visuel = x.cle === 'entreprise' ? facade : x.cle === 'mission' ? preuve : null;
    const largeur = visuel ? 6.9 : 11.3;
    s.addText(points.length ? points.map((v) => ({ text: v, options: { bullet: { indent: 22 }, breakLine: true, paraSpaceAfter: 14 } }))
      : [{ text: 'À compléter', options: { italic: true, color: GRIS } }],
    { x: 1.5, y: 1.9, w: largeur, h: 4.6, fontSize: 24, color: '1F2937', valign: 'top' });
    if (visuel) {
      s.addShape(pptx.ShapeType.rect, { x: 8.75, y: 1.85, w: 4.0, h: 4.3, fill: { color: CLAIR }, line: { color: CLAIR } });
      await image(s, visuel.data, 8.85, 1.95, 3.8, 3.6);
      if (visuel.legende) s.addText(visuel.legende, { x: 8.85, y: 5.6, w: 3.8, h: 0.5, fontSize: 11, italic: true, color: GRIS, align: 'center' });
    }
    s.addShape(pptx.ShapeType.line, { x: 0.6, y: 6.85, w: L - 1.2, h: 0, line: { color: 'C5D0E3', width: 0.75 } });
    s.addText(`${nom} · Oral de PFMP ${p.classe}`, { x: 0.6, y: 6.9, w: 8, h: 0.4, fontSize: 11, color: GRIS });
    await image(s, logo, L - 1.0, 6.88, 0.4, 0.45);
    if (d.notes) s.addNotes(d.notes);
  }

  await pptx.writeFile({ fileName: nomFichier(u).replace(/^PFMP_/, 'Oral_PFMP_').replace(/\.pdf$/, '.pptx') });
}
