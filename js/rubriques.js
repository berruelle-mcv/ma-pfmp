// Définition des rubriques du dossier (formulaires et lecture).
import { esc, nbMots, modale, imprimer, toast } from './ui.js';
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
  { groupe: 'Mon tuteur', champs: [
    { cle: 'tuteur_nom', lib: 'Prénom et nom de mon tuteur', requis: true, max: 120 },
    { cle: 'tuteur_fonction', lib: 'Sa fonction', max: 120, aide: 'Ex. négociatrice immobilière, responsable commercial…' },
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

// Aide affichée sous chaque question (les intitulés courts viennent du serveur).
export const AIDES_INTRO = [
  'Candidatures, relations, aide du lycée… Dire que ça a été difficile est une vraie réponse.',
  'En une ou deux phrases : son activité, ses clients.',
  'L’accueil, l’ambiance, ce qui t’a surpris.',
  'Pendant ces quatre semaines.',
];
export const AMORCES_INTRO = [
  'J’ai trouvé ce stage grâce à …',
  'Mon entreprise, …, est spécialisée dans …',
  'Le premier jour, j’ai remarqué que …',
  'Pendant ces quatre semaines, j’aimerais apprendre à …',
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
  const dis = lectureSeule ? ' disabled' : '';
  const Q = etat.config.questionsIntro;
  const rep = contenu.reponses || [];
  zone.innerHTML = `
    <div class="bandeau info"><p>✍️ Réponds à chaque question en 1 à 3 phrases. Dans ton dossier, tes quatre réponses formeront ton introduction : écris de vraies phrases qui s’enchaînent.</p></div>
    ${contenu.texte ? `<div class="carte"><p class="petit"><b>Ton ancien texte</b> (à reprendre dans les cases ci-dessous) :</p><div class="texte-lecture petit">${esc(contenu.texte)}</div></div>` : ''}
    <form class="carte" novalidate>${Q.map((q, i) => `<label class="champ"><span class="lib">${i + 1}. ${esc(q)} <span class="requis">*</span></span>
      <textarea name="r${i}" rows="3" maxlength="800"${dis} placeholder="${esc(AMORCES_INTRO[i])}">${esc(rep[i] || '')}</textarea>
      <span class="aide">${esc(AIDES_INTRO[i])} <span data-compte="${i}"></span></span></label>`).join('')}
      <p class="aide" data-total></p></form>`;
  const form = zone.querySelector('form');
  form.addEventListener('submit', (e) => e.preventDefault());
  const lire = () => ({ reponses: Q.map((_, i) => form.elements[`r${i}`].value) });
  const compter = () => {
    const r = lire().reponses;
    r.forEach((x, i) => { const n = nbMots(x); zone.querySelector(`[data-compte="${i}"]`).textContent = n ? (n < 6 ? '· un peu court' : '· ✓') : ''; });
    const t = nbMots(r.join(' '));
    zone.querySelector('[data-total]').textContent = `${t} mots en tout${t < 40 ? ' (objectif : 40 mots au moins, environ 5 lignes)' : t > 160 ? ' : c’est déjà long, 10 lignes maximum.' : ' ✓'}`;
  };
  form.addEventListener('input', () => { compter(); changer(lire()); });
  compter();
  return { definirLectureSeule(v) { form.querySelectorAll('textarea').forEach((x) => { x.disabled = v; }); } };
}

export const texteIntroduction = (c) => (c.texte ? c.texte : (c.reponses || []).map((x) => x.trim()).filter(Boolean).map((x) => (/[.!?…]$/.test(x) ? x : `${x}.`)).join(' '));
export const lectureIntroduction = (c) => { const t = texteIntroduction(c); return t ? `<div class="texte-lecture">${esc(t)}</div><p class="discret petit">${nbMots(t)} mots</p>` : '<p class="discret">Pas encore rédigée.</p>'; };

// ---------------------------------------------------------------- Veille concurrentielle et commerciale


export const CHAMPS_CONCURRENT = [
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

export const TRAME_MISSION = [
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

export const MODES = { face: 'En face à face', telephone: 'Par téléphone', visio: 'En visio' };

export function editeurInterview(zone, contenu, { lectureSeule, changer }) {
  const dis = lectureSeule ? ' disabled' : '';
  const req = ' <span class="requis" title="obligatoire">*</span>';
  const questions = etat.config.questionsInterview;
  const rep = contenu.reponses || [];
  zone.innerHTML = `
    <div class="carte guide-interview"><h2>🎤 Comment faire ton interview</h2>
      <ol>
        <li><b>Choisis un professionnel</b> de l’entreprise (commercial, conseiller, responsable…) et demande-lui un rendez-vous :
          <span class="phrase-type">« Bonjour, dans le cadre de mon stage, je dois interviewer un professionnel sur son métier. Auriez-vous 20 minutes à m’accorder cette semaine ? »</span></li>
        <li><b>Imprime la fiche d’interview</b> (ou garde-la sur ton téléphone) : les 10 questions avec de la place pour noter.</li>
        <li><b>Pendant l’entretien</b>, prends des notes. Tu peux aussi l’enregistrer avec le dictaphone de ton téléphone, <b>si la personne est d’accord</b>, pour le réécouter ensuite.</li>
        <li><b>Remercie-la</b>, puis rédige ses réponses ici avec des phrases complètes.</li>
      </ol>
      <p class="petit">🔒 Pas de nom de famille ; pour la rémunération, une fourchette ou « fixe + primes » suffit.</p>
      <button class="btn secondaire petit" type="button" data-fiche-interview>🖨 Imprimer la fiche d’interview</button></div>
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
  zone.querySelector('[data-fiche-interview]').addEventListener('click', () => imprimer(ficheInterviewHtml()));
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

function ficheInterviewHtml() {
  const u = etat.utilisateur;
  return `<div class="fiche-interview">
    <h1>Fiche d’interview — ${esc(u.prenom)} ${esc(u.nom)}</h1>
    <p><b>Personne interrogée</b> (poste) : ........................................................ &nbsp; Prénom (si accord) : ..........................  &nbsp; Date : ............</p>
    <div class="rappel">Avant de commencer : je me présente, j’explique que c’est pour mon dossier de PFMP et je demande son accord (et pour l’enregistrement, si je veux enregistrer).<br>
    À la fin : je remercie la personne pour son temps.</div>
    ${etat.config.questionsInterview.map((q, i) => `<div class="q-interview"><b>${i + 1}. ${esc(q)}</b><div class="lignes"></div></div>`).join('')}
  </div>`;
}

export function lectureInterview(c) {
  const q = etat.config.questionsInterview;
  return `<dl class="fiche-lecture">
    <dt>Personne interrogée</dt><dd>${c.poste ? esc(c.poste) : '<span class="discret">—</span>'}${c.prenom ? ` (${esc(c.prenom)})` : ''}${c.date ? ` · ${esc(c.date)}` : ''}${c.mode ? ` · ${MODES[c.mode]}` : ''}</dd>
    ${q.map((x, i) => `<dt>${i + 1}. ${esc(x)}</dt><dd class="${(c.reponses || [])[i] ? '' : 'vide'}">${(c.reponses || [])[i] ? esc(c.reponses[i]) : 'pas de réponse'}</dd>`).join('')}
    <dt>Ce que l’interview m’a appris</dt><dd class="${c.appris ? '' : 'vide'}">${c.appris ? esc(c.appris) : 'manquant'}</dd>
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

// ---------------------------------------------------------------- Check-list de semaine 4

export function editeurChecklist(zone, contenu, { lectureSeule, changer }) {
  const dis = lectureSeule ? ' disabled' : '';
  const items = etat.config.checklist;
  zone.innerHTML = `
    <div class="bandeau info"><p>✅ Ta dernière semaine en entreprise : vérifie que tu repars avec tout ce qu’il te faut pour finir ton dossier pendant les vacances.</p></div>
    <form class="carte" novalidate>
      <div class="cases grandes-cases">${items.map((t, i) => `<label><input type="checkbox" name="c${i}"${contenu.cases && contenu.cases[i] ? ' checked' : ''}${dis}> ${esc(t)}</label>`).join('')}</div>
      <label class="champ" style="margin-top:1rem"><span class="lib">Ce qu’il me manque encore (facultatif)</span>
        <textarea name="note" rows="2" maxlength="600"${dis} placeholder="ex. Je dois encore demander l’effectif exact.">${esc(contenu.note || '')}</textarea></label>
    </form>`;
  const form = zone.querySelector('form');
  form.addEventListener('submit', (e) => e.preventDefault());
  const lire = () => ({ cases: items.map((_, i) => form.elements[`c${i}`].checked), note: form.elements.note.value });
  form.addEventListener('input', () => changer(lire()));
  form.addEventListener('change', () => changer(lire()));
  return { definirLectureSeule(v) { form.querySelectorAll('input, textarea').forEach((x) => { x.disabled = v; }); } };
}

export function lectureChecklist(c) {
  return `<ul class="liste-check">${etat.config.checklist.map((t, i) => `<li>${c.cases && c.cases[i] ? '✅' : '⬜'} ${esc(t)}</li>`).join('')}</ul>
    ${c.note ? `<p class="discret">Ce qu’il lui manque : ${esc(c.note)}</p>` : ''}`;
}

// ---------------------------------------------------------------- Mon bilan

export const CHAMPS_BILAN = [
  { cle: 'positif', lib: 'Ce que je retiens de positif', aide: 'Sur le plan professionnel et personnel : ce que tu as aimé, réussi, appris. Donne des exemples.', requis: true },
  { cle: 'difficile', lib: 'Ce qui a été difficile', aide: 'Ce qui t’a moins plu ou mis en difficulté, et comment tu as réagi.', requis: true },
  { cle: 'integration', lib: 'Mon intégration dans l’équipe', aide: 'Comment tu as été accueilli, tes relations avec ton tuteur, les salariés, les clients.', requis: true },
  { cle: 'apport', lib: 'Ce que cette PFMP m’a apporté', aide: 'Sur le monde du travail, sur le métier, sur mon orientation.', requis: true },
  { cle: 'equipe', lib: 'Ce que je retiens de mon tuteur et de l’équipe', aide: 'Facultatif : un conseil reçu, une personne qui t’a marqué, un merci.', requis: false },
];

export function editeurBilan(zone, contenu, { lectureSeule, changer }) {
  const dis = lectureSeule ? ' disabled' : '';
  zone.innerHTML = `
    <div class="bandeau info"><p>🏁 Prends du recul sur tes quatre semaines. Sois honnête : un stage difficile peut faire un très bon bilan.</p></div>
    <form class="carte" novalidate>${CHAMPS_BILAN.map((c) => `<label class="champ"><span class="lib">${esc(c.lib)}${c.requis ? ' <span class="requis">*</span>' : ''}</span>
      <textarea name="${c.cle}" rows="4" maxlength="1500"${dis}>${esc(contenu[c.cle] || '')}</textarea><span class="aide">${esc(c.aide)}</span></label>`).join('')}</form>`;
  const form = zone.querySelector('form');
  form.addEventListener('submit', (e) => e.preventDefault());
  const lire = () => Object.fromEntries(CHAMPS_BILAN.map((c) => [c.cle, form.elements[c.cle].value]));
  form.addEventListener('input', () => changer(lire()));
  return { definirLectureSeule(v) { form.querySelectorAll('textarea').forEach((x) => { x.disabled = v; }); } };
}

export const lectureBilan = (c) => `<dl class="fiche-lecture">${CHAMPS_BILAN.map((x) => `<dt>${esc(x.lib)}</dt><dd class="${c[x.cle] || !x.requis ? '' : 'vide'}">${c[x.cle] ? esc(c[x.cle]) : (x.requis ? 'manquant' : '<span class="discret">—</span>')}</dd>`).join('')}</dl>`;

// ---------------------------------------------------------------- Projet professionnel

export function editeurProjet(zone, contenu, { lectureSeule, changer }) {
  const dis = lectureSeule ? ' disabled' : '';
  const amorces = etat.config.amorcesProjet;
  zone.innerHTML = `
    <div class="bandeau info"><p>🧭 Complète chaque début de phrase avec tes propres mots. Ne pas encore savoir est une vraie réponse : explique simplement pourquoi.</p></div>
    <form class="carte" novalidate>${amorces.map((a, i) => `<label class="champ"><span class="lib">${i + 1}. ${esc(a)}${i === 1 || i === 2 ? ' <span class="requis">*</span>' : ''}</span>
      <textarea name="r${i}" rows="2" maxlength="800"${dis}>${esc((contenu.reponses || [])[i] || '')}</textarea></label>`).join('')}</form>`;
  const form = zone.querySelector('form');
  form.addEventListener('submit', (e) => e.preventDefault());
  const lire = () => ({ reponses: amorces.map((_, i) => form.elements[`r${i}`].value) });
  form.addEventListener('input', () => changer(lire()));
  return { definirLectureSeule(v) { form.querySelectorAll('textarea').forEach((x) => { x.disabled = v; }); } };
}

export const lectureProjet = (c) => `<dl class="fiche-lecture">${etat.config.amorcesProjet.map((a, i) => `<dt>${esc(a)}</dt><dd class="${(c.reponses || [])[i] ? '' : 'vide'}">${(c.reponses || [])[i] ? esc(c.reponses[i]) : 'non complétée'}</dd>`).join('')}</dl>`;

// ---------------------------------------------------------------- Auto-évaluation

export const NIV_AUTO = [['pas_encore', 'Pas encore'], ['en_progres', 'En progrès'], ['acquis', 'Acquis'], ['tres_bien', 'Très bien']];

export function editeurAutoeval(zone, contenu, { lectureSeule, changer }) {
  const dis = lectureSeule ? ' disabled' : '';
  const att = etat.config.attitudes;
  zone.innerHTML = `
    <div class="bandeau info"><p>🪞 Pour chaque attitude, choisis ton niveau pendant la PFMP. Un exemple concret rend ton auto-évaluation crédible (facultatif).</p></div>
    <form class="carte" novalidate>
      ${att.map((a) => `<fieldset class="attitude"><legend>${esc(a.libelle)}</legend>
        <div class="choix choix-petit">${NIV_AUTO.map(([k, l]) => `<label><input type="radio" name="n-${a.code}" value="${k}"${contenu.niveaux && contenu.niveaux[a.code] === k ? ' checked' : ''}${dis}>${l}</label>`).join('')}</div>
        <input name="e-${a.code}" maxlength="300" value="${esc((contenu.exemples || {})[a.code] || '')}"${dis} placeholder="Un exemple (facultatif)" style="margin-top:.5rem">
      </fieldset>`).join('')}
      <label class="champ"><span class="lib">L’attitude dont je suis le plus fier, et pourquoi <span class="requis">*</span></span>
        <textarea name="fierte" rows="2" maxlength="600"${dis}>${esc(contenu.fierte || '')}</textarea></label>
      <label class="champ"><span class="lib">L’attitude que je veux améliorer, et comment <span class="requis">*</span></span>
        <textarea name="progres" rows="2" maxlength="600"${dis}>${esc(contenu.progres || '')}</textarea></label>
    </form>`;
  const form = zone.querySelector('form');
  form.addEventListener('submit', (e) => e.preventDefault());
  const lire = () => ({
    niveaux: Object.fromEntries(att.map((a) => [a.code, (form.querySelector(`input[name="n-${a.code}"]:checked`) || {}).value || ''])),
    exemples: Object.fromEntries(att.map((a) => [a.code, form.elements[`e-${a.code}`].value])),
    fierte: form.elements.fierte.value, progres: form.elements.progres.value,
  });
  form.addEventListener('input', () => changer(lire()));
  form.addEventListener('change', () => changer(lire()));
  return { definirLectureSeule(v) { form.querySelectorAll('input, textarea').forEach((x) => { x.disabled = v; }); } };
}

export function lectureAutoeval(c) {
  const lib = Object.fromEntries(NIV_AUTO);
  return `<table class="liste"><thead><tr><th>Attitude</th><th>Niveau</th><th>Exemple</th></tr></thead><tbody>
    ${etat.config.attitudes.map((a) => `<tr><td>${esc(a.libelle)}</td><td>${c.niveaux && c.niveaux[a.code] ? esc(lib[c.niveaux[a.code]]) : '<span class="discret">—</span>'}</td><td>${esc((c.exemples || {})[a.code] || '')}</td></tr>`).join('')}
    </tbody></table>
    <dl class="fiche-lecture"><dt>Attitude dont il est le plus fier</dt><dd>${c.fierte ? esc(c.fierte) : '<span class="discret">—</span>'}</dd>
    <dt>Attitude à améliorer</dt><dd>${c.progres ? esc(c.progres) : '<span class="discret">—</span>'}</dd></dl>`;
}

// ---------------------------------------------------------------- Trame de l'oral

const court = (t, n = 90) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

export function diaposHtml(c, nom = '') {
  return etat.config.diaposOral.map((x, i) => {
    const d = (c.diapos || {})[x.cle] || { points: [] };
    return `<div class="diapo"><div class="diapo-num">${i + 1}/4</div><h3>${esc(d.titre || x.titre)}</h3>
      <ul>${(d.points || []).filter(Boolean).map((p) => `<li>${esc(p)}</li>`).join('') || '<li class="discret">(à compléter)</li>'}</ul>${nom ? `<div class="diapo-pied">${esc(nom)} · PFMP 1MCVB</div>` : ''}</div>`;
  }).join('');
}

export function editeurOral(zone, contenu, { lectureSeule, changer }) {
  const dis = lectureSeule ? ' disabled' : '';
  const D = etat.config.diaposOral;
  const missions = etat.config.blocs.map((b) => [`mission_${b.code.toLowerCase()}`, etat.config.sections[`mission_${b.code.toLowerCase()}`].titre]);
  zone.innerHTML = `
    <div class="bandeau info"><p>🎤 Ton oral : 5 minutes de présentation, puis 5 minutes d’échange. Prépare 4 diapos, avec <b>5 informations au plus</b> par diapo : des mots-clés, pas des phrases. Tu les recopieras ensuite dans ton diaporama sur Pearltrees.</p></div>
    ${lectureSeule ? '' : '<div class="rangee" style="margin-bottom:1rem"><button class="btn secondaire petit" type="button" data-preremplir>✨ Remplir à partir de mon dossier</button><button class="btn neutre petit" type="button" data-apercu>👁 Voir mes diapos</button></div>'}
    <form class="carte" novalidate>
      <label class="champ"><span class="lib">La fiche mission que je présente</span>
        <select name="mission_choisie"${dis}><option value="">— Choisir —</option>${missions.map(([k, t]) => `<option value="${k}"${contenu.mission_choisie === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      ${D.map((x, i) => {
    const d = (contenu.diapos || {})[x.cle] || { points: [] };
    return `<fieldset class="diapo-edit"><legend>Diapo ${i + 1} — ${esc(x.titre)}</legend>
        <p class="aide" style="margin-top:0">${esc(x.aide)}</p>
        <label class="champ"><span class="lib">Titre de la diapo</span><input name="${x.cle}-titre" maxlength="100" value="${esc(d.titre || '')}" placeholder="${esc(x.titre)}"${dis}></label>
        ${[0, 1, 2, 3, 4].map((j) => `<input class="point" name="${x.cle}-p${j}" maxlength="160" value="${esc((d.points || [])[j] || '')}" placeholder="Information ${j + 1}${j < 2 ? ' *' : ' (facultatif)'}"${dis}>`).join('')}
        <label class="champ" style="margin-top:.75rem"><span class="lib">Ce que je dirai (mes notes)</span><textarea name="${x.cle}-notes" rows="2" maxlength="1200"${dis}>${esc(d.notes || '')}</textarea></label>
      </fieldset>`;
  }).join('')}
    </form>`;
  const form = zone.querySelector('form');
  form.addEventListener('submit', (e) => e.preventDefault());
  const lire = () => ({
    mission_choisie: form.elements.mission_choisie.value,
    diapos: Object.fromEntries(D.map((x) => [x.cle, { titre: form.elements[`${x.cle}-titre`].value, points: [0, 1, 2, 3, 4].map((j) => form.elements[`${x.cle}-p${j}`].value), notes: form.elements[`${x.cle}-notes`].value }])),
  });
  form.addEventListener('input', () => changer(lire()));
  form.addEventListener('change', () => changer(lire()));

  const remplir = (cle, valeurs) => {
    const vides = [0, 1, 2, 3, 4].map((j) => form.elements[`${cle}-p${j}`]).filter((x) => !x.value);
    valeurs.filter(Boolean).slice(0, vides.length).forEach((v, k) => { vides[k].value = court(v); });
  };
  const bPre = zone.querySelector('[data-preremplir]');
  if (bPre) bPre.addEventListener('click', async () => {
    bPre.disabled = true;
    try {
      const lireS = async (k) => { try { return (await get(`/eleve/sections/${k}`)).contenu; } catch { return {}; } };
      const [id, itv, bil] = await Promise.all([lireS('identite'), lireS('interview'), lireS('bilan')]);
      remplir('entreprise', [id.denomination, id.activite, id.effectif ? `Effectif : ${id.effectif}` : '', id.adresse, id.clientele ? `Clientèle : ${id.clientele}` : '']);
      const mk = form.elements.mission_choisie.value;
      if (mk) {
        const mi = await lireS(mk);
        remplir('mission', [mi.titre, { observe: 'Mission observée', participe: 'J’y ai participé', realise: 'Je l’ai réalisée' }[mi.role], mi.objectifs, mi.resultats, mi.ameliorations]);
      }
      remplir('interview', [itv.poste ? `Interview : ${itv.poste}` : '', itv.appris]);
      remplir('bilan', [bil.positif, bil.difficile, bil.apport, 'Merci à mon tuteur et à toute l’équipe']);
      changer(lire());
      toast('Prérempli à partir de ton dossier. Raccourcis maintenant chaque information : quelques mots suffisent !', 'ok', 6000);
    } finally { bPre.disabled = false; }
  });
  const bAp = zone.querySelector('[data-apercu]');
  if (bAp) bAp.addEventListener('click', () => {
    const m = modale('Mes 4 diapos', `<div class="diapos">${diaposHtml(lire())}</div>
      <button class="btn secondaire plein" type="button" data-imprimer style="margin-top:1rem">🖨 Imprimer ou enregistrer en PDF</button>`);
    m.el.querySelector('[data-imprimer]').addEventListener('click', () => imprimer(`<div class="diapos impr">${diaposHtml(lire(), `${etat.utilisateur.prenom} ${etat.utilisateur.nom}`)}</div>`));
  });
  return { definirLectureSeule(v) { form.querySelectorAll('input, textarea, select').forEach((x) => { x.disabled = v; }); } };
}

export function lectureOral(c) {
  return `<div class="diapos">${diaposHtml(c)}</div>
    ${etat.config.diaposOral.map((x) => (c.diapos && c.diapos[x.cle] && c.diapos[x.cle].notes ? `<p class="petit"><b>Notes — ${esc(x.titre)} :</b> ${esc(c.diapos[x.cle].notes)}</p>` : '')).join('')}`;
}
