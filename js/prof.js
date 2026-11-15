// Écrans enseignant : classe, fiche élève, carte des compétences, comptes.
import { get, post, patch, del } from './api.js';
import { etat } from './app.js';
import {
  $, esc, toast, action, modale, dateLongue, dateCourte, ilYA, joursOuvres, imprimer,
  NIVEAUX, MOMENTS, MOTIFS, pastilleStatut,
} from './ui.js';
import { lectureIdentite, lectureIntroduction, lectureVeille, lectureMission, lectureInterview, lectureChecklist, lectureBilan, lectureProjet, lectureAutoeval, lectureOral, relectureHtml } from './rubriques.js';
import { arbreHtml } from './orga.js';
import { afficherDossierComplet } from './complet.js';
import { imagesProfHtml, hydraterImages } from './images.js';
import { commentaireHtml } from './eleve.js';
import { fabriquerPdf, nomFichier, telecharger } from './pdf.js';

const routeurRecharger = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

const RUBRIQUES = ['identite', 'organigramme', 'introduction', 'veille', 'interview', 'mission_b1', 'mission_b2', 'mission_b3', 'mission_b4', 'checklist', 'bilan', 'projet', 'autoeval', 'oral'];
const COURT = { identite: 'Fiche', organigramme: 'Orga', introduction: 'Intro', veille: 'Veille', interview: 'Interview', mission_b1: 'B1', mission_b2: 'B2', mission_b3: 'B3', mission_b4: 'B4', checklist: 'Check', bilan: 'Bilan', projet: 'Projet', autoeval: 'Auto', oral: 'Oral' };
const SYMB = { vide: ['·', 'ms-vide', 'à faire'], brouillon: ['✎', 'ms-brouillon', 'brouillon'], soumis: ['✓', 'ms-soumis', 'terminée'], a_revoir: ['!', 'ms-revoir', 'à revoir'], valide: ['✓✓', 'ms-valide', 'validée'] };
function miniStatuts(sections) {
  const un = (cle) => { const st = sections[cle].commence ? sections[cle].statut : 'vide'; const [sy, cl, lib] = SYMB[st] || SYMB.vide; return `<span class="${cl}" title="${esc(titre(cle))} : ${lib}">${COURT[cle]} <b>${sy}</b></span>`; };
  return `<div class="mini-statuts">${['identite', 'organigramme', 'introduction', 'veille'].map(un).join('')}</div><div class="mini-statuts">${['interview', 'mission_b1', 'mission_b2', 'mission_b3', 'mission_b4'].map(un).join('')}</div><div class="mini-statuts">${['checklist', 'bilan', 'projet', 'autoeval', 'oral'].map(un).join('')}</div>`;
}
const initiales = (p) => (p ? `${p.prenom.charAt(0)}${p.nom.charAt(0)}`.toUpperCase() : '');
const titre = (cle) => etat.config.sections[cle].titre;

function toutesCompetences() {
  return etat.config.blocs.flatMap((b) => b.competences.map((c) => ({ ...c, bloc: b })));
}
function meilleurNiveau(c) {
  if (!c) return null;
  if (c.realise) return 'realise';
  if (c.participe) return 'participe';
  if (c.observe) return 'observe';
  return null;
}

// ---------------------------------------------------------------- Actions sur un compte (fiche élève et écran Comptes)

function nouveauCode(e, bouton) {
  if (!confirm(`Créer un nouveau code pour ${e.prenom} ${e.nom} ? L’ancien ne marchera plus (son travail est conservé).`)) return;
  action(bouton, async () => {
    const r = await post(`/prof/eleves/${e.id}/nouveau-code`);
    const m = modale('Nouveau code', `<p>${esc(r.prenom)} ${esc(r.nom)}<br>Identifiant : <code>${esc(r.identifiant)}</code></p>
      <span class="code-affiche">${esc(r.code)}</span><p class="discret petit">Note-le maintenant : il ne sera plus affiché.</p>
      <button class="btn secondaire plein" type="button" data-imprimer>🖨 Imprimer</button>`);
    m.el.querySelector('[data-imprimer]').addEventListener('click', () => imprimer(fichesCodes([r])));
  });
}

function supprimerEleve(e, bouton, apres) {
  const saisie = prompt(`Suppression définitive de ${e.prenom} ${e.nom} et de tout son travail (journal, dossier, photos).\nPour confirmer, tape son identifiant : ${e.identifiant}`);
  if (saisie === null) return;
  if (saisie.trim() !== e.identifiant) { toast('Identifiant incorrect : rien n’a été supprimé.', 'erreur'); return; }
  action(bouton, async () => {
    await del(`/prof/eleves/${e.id}`, { confirmation: e.identifiant });
    toast('Élève supprimé.', 'ok');
    apres();
  });
}

// Prénom, nom et dates de stage.
function modifierEleve(e, apres) {
  const p = etat.config.pfmp;
  const fen = modale(`Modifier ${e.prenom} ${e.nom}`, `<form>
    <label class="champ"><span class="lib">Prénom</span><input name="prenom" maxlength="60" required value="${esc(e.prenom)}"></label>
    <label class="champ"><span class="lib">Nom</span><input name="nom" maxlength="80" required value="${esc(e.nom)}"></label>
    <fieldset><legend>Dates de son stage</legend>
      <p class="aide" style="margin-top:0">Laissez les dates officielles (${esc(dateCourte(p.debut))} → ${esc(dateCourte(p.fin))}) sauf pour un élève qui commence en retard ou finit plus tôt.</p>
      <div class="rangee"><label class="champ" style="flex:1"><span class="lib">Du</span><input type="date" name="debut" min="${p.debut}" max="${p.finPossible}" value="${esc((e.stage && e.stage.debut) || e.stage_debut || p.debut)}"></label>
      <label class="champ" style="flex:1"><span class="lib">Au</span><input type="date" name="fin" min="${p.debut}" max="${p.finPossible}" value="${esc((e.stage && e.stage.fin) || e.stage_fin || p.fin)}"></label></div>
    </fieldset>
    <p class="discret petit">L’identifiant (${esc(e.identifiant)}) ne change pas.</p>
    <button class="btn plein" type="submit">Enregistrer</button></form>`);
  const f = fen.el.querySelector('form');
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    action(f.querySelector('[type=submit]'), async () => {
      const r = await patch(`/prof/eleves/${e.id}`, { prenom: f.prenom.value, nom: f.nom.value, stage_debut: f.debut.value || null, stage_fin: f.fin.value || null });
      fen.fermer();
      toast('Modifications enregistrées ✓', 'ok');
      apres(r);
    });
  });
}

// ---------------------------------------------------------------- Classe

export async function classe(vue) {
  const d = await get('/prof/classe');
  const moi = etat.utilisateur.id;
  const actifs = d.eleves.filter((e) => e.actif);
  const mesEleves = actifs.filter((e) => e.referent_id === moi);
  const referents = actifs.some((e) => e.referent_id);
  let filtre = mesEleves.length ? 'mes' : 'tous';
  const profs = new Map(d.profs.map((p) => [p.id, p]));

  function dessiner() {
    const base = filtre === 'inactifs' ? d.eleves.filter((e) => !e.actif) : (filtre === 'mes' ? mesEleves : actifs);
    const avecAlerte = (filtre === 'mes' ? mesEleves : actifs).filter((e) => e.alertes.length);
    const aLire = (filtre === 'mes' ? mesEleves : actifs).filter((e) => Object.values(e.sections).some((s) => s.statut === 'soumis'));
    const liste = filtre === 'alertes' ? avecAlerte : filtre === 'lire' ? aLire : base;
    const perimetre = filtre === 'mes' ? mesEleves : actifs;
    const nbLire = perimetre.reduce((n, e) => n + Object.values(e.sections).filter((s) => s.statut === 'soumis').length, 0);
    const jamais = perimetre.filter((e) => !e.derniere_connexion).length;
    vue.innerHTML = `
      <div class="rangee entre"><h1>Classe ${esc(d.pfmp.classe)}</h1><span class="discret">${esc(dateLongue(d.jour))}</span></div>
      <div class="chiffres">
        <div class="chiffre"><b>${perimetre.length}</b><span>${filtre === 'mes' ? 'élèves dont je suis référent' : 'élèves'}</span></div>
        <div class="chiffre"><b>${nbLire}</b><span>partie${nbLire > 1 ? 's' : ''} terminée${nbLire > 1 ? 's' : ''} à lire (facultatif)</span></div>
        <div class="chiffre"><b>${avecAlerte.length}</b><span>élève${avecAlerte.length > 1 ? 's' : ''} en alerte</span></div>
        <div class="chiffre"><b>${jamais}</b><span>jamais connecté${jamais > 1 ? 's' : ''}</span></div>
      </div>
      <div class="filtres">
        ${[...(referents ? [['mes', `Mes élèves (${mesEleves.length})`]] : []), ['tous', `Toute la classe (${actifs.length})`], ['alertes', `Alertes (${avecAlerte.length})`], ['lire', `À lire (${aLire.length})`], ['inactifs', 'Désactivés']]
    .map(([k, l]) => `<button type="button" data-filtre="${k}" class="${filtre === k ? 'actif' : ''}">${l}</button>`).join('')}
      </div>
      ${!d.eleves.length ? '<div class="carte"><p>Aucun élève pour l’instant.</p><a class="btn" href="#/comptes">Créer les comptes élèves</a></div>' : ''}
      ${filtre === 'mes' && !mesEleves.length && d.eleves.length ? '<div class="bandeau info"><p>Aucun élève ne vous est encore attribué. Choisissez les référents dans <a href="#/comptes">Comptes</a>.</p></div>' : ''}
      <div class="grille">${liste.map((e) => carteEleve(e, profs.get(e.referent_id))).join('') || (d.eleves.length ? '<p class="discret">Personne dans cette catégorie.</p>' : '')}</div>`;
  }

  vue.addEventListener('click', (e) => {
    const b = e.target.closest('[data-filtre]');
    if (b) { filtre = b.dataset.filtre; dessiner(); }
  });
  dessiner();
}

function carteEleve(e, referent) {
  const j = e.journal;
  const n = j.niveaux;
  return `<a class="carte lien carte-eleve${e.alertes.some((a) => a.niveau !== 'faible') ? ' alerte' : ''}" href="#/eleve/${e.id}">
    <div class="rangee entre"><h3>${esc(e.nom.toUpperCase())} ${esc(e.prenom)}${referent ? ` <span class="statut vide" title="Référent : ${esc(referent.prenom)}">${esc(initiales(referent))}</span>` : ''}</h3>
      <span class="discret petit">${e.derniere_connexion ? esc(ilYA(e.derniere_connexion)) : '<span style="color:var(--rouge)">jamais connecté·e</span>'}</span></div>
    ${miniStatuts(e.sections)}
    <div class="niveaux-mini">📓 ${j.nbActivites} activité${j.nbActivites > 1 ? 's' : ''} · ${NIVEAUX.observe.emoji} ${n.observe} · ${NIVEAUX.participe.emoji} ${n.participe} · ${NIVEAUX.realise.emoji} ${n.realise}
      ${j.ecoulees ? ` · ${j.ecoulees - j.manquantes}/${j.ecoulees} demi-journées` : ''}</div>
    ${e.alertes.map((a) => `<p class="alerte-ligne ${a.niveau}">⚠️ ${esc(a.texte)}</p>`).join('')}
  </a>`;
}

// ---------------------------------------------------------------- Fiche élève

const ONGLETS = [['suivi', 'Suivi'], ['journal', 'Journal'], ['identite', 'Fiche'], ['organigramme', 'Orga'], ['introduction', 'Intro'], ['veille', 'Veille'], ['interview', 'Interview'], ['mission_b1', 'Mission B1'], ['mission_b2', 'Mission B2'], ['mission_b3', 'Mission B3'], ['mission_b4', 'Mission B4'], ['checklist', 'Check-list'], ['bilan', 'Bilan'], ['projet', 'Projet'], ['autoeval', 'Auto-éval.'], ['oral', 'Oral'], ['complet', '📄 Dossier complet'], ['compte', 'Compte']];

export async function fiche(vue, id, onglet = 'suivi') {
  if (!ONGLETS.some(([k]) => k === onglet)) onglet = 'suivi';
  let d = await get(`/prof/eleves/${id}`);
  let journalComs = (await get(`/prof/eleves/${id}/commentaires/journal`)).commentaires;
  const e = d.eleve;

  function dessiner() {
    vue.innerHTML = `
      <a class="retour" href="#/">‹ Classe</a>
      <div class="rangee entre"><h1>${esc(e.prenom)} ${esc(e.nom.toUpperCase())}</h1>${e.actif ? '' : '<span class="statut revoir">Compte désactivé</span>'}</div>
      <nav class="onglets">${ONGLETS.map(([k, l]) => {
    const st = d.sections[k];
    const badge = st && st.statut === 'soumis' ? ' <span class="compteur">!</span>' : '';
    return `<a href="#/eleve/${e.id}/${k}" class="${k === onglet ? 'actif' : ''}">${l}${badge}</a>`;
  }).join('')}</nav>
      <div data-contenu></div>`;
    const zone = $('[data-contenu]', vue);
    if (onglet === 'suivi') zone.innerHTML = suiviHtml();
    else if (onglet === 'journal') zone.innerHTML = journalHtml();
    else if (onglet === 'compte') zone.innerHTML = compteHtml();
    else if (onglet === 'complet') afficherDossierComplet(zone, d, { pourProf: true });
    else { zone.innerHTML = rubriqueHtml(onglet); hydraterImages(zone); }
  }

  function suiviHtml() {
    const s = d.journal.stats;
    return `
      ${d.alertes.length ? `<div class="bandeau alerte">${d.alertes.map((a) => `<p>⚠️ ${esc(a.texte)}</p>`).join('')}</div>` : '<div class="bandeau ok"><p>Aucune alerte.</p></div>'}
      <div class="chiffres">
        <div class="chiffre"><b>${s.nbActivites}</b><span>activités notées</span></div>
        <div class="chiffre"><b>${s.ecoulees ? `${s.ecoulees - s.manquantes.length}/${s.ecoulees}` : '—'}</b><span>demi-journées remplies</span></div>
        <div class="chiffre"><b>${NIVEAUX.observe.emoji} ${s.niveaux.observe} · ${NIVEAUX.participe.emoji} ${s.niveaux.participe} · ${NIVEAUX.realise.emoji} ${s.niveaux.realise}</b><span>observé · participé · réalisé</span></div>
        <div class="chiffre"><b>${e.derniere_connexion ? esc(ilYA(e.derniere_connexion)) : 'jamais'}</b><span>dernière connexion</span></div>
      </div>
      <div class="carte"><h2>Rubriques</h2>${RUBRIQUES.map((cle) => `
        <a class="tache" href="#/eleve/${e.id}/${cle}"><span class="tache-txt"><b>${esc(titre(cle))}</b>
          <small>${d.sections[cle].modifie_le ? `modifiée ${esc(ilYA(d.sections[cle].modifie_le))}` : 'pas commencée'}${d.sections[cle].manques.length && d.sections[cle].statut !== 'valide' ? ` · manque : ${esc(d.sections[cle].manques.join(', '))}` : ''}</small></span>
          ${pastilleStatut(d.sections[cle].modifie_le ? d.sections[cle].statut : 'vide')}</a>`).join('')}</div>
      <div class="carte"><h2>Compétences</h2>
        ${etat.config.blocs.map((b) => `<div class="groupe-titre">${esc(b.titre)}</div>${b.competences.map((c) => {
    const x = s.competences[c.code];
    return `<div class="comp-ligne"><span>${esc(c.libelle)}</span><span>${x ? Object.keys(NIVEAUX).filter((k) => x[k]).map((k) => `${NIVEAUX[k].emoji} ${x[k]}`).join(' ') : '<span class="discret">—</span>'}</span></div>`;
  }).join('')}`).join('')}
        ${s.sansCompetence ? `<p class="discret petit" style="margin-top:.5rem">+ ${s.sansCompetence} activité${s.sansCompetence > 1 ? 's' : ''} sans compétence indiquée.</p>` : ''}
      </div>`;
  }

  function journalHtml() {
    const p = etat.config.pfmp;
    const fin = d.journal.stats.dernierJour && d.journal.stats.dernierJour > etat.config.aujourdhui ? d.journal.stats.dernierJour : etat.config.aujourdhui;
    const borne = fin < p.fin ? fin : p.fin;
    const jours = new Set(borne >= p.debut ? joursOuvres(p.debut, borne) : []);
    d.journal.activites.forEach((a) => jours.add(a.jour));
    const liste = [...jours].sort().reverse();
    const parCle = (j, m) => d.journal.activites.filter((a) => a.jour === j && a.moment === m);
    const abs = (j, m) => d.journal.absences.find((a) => a.jour === j && a.moment === m);
    const comp = (code) => { const c = toutesCompetences().find((x) => x.code === code); return c ? c.libelle : 'compétence non indiquée'; };
    return `
      <div class="carte"><h2>💬 Commentaires sur le journal</h2>
        ${journalComs.map(commentaireHtml).join('') || '<p class="discret">Aucun commentaire.</p>'}
        <form data-form-com="journal"><label class="champ"><span class="lib">Écrire à l’élève</span><textarea name="texte" rows="2" maxlength="2000" placeholder="ex. Pense à préciser ce que tu as fait toi-même."></textarea></label>
          <button class="btn petit" type="submit">Envoyer le commentaire</button></form></div>
      <div class="carte">${liste.length ? liste.map((j) => `
        <div class="jour-lecture"><h3>${esc(dateLongue(j))}</h3>
          ${['matin', 'aprem'].map((m) => {
    const a = abs(j, m);
    const l = parCle(j, m);
    const contenu = a ? `<span class="discret">🚫 ${esc(MOTIFS[a.motif])}</span>`
      : l.length ? l.map((x) => `<div>${NIVEAUX[x.niveau].emoji} ${esc(x.texte)} <span class="discret petit">— ${esc(comp(x.competence))}</span></div>`).join('')
        : (j < etat.config.aujourdhui ? '<span class="manque">non rempli</span>' : '<span class="discret">—</span>');
    return `<div class="moment"><b>${MOMENTS[m]}</b><div>${contenu}</div></div>`;
  }).join('')}</div>`).join('') : '<p class="discret">Le journal commence le ' + esc(dateLongue(p.debut)) + '.</p>'}</div>`;
  }

  function rubriqueHtml(cle) {
    const s = d.sections[cle];
    const bloc = cle.startsWith('mission_') ? etat.config.blocs.find((b) => `mission_${b.code.toLowerCase()}` === cle) : null;
    const lecture = cle === 'identite' ? lectureIdentite(s.contenu) : cle === 'organigramme' ? arbreHtml(s.contenu.noeuds || []) : cle === 'veille' ? lectureVeille(s.contenu)
      : cle === 'interview' ? lectureInterview(s.contenu) : cle === 'checklist' ? lectureChecklist(s.contenu) : cle === 'bilan' ? lectureBilan(s.contenu)
      : cle === 'projet' ? lectureProjet(s.contenu) : cle === 'autoeval' ? lectureAutoeval(s.contenu) : cle === 'oral' ? lectureOral(s.contenu) : bloc ? lectureMission(s.contenu, bloc, d.journal.activites) : lectureIntroduction(s.contenu);
    const valide = s.statut === 'valide';
    return `
      <div class="rangee entre" style="margin-bottom:.75rem"><h2 style="margin:0">${esc(titre(cle))}</h2>${pastilleStatut(s.modifie_le ? s.statut : 'vide')}</div>
      ${s.modifie_le ? `<p class="discret petit">Dernière modification : ${esc(ilYA(s.modifie_le))}${s.manques.length ? ` · manque : ${esc(s.manques.join(', '))}` : ''}</p>` : '<div class="bandeau info"><p>L’élève n’a pas encore commencé cette rubrique.</p></div>'}
      <div class="carte">${lecture}${imagesProfHtml(d.images || [], cle)}</div>
      ${relectureHtml(s.relecture, { pourProf: true })}
      <div class="carte"><h2>💬 Commentaires</h2>
        ${s.commentaires.map(commentaireHtml).join('') || '<p class="discret">Aucun commentaire.</p>'}
        <form data-form-com="${cle}">
          <label class="champ"><span class="lib">Commentaire pour l’élève</span><textarea name="texte" rows="3" maxlength="2000" placeholder="Points forts, ce qu’il faut corriger…"></textarea></label>
          <div class="rangee">
            <button class="btn neutre petit" type="submit" data-statut-cible="">Commenter seulement</button>
            ${valide ? '<button class="btn secondaire petit" type="submit" data-statut-cible="brouillon">Rouvrir la rubrique</button>'
    : `<button class="btn danger petit" type="submit" data-statut-cible="a_revoir">À revoir</button>
               <button class="btn petit" type="submit" data-statut-cible="valide">✓ Valider</button>`}
          </div>
          <span class="aide">Tout est facultatif : l’élève avance sans attendre votre validation. « À revoir » demande un commentaire ; « Valider » verrouille la rubrique (vous pouvez la rouvrir).</span>
        </form></div>`;
  }

  function compteHtml() {
    return `<div class="carte">
        <p>Identifiant : <code>${esc(e.identifiant)}</code></p>
        <p class="discret petit">Compte créé le ${esc(dateCourte(e.cree_le.slice(0, 10)))} · dernière connexion : ${esc(ilYA(e.derniere_connexion))}</p>
        <p class="petit">Stage : du <b>${esc(dateCourte(e.stage.debut))}</b> au <b>${esc(dateCourte(e.stage.fin))}</b>${e.stage.personnalisee ? ' (dates propres à cet élève)' : ''}</p>
        <div class="pile">
          <button class="btn secondaire" type="button" data-compte="modifier">✏️ Modifier le prénom, le nom ou les dates de stage</button>
          <button class="btn secondaire" type="button" data-compte="code">🔑 Donner un nouveau code</button>
          <button class="btn neutre" type="button" data-compte="actif">${e.actif ? '⏸ Désactiver le compte' : '▶️ Réactiver le compte'}</button>
          <button class="btn danger" type="button" data-compte="supprimer">🗑 Supprimer l’élève et toutes ses données</button>
        </div></div>`;
  }

  vue.addEventListener('submit', (ev) => {
    const f = ev.target.closest('[data-form-com]');
    if (!f) return;
    ev.preventDefault();
    const cle = f.dataset.formCom;
    const bouton = ev.submitter;
    const cible = bouton ? bouton.dataset.statutCible : '';
    const texte = f.texte.value.trim();
    action(bouton, async () => {
      if (cle === 'journal') {
        if (!texte) throw new Error('Le commentaire est vide.');
        journalComs = (await post(`/prof/eleves/${e.id}/commentaires`, { cle, texte })).commentaires;
      } else if (!cible) {
        if (!texte) throw new Error('Le commentaire est vide.');
        d.sections[cle].commentaires = (await post(`/prof/eleves/${e.id}/commentaires`, { cle, texte })).commentaires;
      } else {
        if (cible === 'brouillon' && !confirm('Rouvrir la rubrique ? L’élève pourra de nouveau la modifier.')) return;
        const r = await post(`/prof/eleves/${e.id}/sections/${cle}/statut`, { statut: cible, commentaire: texte });
        d.sections[cle] = { ...d.sections[cle], ...r };
        toast(cible === 'valide' ? 'Rubrique validée ✓' : cible === 'a_revoir' ? 'Renvoyée à l’élève' : 'Rubrique rouverte', 'ok');
      }
      dessiner();
    });
  });

  vue.addEventListener('click', (ev) => {
    const bi = ev.target.closest('[data-suppr-image]');
    if (!bi || !confirm('Retirer cette image du dossier de l’élève ?')) return;
    action(bi, async () => {
      await del(`/prof/images/${bi.dataset.supprImage}`);
      d.images = d.images.filter((x) => x.id !== Number(bi.dataset.supprImage));
      toast('Image retirée.', 'ok');
      dessiner();
    });
  });

  vue.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-compte]');
    if (!b) return;
    const quoi = b.dataset.compte;
    if (quoi === 'code') nouveauCode(e, b);
    else if (quoi === 'modifier') modifierEleve(e, () => routeurRecharger());
    else if (quoi === 'actif') {
      action(b, async () => {
        const r = await patch(`/prof/eleves/${e.id}`, { actif: !e.actif });
        Object.assign(e, r);
        dessiner();
      });
    } else if (quoi === 'supprimer') supprimerEleve(e, b, () => { location.hash = '#/'; });
  });

  dessiner();
}

// ---------------------------------------------------------------- Carte des compétences

export async function competences(vue) {
  const d = await get('/prof/classe');
  const eleves = d.eleves.filter((e) => e.actif);
  const ligne = (c) => {
    const cellules = eleves.map((e) => {
      const x = e.journal.competences[c.code];
      const n = meilleurNiveau(x);
      return n ? `<td title="${esc(`${e.prenom} ${e.nom} — ${NIVEAUX.observe.lib} ${x.observe}, ${NIVEAUX.participe.lib} ${x.participe}, ${NIVEAUX.realise.lib} ${x.realise}`)}">${NIVEAUX[n].emoji}</td>` : '<td class="vide">·</td>';
    }).join('');
    const compte = { observe: 0, participe: 0, realise: 0 };
    eleves.forEach((e) => { const n = meilleurNiveau(e.journal.competences[c.code]); if (n) compte[n]++; });
    const resume = ['realise', 'participe', 'observe'].filter((k) => compte[k]).map((k) => `${NIVEAUX[k].emoji} ${compte[k]}`).join(' ');
    return `<tr><td class="lib">${esc(c.libelle)}</td>${cellules}<td style="white-space:nowrap">${resume || '<span class="discret">—</span>'}</td></tr>`;
  };
  vue.innerHTML = `
    <h1>Carte des compétences</h1>
    <p class="discret">Niveau le plus élevé atteint par chaque élève (⭐ réalisé, 🤝 participé, 👀 observé), d’après son journal. La dernière colonne indique combien d’élèves ont atteint chaque niveau.</p>
    ${eleves.length ? `<div class="table-zone"><table class="matrice">
      <thead><tr><th class="lib">Compétence</th>${eleves.map((e) => `<th class="vert"><a href="#/eleve/${e.id}/suivi">${esc(e.prenom)} ${esc(e.nom.charAt(0))}.</a></th>`).join('')}<th>Classe</th></tr></thead>
      <tbody>${etat.config.blocs.map((b) => `<tr class="bloc"><td colspan="${eleves.length + 2}">${esc(b.titre)}</td></tr>${b.competences.map(ligne).join('')}`).join('')}</tbody>
    </table></div>` : '<div class="carte"><p>Aucun élève.</p></div>'}`;
}

// ---------------------------------------------------------------- Comptes

function fichesCodes(liste) {
  return liste.map((r) => `<div class="fiche-code"><b>${esc(r.prenom)} ${esc(r.nom)}</b><br>
    Site : <b>ma-pfmp.fr</b><br>Identifiant : <b>${esc(r.identifiant)}</b><br>Code : <span class="c">${esc(r.code)}</span></div>`).join('');
}

export async function comptes(vue) {
  const d = await get('/prof/classe');
  const optionsRef = (choisi) => `<option value="">— Aucun —</option>${d.profs.map((p) => `<option value="${p.id}"${p.id === choisi ? ' selected' : ''}>${esc(p.prenom)} ${esc(p.nom)}</option>`).join('')}`;
  vue.innerHTML = `
    <h1>Comptes élèves</h1>
    <div class="carte">
      <h2>Ajouter des élèves</h2>
      <p class="discret">Une ligne par élève : <b>Prénom;Nom</b> (ou deux colonnes copiées d’un tableur). Les comptes déjà existants sont ignorés.</p>
      <form data-import>
        <label class="champ"><span class="lib">Liste</span><textarea name="texte" rows="8" placeholder="Léa;Martin&#10;Yanis;Ben Ali"></textarea></label>
        <label class="champ"><span class="lib">Référent de ces élèves (facultatif)</span><select name="referent">${optionsRef(null)}</select>
          <span class="aide">Seulement si vous vous répartissez le suivi : le tableau de bord proposera alors le filtre « Mes élèves ». Modifiable ensuite, ligne par ligne.</span></label>
        <button class="btn" type="submit">Créer les comptes</button>
      </form>
      <div data-resultat></div>
    </div>
    <div class="carte"><div class="rangee entre"><h2 style="margin:0">Comptes existants (${d.eleves.length})</h2>
      ${d.eleves.length ? '<button class="btn secondaire petit" type="button" data-tous-pdf>📥 Télécharger tous les dossiers en PDF</button>' : ''}</div>
      <div data-progression-pdf></div>
      ${d.eleves.length ? `<div style="overflow-x:auto;margin-top:.75rem"><table class="liste"><thead><tr><th>Élève</th><th>Identifiant</th><th>Référent</th><th>Dernière connexion</th><th>Actions</th></tr></thead>
      <tbody>${d.eleves.map((e) => `<tr><td><a href="#/eleve/${e.id}/compte">${esc(e.nom.toUpperCase())} ${esc(e.prenom)}</a>${e.actif ? '' : ' <span class="statut revoir">désactivé</span>'}</td>
        <td><code>${esc(e.identifiant)}</code></td><td><select data-referent="${e.id}" aria-label="Référent de ${esc(e.prenom)}" style="min-height:36px;padding:.3rem .5rem">${optionsRef(e.referent_id)}</select></td><td>${esc(ilYA(e.derniere_connexion))}</td>
        <td class="actions-compte"><button class="btn-icone" type="button" data-ligne="modifier" data-id="${e.id}" title="Modifier le prénom, le nom ou les dates de stage" aria-label="Modifier ${esc(e.prenom)}">✏️</button><button class="btn-icone" type="button" data-ligne="code" data-id="${e.id}" title="Donner un nouveau code" aria-label="Nouveau code pour ${esc(e.prenom)}">🔑</button><button class="btn-icone" type="button" data-ligne="supprimer" data-id="${e.id}" title="Supprimer l’élève et toutes ses données" aria-label="Supprimer ${esc(e.prenom)}">🗑</button></td></tr>`).join('')}</tbody></table></div>
        <p class="discret petit">✏️ Modifier (prénom, nom, dates de stage) · 🔑 Nouveau code (code perdu) · 🗑 Supprimer</p>` : '<p class="discret">Aucun compte.</p>'}
    </div>
    <p class="petit" style="margin-top:1.5rem"><button class="btn-lien petit" type="button" data-donnees>🔒 Données personnelles (texte affiché aux élèves)</button></p>`;

  vue.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-ligne]');
    if (!b) return;
    const e = d.eleves.find((x) => x.id === Number(b.dataset.id));
    if (!e) return;
    if (b.dataset.ligne === 'code') nouveauCode(e, b);
    else if (b.dataset.ligne === 'modifier') modifierEleve(e, routeurRecharger);
    else if (b.dataset.ligne === 'supprimer') supprimerEleve(e, b, routeurRecharger);
  });

  const bTous = $('[data-tous-pdf]', vue);
  if (bTous) bTous.addEventListener('click', () => toutTelecharger(d.eleves, bTous, $('[data-progression-pdf]', vue)));

  vue.addEventListener('change', (ev) => {
    const sel = ev.target.closest('[data-referent]');
    if (!sel) return;
    action(sel, async () => {
      await patch(`/prof/eleves/${sel.dataset.referent}`, { referent_id: sel.value ? Number(sel.value) : null });
      toast('Référent enregistré ✓', 'ok', 1500);
    });
  });

  $('[data-import]', vue).addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = ev.target;
    action(f.querySelector('button'), async () => {
      const r = await post('/prof/eleves/import', { texte: f.texte.value, referent_id: f.referent.value || null });
      f.texte.value = '';
      $('[data-resultat]', vue).innerHTML = `
        ${r.erreurs.length ? `<div class="bandeau chaud" style="margin-top:1rem">${r.erreurs.map((x) => `<p>${esc(x)}</p>`).join('')}</div>` : ''}
        ${r.crees.length ? `<div class="bandeau ok" style="margin-top:1rem"><p><b>${r.crees.length} compte${r.crees.length > 1 ? 's' : ''} créé${r.crees.length > 1 ? 's' : ''}.</b>
          Imprime les codes maintenant : ils ne seront plus affichés ensuite.</p></div>
          <div style="overflow-x:auto"><table class="liste"><thead><tr><th>Élève</th><th>Identifiant</th><th>Code</th></tr></thead>
          <tbody>${r.crees.map((c) => `<tr><td>${esc(c.prenom)} ${esc(c.nom)}</td><td><code>${esc(c.identifiant)}</code></td><td><code>${esc(c.code)}</code></td></tr>`).join('')}</tbody></table></div>
          <button class="btn secondaire" type="button" data-imprimer style="margin-top:.75rem">🖨 Imprimer les fiches à découper</button>` : ''}`;
      const bi = $('[data-imprimer]', vue);
      if (bi) bi.addEventListener('click', () => imprimer(fichesCodes(r.crees)));
      if (r.crees.length) toast('Comptes créés ✓', 'ok');
    });
  });
}

// Tous les dossiers de la classe en PDF, réunis dans un fichier .zip.
let jszip = null;
const chargerZip = () => {
  if (!jszip) {
    jszip = new Promise((ok, ko) => {
      const sc = document.createElement('script'); sc.src = 'lib/jszip.min.js';
      sc.onload = () => ok(window.JSZip); sc.onerror = () => { jszip = null; ko(new Error('Impossible de charger l’outil de compression.')); };
      document.head.appendChild(sc);
    });
  }
  return jszip;
};

async function toutTelecharger(eleves, bouton, zoneProgression) {
  if (!confirm(`Fabriquer les ${eleves.length} dossiers PDF ? Comptez quelques secondes par élève : gardez la page ouverte.`)) return;
  bouton.disabled = true;
  const JSZip = await chargerZip().catch((e) => { toast(e.message, 'erreur'); return null; });
  if (!JSZip) { bouton.disabled = false; return; }
  const zip = new JSZip();
  const ratees = [];
  try {
    for (let i = 0; i < eleves.length; i += 1) {
      const e = eleves[i];
      zoneProgression.innerHTML = `<p class="petit">Dossier ${i + 1} sur ${eleves.length} : ${esc(e.prenom)} ${esc(e.nom)}…</p><progress max="${eleves.length}" value="${i}" style="width:100%"></progress>`;
      try {
        // eslint-disable-next-line no-await-in-loop
        const d = await get(`/prof/eleves/${e.id}`);
        // eslint-disable-next-line no-await-in-loop
        const blob = await fabriquerPdf(d, { prefixe: '/prof' });
        zip.file(nomFichier(d.eleve), blob);
      } catch { ratees.push(`${e.prenom} ${e.nom}`); }
    }
    zoneProgression.innerHTML = '<p class="petit">Création du fichier .zip…</p>';
    const fichier = await zip.generateAsync({ type: 'blob' });
    telecharger(fichier, `PFMP_${etat.config.pfmp.classe}_dossiers_${new Date().toISOString().slice(0, 10)}.zip`);
    zoneProgression.innerHTML = ratees.length ? `<p class="petit" style="color:var(--rouge)">Dossiers non créés : ${ratees.map(esc).join(', ')}.</p>` : '';
    toast(`${eleves.length - ratees.length} dossiers téléchargés ✓`, 'ok', 5000);
  } finally { bouton.disabled = false; }
}
