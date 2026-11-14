// Définition des rubriques du dossier (formulaires et lecture).
import { esc, nbMots } from './ui.js';

export const ANNUAIRE = 'https://annuaire-entreprises.data.gouv.fr/';

const TYPES_ORGA = [
  'Administration', 'Association', 'Entreprise artisanale (moins de 10 salariés)', 'Petite entreprise (10 à 49 salariés)',
  'Moyenne entreprise (50 à 249 salariés)', 'ETI (250 à 4 999 salariés)', 'Grande entreprise (5 000 salariés et plus)',
];

// Fiche d'identité adaptée à l'option B.
export const FICHE_IDENTITE = [
  { groupe: 'L’entreprise', champs: [
    { cle: 'denomination', lib: 'Dénomination (nom de l’entreprise)', requis: true, max: 120 },
    { cle: 'adresse', lib: 'Adresse', requis: true, type: 'zone', lignes: 2, max: 250 },
    { cle: 'dirigeant', lib: 'Nom du dirigeant', max: 120, aide: 'Tel qu’il apparaît dans l’Annuaire des entreprises.' },
    { cle: 'siret', lib: 'N° SIRET', requis: true, max: 20, mode: 'numeric', aide: '14 chiffres.' },
    { cle: 'code_ape', lib: 'Code APE', max: 10, aide: 'Ex. 68.31Z' },
    { cle: 'forme_juridique', lib: 'Forme juridique', requis: true, max: 80, liste: ['SAS', 'SASU', 'SARL', 'EURL', 'SA', 'Entreprise individuelle', 'Association', 'Société coopérative'] },
    { cle: 'date_immatriculation', lib: 'Date d’immatriculation', max: 20, aide: 'JJ/MM/AAAA' },
    { cle: 'activite', lib: 'Activité', requis: true, type: 'zone', lignes: 2, max: 300, aide: 'Ce que fait l’entreprise, en une ou deux phrases.' },
    { cle: 'produits', lib: 'Produits ou services proposés', type: 'zone', lignes: 2, max: 400 },
  ] },
  { groupe: 'Organisation', champs: [
    { cle: 'type_organisation', lib: 'Type d’organisation', requis: true, type: 'select', options: TYPES_ORGA },
    { cle: 'effectif', lib: 'Effectif (nombre de salariés)', max: 60 },
    { cle: 'horaires', lib: 'Horaires d’ouverture', type: 'zone', lignes: 2, max: 250 },
  ] },
  { groupe: 'Clients et marché', champs: [
    { cle: 'clientele', lib: 'Clientèle', requis: true, type: 'choix', options: ['Particuliers', 'Professionnels', 'Les deux'] },
    { cle: 'clientele_detail', lib: 'Qui sont les clients ?', type: 'zone', lignes: 2, max: 400, aide: 'Ex. familles qui achètent leur premier logement, artisans du secteur…' },
    { cle: 'zone_prospection', lib: 'Zone de prospection', requis: true, type: 'zone', lignes: 2, max: 400, aide: 'Où l’entreprise cherche-t-elle de nouveaux clients ? (villes, département, secteur…)' },
    { cle: 'concurrent_1', lib: 'Concurrent n° 1', requis: true, max: 120 },
    { cle: 'concurrent_2', lib: 'Concurrent n° 2', requis: true, max: 120 },
    { cle: 'concurrent_3', lib: 'Concurrent n° 3', max: 120 },
    { cle: 'partenaire_1', lib: 'Partenaire n° 1', max: 120, aide: 'Fournisseur, banque, notaire, prestataire…' },
    { cle: 'partenaire_2', lib: 'Partenaire n° 2', max: 120 },
    { cle: 'place_marche', lib: 'Place sur le marché', requis: true, type: 'choix', options: ['Leader', 'Challenger', 'Autre'], aide: 'Leader : n° 1 de son marché. Challenger : il cherche à rattraper le leader.' },
    { cle: 'place_marche_detail', lib: 'Explique en une phrase', type: 'zone', lignes: 2, max: 300 },
  ] },
];

export const QUESTIONS_INTRO = [
  'Pourquoi as-tu choisi de faire ton stage dans cette entreprise ?',
  'Est-ce un choix pratique ? (une personne de ton entourage y travaille, l’entreprise est proche de chez toi…)',
  'Est-ce par curiosité, ou par intérêt pour ce métier ou cette entreprise ?',
  'Est-ce pour voir autre chose ?',
  'Tu peux remercier ton tuteur et l’ensemble du personnel.',
];

function champHtml(c, valeur, lectureSeule) {
  const id = `ch-${c.cle}`;
  const dis = lectureSeule ? ' disabled' : '';
  const lib = `${esc(c.lib)}${c.requis ? ' <span class="requis" title="obligatoire">*</span>' : ''}`;
  const aide = c.aide ? `<span class="aide">${esc(c.aide)}</span>` : '';
  if (c.type === 'choix') {
    return `<fieldset><legend>${lib}</legend><div class="choix">${c.options.map((o) => `
      <label><input type="radio" name="${c.cle}" value="${esc(o)}"${valeur === o ? ' checked' : ''}${dis}>${esc(o)}</label>`).join('')}</div>${aide}</fieldset>`;
  }
  let input;
  if (c.type === 'zone') input = `<textarea id="${id}" name="${c.cle}" rows="${c.lignes || 3}" maxlength="${c.max}"${dis}>${esc(valeur)}</textarea>`;
  else if (c.type === 'select') {
    input = `<select id="${id}" name="${c.cle}"${dis}><option value="">— Choisir —</option>${c.options.map((o) => `<option${valeur === o ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  } else {
    input = `<input id="${id}" name="${c.cle}" maxlength="${c.max}" value="${esc(valeur)}"${c.mode ? ` inputmode="${c.mode}"` : ''}${c.liste ? ` list="${id}-liste"` : ''}${dis}>`
      + (c.liste ? `<datalist id="${id}-liste">${c.liste.map((o) => `<option value="${esc(o)}">`).join('')}</datalist>` : '');
  }
  return `<label class="champ" for="${id}"><span class="lib">${lib}</span>${input}${aide}</label>`;
}

export function editeurIdentite(zone, contenu, { lectureSeule, changer }) {
  zone.innerHTML = `
    <div class="bandeau info"><p>🔎 Trouve les informations officielles (SIRET, code APE, forme juridique, dirigeant…) sur
      <a href="${ANNUAIRE}" target="_blank" rel="noopener">l’Annuaire des entreprises</a> en tapant le nom de l’entreprise.</p>
      <p class="petit">🔒 N’écris que des informations publiques ou que ton tuteur t’autorise à donner : pas de chiffres ni de documents confidentiels.</p></div>
    <form class="carte" novalidate>${FICHE_IDENTITE.map((g) => `<div class="groupe-titre">${esc(g.groupe)}</div>${g.champs.map((c) => champHtml(c, contenu[c.cle] || '', lectureSeule)).join('')}`).join('')}</form>`;
  const form = zone.querySelector('form');
  form.addEventListener('submit', (e) => e.preventDefault());
  const lire = () => {
    const r = {};
    for (const g of FICHE_IDENTITE) for (const c of g.champs) {
      if (c.type === 'choix') r[c.cle] = (form.querySelector(`input[name="${c.cle}"]:checked`) || {}).value || '';
      else r[c.cle] = form.elements[c.cle].value;
    }
    return r;
  };
  form.addEventListener('input', () => changer(lire()));
  form.addEventListener('change', () => changer(lire()));
  return { definirLectureSeule(v) { form.querySelectorAll('input, textarea, select').forEach((x) => { x.disabled = v; }); } };
}

export function lectureIdentite(c) {
  return `<dl class="fiche-lecture">${FICHE_IDENTITE.map((g) => `<div class="groupe-titre">${esc(g.groupe)}</div>${g.champs.map((ch) => `
    <dt>${esc(ch.lib)}</dt><dd class="${c[ch.cle] ? '' : 'vide'}">${c[ch.cle] ? esc(c[ch.cle]) : (ch.requis ? 'manquant' : '—')}</dd>`).join('')}`).join('')}</dl>`;
}

export function editeurIntroduction(zone, contenu, { lectureSeule, changer }) {
  zone.innerHTML = `
    <div class="carte"><h2>Questions pour t’aider</h2>
      <ul class="questions-guides">${QUESTIONS_INTRO.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>
      <p class="discret petit" style="margin-top:.5rem">Rédige un vrai texte de 5 à 10 lignes, sans recopier les questions.</p></div>
    <label class="champ"><span class="lib">Mon introduction</span>
      <textarea name="texte" rows="10" maxlength="3000"${lectureSeule ? ' disabled' : ''} placeholder="J’ai choisi d’effectuer ma PFMP chez…">${esc(contenu.texte || '')}</textarea>
      <span class="aide" data-compteur></span></label>`;
  const ta = zone.querySelector('textarea');
  const compteur = zone.querySelector('[data-compteur]');
  const majCompteur = () => {
    const n = nbMots(ta.value);
    const lignes = Math.round(n / 12);
    compteur.textContent = `${n} mots, environ ${lignes} ligne${lignes > 1 ? 's' : ''} sur une copie. ${n < 40 ? 'Objectif : au moins 40 mots.' : n > 160 ? 'C’est déjà long : 10 lignes maximum.' : 'Bonne longueur ✓'}`;
  };
  ta.addEventListener('input', () => { majCompteur(); changer({ texte: ta.value }); });
  majCompteur();
  return { definirLectureSeule(v) { ta.disabled = v; } };
}

export const lectureIntroduction = (c) => (c.texte ? `<div class="texte-lecture">${esc(c.texte)}</div><p class="discret petit">${nbMots(c.texte)} mots</p>` : '<p class="discret">Pas encore rédigée.</p>');
