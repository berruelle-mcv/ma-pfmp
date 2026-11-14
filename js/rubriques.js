// Définition des rubriques du dossier (formulaires et lecture).
import { esc, nbMots } from './ui.js';
import { etat } from './app.js';
import { get } from './api.js';

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

// ---------------------------------------------------------------- Veille concurrentielle et commerciale


const CHAMPS_CONCURRENT = [
  { cle: 'nom', lib: 'Nom', max: 120, requis: true },
  { cle: 'lieu', lib: 'Où ? (ville, quartier, en ligne…)', max: 120 },
  { cle: 'offre', lib: 'Ce qu’il propose', max: 300, requis: true, zone: true },
  { cle: 'prix', lib: 'Prix ou positionnement (moins cher, haut de gamme…)', max: 200 },
  { cle: 'fort', lib: 'Un point fort', max: 200, requis: true },
  { cle: 'faible', lib: 'Un point faible', max: 200, requis: true },
];

const videConcurrent = () => Object.fromEntries(CHAMPS_CONCURRENT.map((c) => [c.cle, '']));

export function editeurVeille(zone, contenu, { lectureSeule, changer }) {
  const dis = lectureSeule ? ' disabled' : '';
  const conc = [0, 1, 2].map((i) => ({ ...videConcurrent(), ...((contenu.concurrents || [])[i] || {}) }));
  const sources = new Set(contenu.sources || []);
  const req = ' <span class="requis" title="obligatoire">*</span>';
  zone.innerHTML = `
    <div class="bandeau info"><p>🔍 Observe, écoute ton tuteur, regarde les sites et les réseaux des concurrents. Pose-lui la question : « Qui sont vos principaux concurrents ? Comment vous tenez-vous informés ? »</p>
      <p class="petit">🔒 Seulement des informations publiques ou que ton tuteur t’autorise à donner.</p></div>
    <form class="carte" novalidate>
      <div class="groupe-titre">Les concurrents (au moins deux)</div>
      ${conc.map((c, i) => `<fieldset class="concurrent"><legend>Concurrent n° ${i + 1}${i < 2 ? req : ' (facultatif)'}</legend>
        ${CHAMPS_CONCURRENT.map((ch) => `<label class="champ"><span class="lib">${esc(ch.lib)}</span>${ch.zone
    ? `<textarea name="c${i}-${ch.cle}" rows="2" maxlength="${ch.max}"${dis}>${esc(c[ch.cle])}</textarea>`
    : `<input name="c${i}-${ch.cle}" maxlength="${ch.max}" value="${esc(c[ch.cle])}"${dis}>`}</label>`).join('')}
      </fieldset>`).join('')}
      <label class="champ"><span class="lib">Comparaison avec mon entreprise${req}</span>
        <textarea name="comparaison" rows="3" maxlength="800"${dis} placeholder="Par rapport à ses concurrents, mon entreprise se distingue par…">${esc(contenu.comparaison || '')}</textarea></label>
      <div class="groupe-titre">La veille commerciale</div>
      <fieldset><legend>Comment l’entreprise se tient-elle informée ?${req}</legend>
        <div class="cases">${etat.config.sourcesVeille.map((s) => `<label><input type="checkbox" name="sources" value="${esc(s)}"${sources.has(s) ? ' checked' : ''}${dis}> ${esc(s)}</label>`).join('')}</div>
        <label class="champ" style="margin-top:.75rem"><span class="lib">Autre source</span><input name="sources_autre" maxlength="200" value="${esc(contenu.sources_autre || '')}"${dis}></label>
      </fieldset>
      <label class="champ"><span class="lib">Les offres ou actions commerciales en cours${req}</span>
        <textarea name="actions" rows="3" maxlength="1200"${dis} placeholder="Promotions, campagne de prospection, offre de saison, nouveau produit…">${esc(contenu.actions || '')}</textarea></label>
      <label class="champ"><span class="lib">Ce que j’ai appris sur le marché</span>
        <textarea name="appris" rows="3" maxlength="1200"${dis} placeholder="Les prix augmentent, les clients comparent sur internet, la concurrence est forte sur…">${esc(contenu.appris || '')}</textarea></label>
    </form>`;
  const form = zone.querySelector('form');
  form.addEventListener('submit', (e) => e.preventDefault());
  const lire = () => ({
    concurrents: [0, 1, 2].map((i) => Object.fromEntries(CHAMPS_CONCURRENT.map((ch) => [ch.cle, form.elements[`c${i}-${ch.cle}`].value]))),
    comparaison: form.elements.comparaison.value,
    sources: [...form.querySelectorAll('input[name=sources]:checked')].map((x) => x.value),
    sources_autre: form.elements.sources_autre.value,
    actions: form.elements.actions.value,
    appris: form.elements.appris.value,
  });
  form.addEventListener('input', () => changer(lire()));
  form.addEventListener('change', () => changer(lire()));
  return { definirLectureSeule(v) { form.querySelectorAll('input, textarea').forEach((x) => { x.disabled = v; }); } };
}

export function lectureVeille(c) {
  const conc = (c.concurrents || []).filter((x) => x.nom || x.offre);
  const val = (v) => (v ? esc(v) : '<span class="discret">—</span>');
  return `
    <div class="groupe-titre" style="margin-top:0">Concurrents</div>
    ${conc.length ? `<div style="overflow-x:auto"><table class="liste"><thead><tr>${CHAMPS_CONCURRENT.map((ch) => `<th>${esc(ch.lib.split(' (')[0])}</th>`).join('')}</tr></thead>
      <tbody>${conc.map((x) => `<tr>${CHAMPS_CONCURRENT.map((ch) => `<td>${val(x[ch.cle])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="discret">Aucun concurrent renseigné.</p>'}
    <dl class="fiche-lecture">
      <dt>Comparaison avec son entreprise</dt><dd class="${c.comparaison ? '' : 'vide'}">${c.comparaison ? esc(c.comparaison) : 'manquante'}</dd>
      <dt>Sources de veille</dt><dd>${[...(c.sources || []), c.sources_autre].filter(Boolean).map(esc).join(' · ') || '<span class="discret">—</span>'}</dd>
      <dt>Offres et actions commerciales en cours</dt><dd class="${c.actions ? '' : 'vide'}">${c.actions ? esc(c.actions) : 'manquantes'}</dd>
      <dt>Ce qu’il a appris sur le marché</dt><dd>${val(c.appris)}</dd>
    </dl>`;
}

// ---------------------------------------------------------------- Fiches mission

const TRAME_MISSION = [
  { cle: 'contexte', lib: 'La mission', aide: 'Quelle était la mission ? Dans quelle situation (client, produit, moment) ?', lignes: 3, max: 1200, requis: true },
  { cle: 'objectifs', lib: 'Les objectifs', aide: 'À quoi servait cette mission pour l’entreprise ?', lignes: 2, max: 800, requis: true },
  { cle: 'moyens_materiels', lib: 'Les moyens matériels', aide: 'Outils, logiciels, documents, téléphone, véhicule…', lignes: 2, max: 600 },
  { cle: 'moyens_humains', lib: 'Les moyens humains', aide: 'Qui était là ? Qui t’a aidé ou formé ? (postes, pas de noms de famille)', lignes: 2, max: 600 },
  { cle: 'deroulement', lib: 'Le déroulement', aide: 'Étape par étape. Distingue ce que tu as fait toi-même de ce que tu as observé.', lignes: 6, max: 3000, requis: true },
  { cle: 'difficultes', lib: 'Les difficultés', aide: 'Ce qui a été difficile, et comment tu (ou ton tuteur) l’as géré.', lignes: 3, max: 1000, requis: true },
  { cle: 'resultats', lib: 'Les résultats', aide: 'Ce que la mission a donné : rendez-vous obtenus, vente, client satisfait… (sans chiffres confidentiels)', lignes: 3, max: 1000, requis: true },
  { cle: 'ameliorations', lib: 'Les points d’amélioration', aide: 'Si c’était à refaire, que ferais-tu différemment ?', lignes: 3, max: 1000, requis: true },
  { cle: 'preuves', lib: 'Les preuves', aide: 'Ce que tu peux montrer : document réalisé, capture d’écran, fiche produit… (sans données confidentielles)', lignes: 2, max: 800 },
];
const ROLES = { observe: '👀 Je l’ai observée', participe: '🤝 J’y ai participé', realise: '⭐ Je l’ai réalisée' };

export function editeurMission(bloc) {
  return (zone, contenu, { lectureSeule, changer }) => {
    const dis = lectureSeule ? ' disabled' : '';
    const req = ' <span class="requis" title="obligatoire">*</span>';
    const choisies = new Set(contenu.competences || []);
    let liees = new Set(contenu.activites || []);
    let activites = [];
    const codesBloc = new Set(bloc.competences.map((c) => c.code));
    zone.innerHTML = `
      <div class="bandeau info"><p>📝 Choisis <b>une</b> mission de ce bloc, réalisée ou simplement observée, et raconte-la en suivant la trame. Pars d’une activité de ton journal.</p></div>
      <form class="carte" novalidate>
        <div class="groupe-titre" style="margin-top:0">Activités de ton journal pour ce bloc</div>
        <div data-activites><p class="discret petit">Chargement…</p></div>
        <div class="groupe-titre">La mission</div>
        <label class="champ"><span class="lib">Intitulé de la mission${req}</span>
          <input name="titre" maxlength="150" value="${esc(contenu.titre || '')}"${dis} placeholder="ex. Préparer et mener une séance de phoning"></label>
        <fieldset><legend>Ton rôle${req}</legend><div class="choix">${Object.entries(ROLES).map(([k, l]) => `
          <label><input type="radio" name="role" value="${k}"${contenu.role === k ? ' checked' : ''}${dis}>${l}</label>`).join('')}</div></fieldset>
        ${TRAME_MISSION.map((t) => `<label class="champ"><span class="lib">${esc(t.lib)}${t.requis ? req : ''}</span>
          <textarea name="${t.cle}" rows="${t.lignes}" maxlength="${t.max}"${dis}>${esc(contenu[t.cle] || '')}</textarea><span class="aide">${esc(t.aide)}</span></label>`).join('')}
        <fieldset><legend>Compétences mobilisées${req}</legend>
          <div class="cases">${bloc.competences.map((c) => `<label><input type="checkbox" name="competences" value="${c.code}"${choisies.has(c.code) ? ' checked' : ''}${dis}> ${esc(c.libelle)}</label>`).join('')}</div></fieldset>
      </form>`;
    const form = zone.querySelector('form');
    form.addEventListener('submit', (e) => e.preventDefault());
    const lire = () => {
      const r = { titre: form.elements.titre.value, role: (form.querySelector('input[name=role]:checked') || {}).value || '' };
      for (const t of TRAME_MISSION) r[t.cle] = form.elements[t.cle].value;
      r.competences = [...form.querySelectorAll('input[name=competences]:checked')].map((x) => x.value);
      r.activites = [...liees];
      return r;
    };
    const zoneAct = zone.querySelector('[data-activites]');
    function dessinerActivites() {
      const duBloc = activites.filter((a) => a.competence && codesBloc.has(a.competence));
      const autres = activites.filter((a) => liees.has(a.id) && !duBloc.includes(a));
      const liste = [...duBloc, ...autres];
      zoneAct.innerHTML = liste.length ? `<div class="cases">${liste.map((a) => `<label><input type="checkbox" data-act="${a.id}"${liees.has(a.id) ? ' checked' : ''}${dis}>
          <span>${NIVEAUX_EMO[a.niveau]} ${esc(a.texte)} <span class="discret petit">(${esc(dateCourteFr(a.jour))})</span></span></label>`).join('')}</div>
        <p class="aide">Coche l’activité (ou les activités) que raconte ta fiche.</p>`
        : '<p class="discret petit">Aucune activité de ce bloc dans ton journal pour l’instant. Note-les au fil des jours, en choisissant une compétence de ce bloc. Si tu n’as pas pu travailler ce bloc en entreprise, parles-en à ton professeur.</p>';
    }
    zoneAct.addEventListener('change', (e) => {
      const c = e.target.closest('[data-act]');
      if (!c) return;
      const id = Number(c.dataset.act);
      if (c.checked) {
        liees.add(id);
        const a = activites.find((x) => x.id === id);
        if (a && !form.elements.titre.value) form.elements.titre.value = a.texte.slice(0, 150);
        if (a && !form.querySelector('input[name=role]:checked')) { const r = form.querySelector(`input[name=role][value=${a.niveau}]`); if (r) r.checked = true; }
        if (a && a.competence && codesBloc.has(a.competence)) { const cc = form.querySelector(`input[name=competences][value="${a.competence}"]`); if (cc) cc.checked = true; }
      } else liees.delete(id);
      changer(lire());
    });
    form.addEventListener('input', (e) => { if (!e.target.closest('[data-act]')) changer(lire()); });
    form.addEventListener('change', (e) => { if (!e.target.closest('[data-act]')) changer(lire()); });
    get('/eleve/journal').then((d) => { activites = d.activites; dessinerActivites(); }).catch(() => { zoneAct.innerHTML = '<p class="discret petit">Journal indisponible pour l’instant.</p>'; });
    return { definirLectureSeule(v) { form.querySelectorAll('input, textarea').forEach((x) => { x.disabled = v; }); } };
  };
}

const NIVEAUX_EMO = { observe: '👀', participe: '🤝', realise: '⭐' };
const dateCourteFr = (j) => new Date(`${j}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

export function lectureMission(c, bloc, journal = []) {
  const v = (x) => (x ? esc(x) : '<span class="discret">—</span>');
  const comp = bloc.competences.filter((x) => (c.competences || []).includes(x.code)).map((x) => esc(x.libelle));
  const acts = journal.filter((a) => (c.activites || []).includes(a.id));
  return `<dl class="fiche-lecture">
    <dt>Intitulé</dt><dd class="${c.titre ? '' : 'vide'}">${c.titre ? esc(c.titre) : 'manquant'}</dd>
    <dt>Rôle de l’élève</dt><dd>${c.role ? ROLES[c.role] : '<span class="discret">—</span>'}</dd>
    ${acts.length ? `<dt>Activités du journal liées</dt><dd>${acts.map((a) => `${NIVEAUX_EMO[a.niveau]} ${esc(a.texte)} (${esc(dateCourteFr(a.jour))})`).join('<br>')}</dd>` : ''}
    ${TRAME_MISSION.map((t) => `<dt>${esc(t.lib)}</dt><dd class="${c[t.cle] || !t.requis ? '' : 'vide'}">${c[t.cle] ? esc(c[t.cle]) : (t.requis ? 'manquant' : '<span class="discret">—</span>')}</dd>`).join('')}
    <dt>Compétences mobilisées</dt><dd>${comp.length ? comp.join('<br>') : '<span class="discret">—</span>'}</dd>
  </dl>`;
}

// ---------------------------------------------------------------- Interview

const MODES = { face: 'En face à face', telephone: 'Par téléphone', visio: 'En visio' };

export function editeurInterview(zone, contenu, { lectureSeule, changer }) {
  const dis = lectureSeule ? ' disabled' : '';
  const req = ' <span class="requis" title="obligatoire">*</span>';
  const questions = etat.config.questionsInterview;
  const rep = contenu.reponses || [];
  zone.innerHTML = `
    <div class="bandeau info"><p>🎤 Choisis un professionnel de l’entreprise (commercial, conseiller, responsable…) et demande-lui un rendez-vous de 20 minutes. Prends des notes pendant l’échange, puis rédige ses réponses ici.</p>
      <p class="petit">🔒 Demande-lui son accord. Pas de nom de famille ; pour la rémunération, une fourchette ou « fixe + primes » suffit.</p></div>
    <form class="carte" novalidate>
      <div class="groupe-titre" style="margin-top:0">La personne interrogée</div>
      <label class="champ"><span class="lib">Son poste${req}</span><input name="poste" maxlength="120" value="${esc(contenu.poste || '')}"${dis} placeholder="ex. Conseiller commercial"></label>
      <label class="champ"><span class="lib">Son prénom (si elle est d’accord)</span><input name="prenom" maxlength="60" value="${esc(contenu.prenom || '')}"${dis}></label>
      <div class="rangee" style="align-items:flex-start">
        <label class="champ" style="flex:1"><span class="lib">Date</span><input name="date" maxlength="20" value="${esc(contenu.date || '')}"${dis} placeholder="JJ/MM"></label>
        <label class="champ" style="flex:2"><span class="lib">Comment ?</span><select name="mode"${dis}><option value="">—</option>${Object.entries(MODES).map(([k, l]) => `<option value="${k}"${contenu.mode === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      </div>
      <div class="groupe-titre">Les 10 questions</div>
      ${questions.map((q, i) => `<label class="champ"><span class="lib">${i + 1}. ${esc(q)}</span>
        <textarea name="r${i}" rows="3" maxlength="1500"${dis}>${esc(rep[i] || '')}</textarea></label>`).join('')}
      <div class="groupe-titre">Et toi ?</div>
      <label class="champ"><span class="lib">Ce que cette interview m’a appris${req}</span>
        <textarea name="appris" rows="4" maxlength="1500"${dis} placeholder="Sur le métier, sur ce qu’il faut pour le faire, sur mon projet…">${esc(contenu.appris || '')}</textarea></label>
    </form>`;
  const form = zone.querySelector('form');
  form.addEventListener('submit', (e) => e.preventDefault());
  const lire = () => ({
    poste: form.elements.poste.value, prenom: form.elements.prenom.value, date: form.elements.date.value, mode: form.elements.mode.value,
    reponses: questions.map((_, i) => form.elements[`r${i}`].value), appris: form.elements.appris.value,
  });
  form.addEventListener('input', () => changer(lire()));
  form.addEventListener('change', () => changer(lire()));
  return { definirLectureSeule(v) { form.querySelectorAll('input, textarea, select').forEach((x) => { x.disabled = v; }); } };
}

export function lectureInterview(c) {
  const q = etat.config.questionsInterview;
  return `<dl class="fiche-lecture">
    <dt>Personne interrogée</dt><dd>${c.poste ? esc(c.poste) : '<span class="discret">—</span>'}${c.prenom ? ` (${esc(c.prenom)})` : ''}${c.date ? ` · ${esc(c.date)}` : ''}${c.mode ? ` · ${MODES[c.mode]}` : ''}</dd>
    ${q.map((x, i) => `<dt>${i + 1}. ${esc(x)}</dt><dd class="${(c.reponses || [])[i] ? '' : 'vide'}">${(c.reponses || [])[i] ? esc(c.reponses[i]) : 'pas de réponse'}</dd>`).join('')}
    <dt>Ce que l’interview lui a appris</dt><dd class="${c.appris ? '' : 'vide'}">${c.appris ? esc(c.appris) : 'manquant'}</dd>
  </dl>`;
}

// ---------------------------------------------------------------- Retour de l'IA

export function relectureHtml(r, { pourProf = false } = {}) {
  if (!r) return '';
  return `<div class="relecture">
    <p class="relecture-titre">🤖 ${pourProf ? 'Dernier retour de la relecture IA' : 'Retour de la relecture'} <span class="discret petit">· ${esc(new Date(r.cree_le.replace(' ', 'T') + 'Z').toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</span></p>
    ${r.positif && r.positif.length ? `<p class="relecture-sous">👍 Ce qui va bien</p><ul>${r.positif.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${r.ameliorer && r.ameliorer.length ? `<p class="relecture-sous">🛠 À améliorer</p><ul>${r.ameliorer.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${r.question ? `<p class="relecture-sous">❓ Pour aller plus loin</p><p>${esc(r.question)}</p>` : ''}
  </div>`;
}
