// Écrans élève : accueil, journal quotidien, dossier et rubriques.
import { get, post, put, del } from './api.js';
import { etat } from './app.js';
import {
  $, esc, toast, action, modale, debounce, dateLongue, jourSemaine, ajouterJours, lundiDe, jourSem, dateHeure,
  NIVEAUX, MOMENTS, MOTIFS, pastilleStatut,
} from './ui.js';
import { afficherDossierComplet } from './complet.js';
import { enAttente, mettreEnAttente } from './attente.js';
import { zoneImages } from './images.js';
import { editeurIdentite, editeurIntroduction, editeurVeille, editeurMission, editeurInterview, editeurChecklist, editeurBilan, editeurProjet, editeurAutoeval, editeurOral, relectureHtml } from './rubriques.js';
import { editeurOrganigramme } from './orga.js';

const ICONES = { identite: '🏢', organigramme: '🧩', introduction: '✍️', veille: '🔍', interview: '🗣️', mission_b1: '📝', mission_b2: '📝', mission_b3: '📝', mission_b4: '📝', checklist: '✅', bilan: '🏁', projet: '🧭', autoeval: '🪞', oral: '🎤' };
const DESCRIPTIONS = {
  identite: 'Les informations clés de ton entreprise',
  organigramme: 'Qui fait quoi, et où tu te situes',
  introduction: 'Comment ton stage a commencé (5 à 10 lignes)',
  veille: 'Concurrents et veille de l’entreprise : à commencer en semaine 1, à finir en semaine 2',
  interview: '10 questions à un professionnel de l’entreprise',
  mission_b1: 'Une mission pour « Conseiller et vendre »',
  mission_b2: 'Une mission pour « Suivre les ventes »',
  mission_b3: 'Une mission pour « Fidéliser » (l’observation compte)',
  mission_b4: 'Une mission pour « Prospecter et valoriser l’offre »',
  checklist: 'Ce que tu dois rapporter avant de quitter l’entreprise',
  bilan: 'Ce que tu retiens de tes quatre semaines',
  projet: 'La suite : ton métier, ta formation, ta prochaine PFMP',
  autoeval: 'Tes 10 attitudes professionnelles, en toute honnêteté',
  oral: 'Tes 4 diapos pour l’oral de janvier (5 + 5 minutes)',
};

function phase(jour) {
  const p = etat.config.pfmp;
  if (jour < p.debut) return 'avant';
  if (jour > p.fin) return 'apres';
  return 'pendant';
}

function competenceLib(code) {
  for (const b of etat.config.blocs) for (const c of b.competences) if (c.code === code) return c.libelle;
  return null;
}

function optionsCompetences(choisie) {
  return `<option value="">Je ne sais pas encore</option>${etat.config.blocs.map((b) => `
    <optgroup label="${esc(b.titre)}">${b.competences.map((c) => `<option value="${c.code}"${c.code === choisie ? ' selected' : ''}>${esc(c.libelle)}</option>`).join('')}</optgroup>`).join('')}`;
}

// ---------------------------------------------------------------- Accueil

function bandeauInstallation() {
  const autonome = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  let masque = false;
  try { masque = localStorage.getItem('immersio.install.masque') === '1'; } catch { /* rien */ }
  if (autonome || masque) return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (etat.invitationInstall) {
    return `<div class="carte installer"><p>📲 Installe Ma PFMP sur ton téléphone pour l’ouvrir en un geste.</p>
      <button class="btn petit" type="button" data-installer>Installer</button><button class="btn-icone" type="button" data-masquer-install aria-label="Masquer">✕</button></div>`;
  }
  if (ios) {
    return `<div class="carte installer"><p>📲 Sur iPhone : touche <b>Partager</b> puis <b>Sur l’écran d’accueil</b> pour installer Ma PFMP.</p>
      <button class="btn-icone" type="button" data-masquer-install aria-label="Masquer">✕</button></div>`;
  }
  return '';
}

export async function accueil(vue) {
  const d = await get('/eleve/accueil');
  const u = etat.utilisateur;
  const p = etat.config.pfmp;
  const ph = phase(d.jour);
  const nbJours = Math.round((new Date(p.debut) - new Date(d.jour)) / 86400000);
  const numSemaine = Math.floor((new Date(lundiDe(d.jour)) - new Date(p.debut)) / (7 * 86400000)) + 1;
  const sousTitre = ph === 'avant'
    ? `Ta PFMP commence le ${dateLongue(p.debut)}${nbJours > 0 ? ` (dans ${nbJours} jour${nbJours > 1 ? 's' : ''})` : ''}.`
    : ph === 'pendant' ? `Semaine ${numSemaine} de ta PFMP · ${dateLongue(d.jour)}`
      : `Ta PFMP est terminée. Rendu final le ${dateLongue(p.rendu)}.`;

  const ouvre = jourSem(d.jour) >= 1 && jourSem(d.jour) <= 5;
  const etatMoment = (m) => {
    const x = d.aujourdhui[m];
    if (x.absence) return `<div class="ok"><b>${MOMENTS[m]}</b>${esc(MOTIFS[x.absence])}</div>`;
    return x.n ? `<div class="ok"><b>${MOMENTS[m]}</b>${x.n} activité${x.n > 1 ? 's' : ''} ✓</div>` : `<div><b>${MOMENTS[m]}</b>à remplir</div>`;
  };
  const manquantes = d.journal.manquantes.length;
  const carteJournal = ph === 'pendant' ? `
    <div class="carte"><div class="rangee entre"><h2 style="margin:0">📓 Mon journal du jour</h2></div>
      ${ouvre ? `<div class="jour-etat">${etatMoment('matin')}${etatMoment('aprem')}</div>` : '<p class="discret" style="margin-top:.5rem">Pas de journal à remplir aujourd’hui, sauf si tu es en entreprise.</p>'}
      ${manquantes ? `<p class="petit" style="color:var(--rouge);margin:.75rem 0 0">⚠️ Il te manque ${manquantes} demi-journée${manquantes > 1 ? 's' : ''} les jours précédents.</p>` : ''}
      <a class="btn plein" style="margin-top:.75rem" href="#/journal">Remplir mon journal</a></div>` : '';

  // Commentaires non lus des professeurs
  const nonLus = Object.entries(d.sections).filter(([, s]) => s.commentairesNonLus);
  const blocCommentaires = (nonLus.length || d.journalNonLus) ? `
    <div class="bandeau chaud"><p><b>💬 Ton professeur t’a laissé un message</b></p>
      ${d.journalNonLus ? '<p><a href="#/journal">Voir le message sur ton journal</a></p>' : ''}
      ${nonLus.map(([cle]) => `<p><a href="#/dossier/${cle}">${esc(etat.config.sections[cle].titre)}</a></p>`).join('')}</div>` : '';

  // Étape du calendrier en cours (avant la PFMP : la semaine 1)
  const etape = d.etape || (ph === 'avant' ? etat.config.calendrier[0] : null);
  const blocEtape = etape ? `
    <div class="carte"><h2>🗓 À faire : ${esc(etape.titre.toLowerCase())}</h2>
      ${etape.sections.map((cle) => tacheHtml(cle, d.sections[cle])).join('')}
      ${etape.bientot.map((t) => `<div class="tache bientot"><span class="tache-ico">⏳</span><span class="tache-txt">${esc(t)}<small>Bientôt dans Ma PFMP</small></span></div>`).join('')}
      ${ph === 'pendant' ? '<div class="tache"><span class="tache-ico">📓</span><span class="tache-txt">Journal quotidien<small>Matin et après-midi, quelques minutes</small></span></div>' : ''}
    </div>` : '';

  const n = d.journal.niveaux;
  vue.innerHTML = `
    <div class="salut"><h1>Bonjour ${esc(u.prenom)} 👋</h1><p>${esc(sousTitre)}</p></div>
    ${bandeauInstallation()}
    ${blocCommentaires}
    ${carteJournal}
    ${blocEtape}
    ${ph !== 'avant' ? `<a class="carte lien" href="#/blocs"><h2 style="margin:0">🎯 Mes blocs</h2>
      <p class="discret petit" style="margin:.25rem 0 0">${NIVEAUX.observe.emoji} ${n.observe} · ${NIVEAUX.participe.emoji} ${n.participe} · ${NIVEAUX.realise.emoji} ${n.realise} — objectif : au moins une activité par bloc</p>
      ${blocsMiniHtml(d.journal.competences)}</a>` : ''}
    ${ph === 'avant' ? '<div class="bandeau info"><p>Tu peux déjà commencer ta fiche d’identité si tu connais ton entreprise. Le journal s’ouvrira le premier jour de ta PFMP.</p></div>' : ''}
    <p class="petit" style="text-align:center;margin-top:1.5rem"><button class="btn-lien petit" type="button" data-donnees>🔒 Données personnelles</button></p>`;

  vue.addEventListener('click', async (e) => {
    if (e.target.closest('[data-installer]') && etat.invitationInstall) {
      etat.invitationInstall.prompt();
      await etat.invitationInstall.userChoice.catch(() => {});
      etat.invitationInstall = null;
      e.target.closest('.installer').remove();
    }
    if (e.target.closest('[data-masquer-install]')) {
      try { localStorage.setItem('immersio.install.masque', '1'); } catch { /* rien */ }
      e.target.closest('.installer').remove();
    }
  });
}

function tacheHtml(cle, s) {
  return `<a class="tache" href="#/dossier/${cle}"><span class="tache-ico">${ICONES[cle]}</span>
    <span class="tache-txt"><b>${esc(etat.config.sections[cle].titre)}</b><small>${esc(DESCRIPTIONS[cle])}</small></span>
    ${s.commentairesNonLus ? '<span class="compteur">💬</span>' : ''}${pastilleStatut(s.statut)}</a>`;
}

// ---------------------------------------------------------------- Journal

export async function journal(vue, jourDemande) {
  const p = etat.config.pfmp;
  const [d, com] = await Promise.all([get('/eleve/journal'), get('/eleve/journal/commentaires').catch(() => ({ commentaires: [] }))]);
  let activites = d.activites;
  let horsLigne = !!d.horsLigne;
  const toutes = () => activites.concat(enAttente());
  let absences = d.absences;
  const auj = d.jour;

  if (auj < p.debut) {
    vue.innerHTML = `<h1>📓 Mon journal</h1><div class="carte"><p>Ton journal s’ouvrira le <b>${dateLongue(p.debut)}</b>, premier jour de ta PFMP.</p>
      <p>Chaque jour, matin et après-midi, tu noteras en quelques minutes ce que tu as fait ou observé.</p></div>${legendeNiveaux()}`;
    return;
  }
  const max = auj < p.fin ? auj : p.fin;
  let jour = jourDemande && jourDemande >= p.debut && jourDemande <= max ? jourDemande : max;

  const couverture = (j, m) => {
    if (absences.some((a) => a.jour === j && a.moment === m)) return 'abs';
    if (toutes().some((a) => a.jour === j && a.moment === m)) return 'ok';
    return (j < auj && jourSem(j) >= 1 && jourSem(j) <= 5) ? 'manque' : '';
  };

  function dessiner() {
    history.replaceState(null, '', `#/journal/${jour}`);
    const lundi = lundiDe(jour);
    const semaine = [0, 1, 2, 3, 4].map((i) => ajouterJours(lundi, i));
    const nbAttente = enAttente().length;
    vue.innerHTML = `
      ${horsLigne || nbAttente ? `<div class="bandeau info"><p>📶 ${horsLigne ? 'Pas de réseau pour l’instant : tu vois la dernière version de ton journal. ' : ''}${nbAttente ? `${nbAttente} activité${nbAttente > 1 ? 's' : ''} gardée${nbAttente > 1 ? 's' : ''} sur ton téléphone ⏳ : ${nbAttente > 1 ? 'elles seront envoyées' : 'elle sera envoyée'} automatiquement dès que le réseau reviendra.` : 'Tu peux quand même noter tes activités : elles seront envoyées automatiquement.'}</p></div>` : ''}
      ${com.commentaires.length ? `<details class="carte" open><summary><b>💬 Messages de tes professeurs sur ton journal (${com.commentaires.length})</b></summary>
        <div style="margin-top:.75rem">${com.commentaires.map(commentaireHtml).join('')}</div></details>` : ''}
      <div class="jour-nav">
        <button class="btn-icone" type="button" data-aller="-1" aria-label="Jour précédent"${jour <= p.debut ? ' disabled' : ''}>‹</button>
        <h1>${esc(dateLongue(jour))}</h1>
        <button class="btn-icone" type="button" data-aller="1" aria-label="Jour suivant"${jour >= max ? ' disabled' : ''}>›</button>
      </div>
      <div class="semaine">${semaine.map((j) => `<button type="button" data-jour="${j}" class="${j === jour ? 'choisi' : ''}"${j < p.debut || j > max ? ' disabled' : ''}>
        ${esc(jourSemaine(j))}<b>${Number(j.slice(8))}</b><i class="${couverture(j, 'matin')}"></i><i class="${couverture(j, 'aprem')}"></i></button>`).join('')}</div>
      ${demiJourneeHtml('matin')}
      ${demiJourneeHtml('aprem')}
      ${legendeNiveaux()}
      <p class="discret petit">🔒 Pas de noms de clients, de prix ni d’informations confidentielles : décris ce que tu fais, pas les secrets de l’entreprise.</p>`;
  }

  function demiJourneeHtml(m) {
    const liste = toutes().filter((a) => a.jour === jour && a.moment === m);
    const abs = absences.find((a) => a.jour === jour && a.moment === m);
    let corps;
    if (abs) {
      corps = `<p>🚫 ${esc(MOTIFS[abs.motif])}</p><button class="btn-lien" type="button" data-annuler-absence="${m}">Annuler</button>`;
    } else {
      corps = `${liste.map((a) => `
        <div class="activite"><span class="niv" title="${NIVEAUX[a.niveau].lib}">${NIVEAUX[a.niveau].emoji}</span>
          <div class="act-txt">${esc(a.texte)}
            <span class="act-comp${a.competence ? '' : ' manque'}">${a.competence ? esc(competenceLib(a.competence) || a.competence) : 'Compétence à préciser'}</span></div>
          ${a.attente ? '<span class="btn-icone" title="En attente de réseau">⏳</span>' : `<button class="btn-icone" type="button" data-modifier="${a.id}" aria-label="Modifier">✏️</button>`}</div>`).join('')}
        <button class="btn ${liste.length ? 'secondaire' : ''} plein" type="button" data-ajouter="${m}" style="margin-top:.5rem">➕ Ajouter une activité</button>
        ${liste.length ? '' : `<button class="btn-lien petit" type="button" data-absence="${m}" style="margin-top:.4rem">Je n’étais pas en entreprise</button>`}`;
    }
    const st = abs ? '<span class="statut brouillon">Noté</span>' : liste.length ? '<span class="statut valide">Rempli ✓</span>' : '<span class="statut vide">À remplir</span>';
    return `<section class="carte demi-journee"><h2>${m === 'matin' ? '☀️' : '🌤'} ${MOMENTS[m]} ${st}</h2>${corps}</section>`;
  }

  function formulaireActivite(m, a) {
    const modif = !!a;
    const fen = modale(modif ? 'Modifier l’activité' : `${MOMENTS[m]} — nouvelle activité`, `
      <form>
        <label class="champ"><span class="lib">Qu’as-tu fait ou observé ?</span>
          <textarea name="texte" rows="3" maxlength="600" required placeholder="ex. J’ai accompagné ma tutrice à un rendez-vous avec un client pour une estimation.">${esc(a ? a.texte : '')}</textarea></label>
        <fieldset><legend>Ton rôle</legend>
          <div class="choix niveaux">${Object.entries(NIVEAUX).map(([k, n]) => `
            <label><input type="radio" name="niveau" value="${k}"${a && a.niveau === k ? ' checked' : ''} required><b>${n.emoji}</b>${n.lib}</label>`).join('')}</div>
          <span class="aide">👀 j’ai regardé faire · 🤝 j’ai aidé · ⭐ je l’ai fait moi-même</span></fieldset>
        <label class="champ"><span class="lib">Compétence travaillée</span>
          <select name="competence">${optionsCompetences(a ? a.competence : '')}</select>
          <span class="aide">Si tu hésites, choisis « Je ne sais pas encore » : tu pourras compléter plus tard.</span></label>
        <div class="rangee">
          <button class="btn" type="submit" style="flex:1">Enregistrer</button>
          ${modif ? '<button class="btn neutre" type="button" data-supprimer>🗑 Supprimer</button>' : ''}
        </div>
      </form>`);
    const f = fen.el.querySelector('form');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!f.niveau.value) { toast('Choisis ton rôle : observé, participé ou réalisé.', 'erreur'); return; }
      const corps = { jour, moment: m, texte: f.texte.value, niveau: f.niveau.value, competence: f.competence.value || null };
      action(f.querySelector('[type=submit]'), async () => {
        if (modif) {
          const r = await put(`/eleve/journal/${a.id}`, corps);
          activites = activites.map((x) => (x.id === a.id ? r : x));
        } else {
          try {
            activites.push(await post('/eleve/journal', corps));
          } catch (e) {
            if (!e.horsLigne) throw e;
            mettreEnAttente(corps);
            fen.fermer();
            toast('Pas de réseau : ton activité est gardée sur ton téléphone. Elle sera envoyée automatiquement ⏳', 'ok', 6000);
            dessiner();
            return;
          }
        }
        fen.fermer();
        toast('Activité enregistrée ✓', 'ok');
        dessiner();
      });
    });
    const sup = fen.el.querySelector('[data-supprimer]');
    if (sup) sup.addEventListener('click', () => {
      if (!confirm('Supprimer cette activité ?')) return;
      action(sup, async () => {
        await del(`/eleve/journal/${a.id}`);
        activites = activites.filter((x) => x.id !== a.id);
        fen.fermer();
        dessiner();
      });
    });
  }

  function formulaireAbsence(m) {
    const fen = modale(`${MOMENTS[m]} — pas en entreprise`, `
      <div class="pile">${Object.entries(MOTIFS).map(([k, lib]) => `<button class="btn secondaire plein" type="button" data-motif="${k}">${esc(lib)}</button>`).join('')}</div>
      <p class="discret petit" style="margin-top:.75rem">Si tu es absent·e, préviens aussi ton tuteur et le lycée.</p>`);
    fen.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-motif]');
      if (!b) return;
      action(b, async () => {
        await put('/eleve/absence', { jour, moment: m, motif: b.dataset.motif });
        absences = absences.filter((x) => !(x.jour === jour && x.moment === m)).concat({ jour, moment: m, motif: b.dataset.motif });
        fen.fermer();
        dessiner();
      });
    });
  }

  vue.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t || t.disabled) return;
    if (t.dataset.aller) {
      let j = ajouterJours(jour, Number(t.dataset.aller));
      if (j >= p.debut && j <= max) { jour = j; dessiner(); }
    } else if (t.dataset.jour) { jour = t.dataset.jour; dessiner(); }
    else if (t.dataset.ajouter) formulaireActivite(t.dataset.ajouter);
    else if (t.dataset.modifier) formulaireActivite(null, activites.find((a) => a.id === Number(t.dataset.modifier)));
    else if (t.dataset.absence) formulaireAbsence(t.dataset.absence);
    else if (t.dataset.annulerAbsence) {
      const m = t.dataset.annulerAbsence;
      action(t, async () => {
        await put('/eleve/absence', { jour, moment: m, motif: null });
        absences = absences.filter((x) => !(x.jour === jour && x.moment === m));
        dessiner();
      });
    }
  });

  // Quand les activités gardées sur le téléphone sont parties, on recharge le journal.
  const recharger = async () => {
    try { const n = await get('/eleve/journal'); activites = n.activites; absences = n.absences; horsLigne = !!n.horsLigne; dessiner(); } catch { /* plus tard */ }
  };
  window.addEventListener('attente-envoyee', recharger);
  dessiner();
  return () => window.removeEventListener('attente-envoyee', recharger);
}

function legendeNiveaux() {
  return `<div class="legende-niveaux">${Object.values(NIVEAUX).map((n) => `<span>${n.emoji} <b>${n.lib}</b> : ${n.aide}</span>`).join('')}</div>`;
}

export function commentaireHtml(c) {
  return `<div class="commentaire"><div class="texte-lecture">${esc(c.texte)}</div>
    <small>${esc(c.auteur_prenom ? `${c.auteur_prenom} ${c.auteur_nom}` : 'Professeur')} · ${esc(dateHeure(c.cree_le))}</small></div>`;
}


// ---------------------------------------------------------------- Mes blocs

const COURTS = { B1: 'Vendre', B2: 'Suivre', B3: 'Fidéliser', B4: 'Prospecter' };
const ASTUCES = {
  B1: 'Demande à ton tuteur d’assister à un rendez-vous client, puis de mener toi-même la découverte des besoins.',
  B2: 'Demande à suivre un dossier après la vente : commande, livraison, règlement ou réclamation.',
  B3: 'Observe comment l’entreprise garde le contact avec ses clients : relances, fichier clients, avis en ligne.',
  B4: 'Propose de participer à une action de prospection : phoning, boîtage, préparation d’une tournée.',
};
const ORDRE = ['realise', 'participe', 'observe'];
const meilleur = (x) => (x ? ORDRE.find((k) => x[k]) : null);

function resumeBloc(b, competences) {
  let activites = 0;
  let touchees = 0;
  for (const c of b.competences) {
    const x = competences[c.code];
    if (x) { touchees++; activites += x.observe + x.participe + x.realise; }
  }
  return { activites, touchees, total: b.competences.length };
}

export function blocsMiniHtml(competences) {
  return `<div class="blocs-mini">${etat.config.blocs.map((b) => {
    const r = resumeBloc(b, competences);
    return `<div class="${r.activites ? 'ok' : ''}"><b>${r.activites}</b>${esc(COURTS[b.code] || b.code)}</div>`;
  }).join('')}</div>`;
}

export async function blocs(vue) {
  const d = await get('/eleve/accueil');
  const comp = d.journal.competences;
  const vides = etat.config.blocs.filter((b) => !resumeBloc(b, comp).activites);
  vue.innerHTML = `
    <h1>🎯 Mes blocs</h1>
    <p class="discret">Ce que ton journal montre de ta PFMP, bloc par bloc. Objectif : au moins une activité dans chaque bloc, pour écrire une fiche mission par bloc.</p>
    ${vides.length ? `<div class="bandeau chaud"><p>Il te manque encore : <b>${vides.map((b) => esc(COURTS[b.code])).join(', ')}</b>. Regarde les idées ci-dessous et parles-en à ton tuteur.</p></div>`
    : (d.journal.nbActivites ? '<div class="bandeau ok"><p>Bravo : tes quatre blocs ont au moins une activité ✓</p></div>' : '')}
    ${d.journal.sansCompetence ? `<p class="petit" style="color:#a4520f">${d.journal.sansCompetence} activité${d.journal.sansCompetence > 1 ? 's' : ''} sans compétence : complète-les dans ton <a href="#/journal">journal</a> pour qu’elles comptent ici.</p>` : ''}
    ${etat.config.blocs.map((b) => {
    const r = resumeBloc(b, comp);
    return `<section class="carte bloc-carte"><h2>${esc(b.titre)}<span class="discret">${r.touchees}/${r.total}</span></h2>
      ${b.note ? `<p class="discret petit">${esc(b.note.charAt(0).toUpperCase() + b.note.slice(1))} : l’observation compte.</p>` : ''}
      <div class="jauge"><span style="width:${Math.round((r.touchees / r.total) * 100)}%"></span></div>
      ${r.activites ? '' : `<p class="astuce">💡 ${esc(ASTUCES[b.code] || '')}</p>`}
      <a class="btn ${r.activites ? '' : 'secondaire '}petit" href="#/dossier/mission_${b.code.toLowerCase()}" style="margin-bottom:.5rem">📝 Ma fiche mission pour ce bloc</a>
      ${b.competences.map((c) => {
    const x = comp[c.code];
    const n = meilleur(x);
    return `<div class="comp-eleve${n ? '' : ' vide'}"><span class="niv">${n ? NIVEAUX[n].emoji : '·'}</span><span>${esc(c.libelle)}${x ? ` <span class="discret">(${x.observe + x.participe + x.realise})</span>` : ''}</span></div>`;
  }).join('')}
    </section>`;
  }).join('')}
    ${legendeNiveaux()}`;
}

// ---------------------------------------------------------------- Dossier

export async function dossier(vue) {
  const d = await get('/eleve/accueil');
  const cal = etat.config.calendrier;
  vue.innerHTML = `<h1>📁 Mon dossier</h1>
    <p class="discret">Tout ce que tu prépares pendant ta PFMP, étape par étape.</p>
    <a class="btn secondaire plein" href="#/dossier/complet" style="margin-bottom:1rem">📄 Voir tout mon dossier (et l’enregistrer en PDF)</a>
    ${cal.map((e) => `<div class="carte"><h2>${esc(e.titre)}</h2>
      ${e.sections.map((cle) => tacheHtml(cle, d.sections[cle])).join('')}
      ${e.bientot.filter((t) => !/Pearltrees/.test(t)).map((t) => `<div class="tache bientot"><span class="tache-ico">⏳</span><span class="tache-txt">${esc(t)}<small>Bientôt dans Ma PFMP</small></span></div>`).join('')}
    </div>`).join('')}`;
}

// ---------------------------------------------------------------- Rubrique (fiche, organigramme, introduction)

const EDITEURS = { identite: editeurIdentite, organigramme: editeurOrganigramme, introduction: editeurIntroduction, veille: editeurVeille, interview: editeurInterview, checklist: editeurChecklist, bilan: editeurBilan, projet: editeurProjet, autoeval: editeurAutoeval, oral: editeurOral };
function editeurPour(cle) {
  if (EDITEURS[cle]) return EDITEURS[cle];
  const bloc = etat.config.blocs.find((b) => `mission_${b.code.toLowerCase()}` === cle);
  return editeurMission(bloc);
}

export async function rubrique(vue, cle) {
  const s = await get(`/eleve/sections/${cle}`);
  let contenu = s.contenu;
  let statut = s.statut;
  let manques = s.manques;
  let enAttente = false;
  let enCours = null;

  vue.innerHTML = `
    <a class="retour" href="#/dossier">‹ Mon dossier</a>
    <div class="entete-rubrique"><h1>${ICONES[cle]} ${esc(s.titre)}</h1><span data-statut></span></div>
    <div data-messages></div>
    <div data-relecture></div>
    <div data-editeur></div>
    <div data-images></div>
    <div class="barre-envoi">
      <ul class="manques" data-manques></ul>
      ${etat.config.iaActive && s.relisible !== false && etat.config.sections[cle].relisible !== false ? '<button class="btn secondaire plein btn-relire" type="button" data-relire></button>' : ''}
      <button class="btn plein" type="button" data-envoyer>J’ai terminé cette partie</button>
      <p class="etat-sauvegarde" data-sauvegarde>&nbsp;</p>
    </div>`;

  const elStatut = $('[data-statut]', vue);
  const elSauv = $('[data-sauvegarde]', vue);
  const elManques = $('[data-manques]', vue);
  const btnEnvoyer = $('[data-envoyer]', vue);

  $('[data-messages]', vue).innerHTML = s.commentaires.length ? `
    <div class="carte"><h2>💬 Messages de tes professeurs</h2>${s.commentaires.map(commentaireHtml).join('')}</div>` : '';

  function majEtat() {
    elStatut.innerHTML = pastilleStatut(statut);
    const valide = statut === 'valide';
    elManques.innerHTML = !valide && manques.length ? `<li>Pour terminer, il manque : ${manques.map(esc).join(', ')}.</li>` : '';
    btnEnvoyer.hidden = valide;
    btnEnvoyer.textContent = statut === 'soumis' ? 'Terminée ✓' : statut === 'a_revoir' ? 'J’ai corrigé : c’est terminé' : 'J’ai terminé cette partie';
    btnEnvoyer.classList.toggle('secondaire', statut === 'soumis');
    btnEnvoyer.disabled = manques.length > 0 || statut === 'soumis';
    if (valide) elSauv.textContent = '✅ Validée par ton professeur.';
    else if (statut === 'soumis' && !enAttente) elSauv.textContent = 'Tu peux encore l’améliorer : tout est enregistré automatiquement.';
  }

  editeurPour(cle)($('[data-editeur]', vue), contenu, {
    lectureSeule: statut === 'valide',
    changer(c) { contenu = c; enAttente = true; elSauv.textContent = 'Modifications en cours…'; if (statut !== 'soumis' && statut !== 'valide') btnEnvoyer.disabled = false; sauverBientot(); },
  });

  zoneImages($('[data-images]', vue), cle, { lectureSeule: statut === 'valide' }).catch(() => {});

  async function sauver() {
    if (!enAttente) return enCours;
    enAttente = false;
    const envoi = (async () => {
      try {
        const r = await put(`/eleve/sections/${cle}`, { contenu });
        statut = r.statut; manques = r.manques;
        elSauv.textContent = `Enregistré ✓ ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
        majEtat();
      } catch (e) {
        enAttente = true;
        elSauv.textContent = '⚠️ Non enregistré : nouvel essai dans quelques secondes…';
        if (e.statut === 409) { enAttente = false; toast(e.message, 'erreur'); } else setTimeout(() => sauverBientot(), 4000);
      }
    })();
    enCours = envoi;
    await envoi;
    return envoi;
  }
  const sauverBientot = debounce(sauver, 1200);

  const zoneRelecture = $('[data-relecture]', vue);
  zoneRelecture.innerHTML = relectureHtml(s.relecture);
  const btnRelire = $('[data-relire]', vue);
  let restantes = s.relecturesRestantes ?? 0;
  const majRelire = () => {
    if (!btnRelire) return;
    btnRelire.textContent = restantes > 0 ? `🤖 Faire relire mon travail (${restantes} relecture${restantes > 1 ? 's' : ''} possible${restantes > 1 ? 's' : ''})` : '🤖 Relectures utilisées pour cette partie';
    btnRelire.disabled = restantes <= 0;
  };
  majRelire();
  if (btnRelire) btnRelire.addEventListener('click', () => action(btnRelire, async () => {
    sauverBientot.annuler();
    await sauver();
    btnRelire.textContent = 'Relecture en cours… (quelques secondes)';
    try {
      const r = await post(`/eleve/sections/${cle}/relire`);
      restantes = r.restantes;
      zoneRelecture.innerHTML = relectureHtml(r.relecture);
      zoneRelecture.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast('Relecture faite ✓ Lis les conseils, puis améliore ton texte.', 'ok', 4000);
    } finally { majRelire(); }
  }).then(majRelire));
  if (btnRelire && statut === 'valide') btnRelire.hidden = true;

  btnEnvoyer.addEventListener('click', () => action(btnEnvoyer, async () => {
    sauverBientot.annuler();
    await sauver();
    if (enAttente) throw new Error('Tes modifications ne sont pas encore enregistrées. Vérifie ta connexion.');
    const r = await post(`/eleve/sections/${cle}/envoyer`);
    statut = r.statut; manques = r.manques;
    toast('Bravo, partie terminée ✓', 'ok');
  }).then(majEtat));

  const avantDepart = (e) => { if (enAttente) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', avantDepart);
  const surCache = () => { if (document.visibilityState === 'hidden') { sauverBientot.annuler(); sauver(); } };
  document.addEventListener('visibilitychange', surCache);

  majEtat();
  if (s.modifie_le) elSauv.textContent = statut === 'valide' ? '✅ Validée par ton professeur.' : `Enregistré le ${dateHeure(s.modifie_le)}`;

  return async () => {
    window.removeEventListener('beforeunload', avantDepart);
    document.removeEventListener('visibilitychange', surCache);
    sauverBientot.annuler();
    await sauver();
  };
}

// ---------------------------------------------------------------- Dossier complet

export async function complet(vue) {
  const d = await get('/eleve/dossier-complet');
  vue.innerHTML = '<a class="retour" href="#/dossier">‹ Mon dossier</a><div data-dc></div>';
  afficherDossierComplet(vue.querySelector('[data-dc]'), d);
}
