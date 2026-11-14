// Écrans enseignant : classe, fiche élève, carte des compétences, comptes.
import { get, post, patch, del } from './api.js';
import { etat } from './app.js';
import {
  $, esc, toast, action, modale, dateLongue, dateCourte, ilYA, joursOuvres, imprimer,
  NIVEAUX, MOMENTS, MOTIFS, pastilleStatut,
} from './ui.js';
import { lectureIdentite, lectureIntroduction, lectureVeille } from './rubriques.js';
import { arbreHtml } from './orga.js';
import { commentaireHtml } from './eleve.js';

const RUBRIQUES = ['identite', 'organigramme', 'introduction', 'veille'];
const COURT = { identite: 'Fiche', organigramme: 'Orga', introduction: 'Intro', veille: 'Veille' };
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

// ---------------------------------------------------------------- Classe

export async function classe(vue) {
  const d = await get('/prof/classe');
  const moi = etat.utilisateur.id;
  const actifs = d.eleves.filter((e) => e.actif);
  const mesEleves = actifs.filter((e) => e.referent_id === moi);
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
        ${[['mes', `Mes élèves (${mesEleves.length})`], ['tous', `Toute la classe (${actifs.length})`], ['alertes', `Alertes (${avecAlerte.length})`], ['lire', `À lire (${aLire.length})`], ['inactifs', 'Désactivés']]
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
    <div class="statuts">${RUBRIQUES.map((cle) => `<span title="${esc(titre(cle))}">${COURT[cle]} ${pastilleStatut(e.sections[cle].statut)}</span>`).join('')}</div>
    <div class="niveaux-mini">📓 ${j.nbActivites} activité${j.nbActivites > 1 ? 's' : ''} · ${NIVEAUX.observe.emoji} ${n.observe} · ${NIVEAUX.participe.emoji} ${n.participe} · ${NIVEAUX.realise.emoji} ${n.realise}
      ${j.ecoulees ? ` · ${j.ecoulees - j.manquantes}/${j.ecoulees} demi-journées` : ''}</div>
    ${e.alertes.map((a) => `<p class="alerte-ligne ${a.niveau}">⚠️ ${esc(a.texte)}</p>`).join('')}
  </a>`;
}

// ---------------------------------------------------------------- Fiche élève

const ONGLETS = [['suivi', 'Suivi'], ['journal', 'Journal'], ['identite', 'Fiche d’identité'], ['organigramme', 'Organigramme'], ['introduction', 'Introduction'], ['veille', 'Veille'], ['compte', 'Compte']];

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
    else zone.innerHTML = rubriqueHtml(onglet);
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
    const lecture = cle === 'identite' ? lectureIdentite(s.contenu) : cle === 'organigramme' ? arbreHtml(s.contenu.noeuds || []) : cle === 'veille' ? lectureVeille(s.contenu) : lectureIntroduction(s.contenu);
    const valide = s.statut === 'valide';
    return `
      <div class="rangee entre" style="margin-bottom:.75rem"><h2 style="margin:0">${esc(titre(cle))}</h2>${pastilleStatut(s.modifie_le ? s.statut : 'vide')}</div>
      ${s.modifie_le ? `<p class="discret petit">Dernière modification : ${esc(ilYA(s.modifie_le))}${s.manques.length ? ` · manque : ${esc(s.manques.join(', '))}` : ''}</p>` : '<div class="bandeau info"><p>L’élève n’a pas encore commencé cette rubrique.</p></div>'}
      <div class="carte">${lecture}</div>
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
        <div class="pile">
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
    const b = ev.target.closest('[data-compte]');
    if (!b) return;
    const quoi = b.dataset.compte;
    if (quoi === 'code') {
      if (!confirm(`Créer un nouveau code pour ${e.prenom} ? L’ancien ne marchera plus.`)) return;
      action(b, async () => {
        const r = await post(`/prof/eleves/${e.id}/nouveau-code`);
        const m = modale('Nouveau code', `<p>${esc(r.prenom)} ${esc(r.nom)}<br>Identifiant : <code>${esc(r.identifiant)}</code></p>
          <span class="code-affiche">${esc(r.code)}</span><p class="discret petit">Note-le maintenant : il ne sera plus affiché.</p>
          <button class="btn secondaire plein" type="button" data-imprimer>🖨 Imprimer</button>`);
        m.el.querySelector('[data-imprimer]').addEventListener('click', () => imprimer(fichesCodes([r])));
      });
    } else if (quoi === 'actif') {
      action(b, async () => {
        const r = await patch(`/prof/eleves/${e.id}`, { actif: !e.actif });
        Object.assign(e, r);
        dessiner();
      });
    } else if (quoi === 'supprimer') {
      const saisie = prompt(`Suppression définitive de ${e.prenom} ${e.nom} et de tout son travail.\nPour confirmer, tape son identifiant : ${e.identifiant}`);
      if (saisie === null) return;
      if (saisie.trim() !== e.identifiant) { toast('Identifiant incorrect : rien n’a été supprimé.', 'erreur'); return; }
      action(b, async () => {
        await del(`/prof/eleves/${e.id}`, { confirmation: e.identifiant });
        toast('Élève supprimé.', 'ok');
        location.hash = '#/';
      });
    }
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
        <label class="champ"><span class="lib">Référent de ces élèves</span><select name="referent">${optionsRef(etat.utilisateur.id)}</select>
          <span class="aide">Astuce : collez d’abord votre moitié de classe avec vous comme référent, puis l’autre moitié avec votre collègue.</span></label>
        <button class="btn" type="submit">Créer les comptes</button>
      </form>
      <div data-resultat></div>
    </div>
    <div class="carte"><h2>Comptes existants (${d.eleves.length})</h2>
      ${d.eleves.length ? `<div style="overflow-x:auto"><table class="liste"><thead><tr><th>Élève</th><th>Identifiant</th><th>Référent</th><th>Dernière connexion</th></tr></thead>
      <tbody>${d.eleves.map((e) => `<tr><td><a href="#/eleve/${e.id}/compte">${esc(e.nom.toUpperCase())} ${esc(e.prenom)}</a>${e.actif ? '' : ' <span class="statut revoir">désactivé</span>'}</td>
        <td><code>${esc(e.identifiant)}</code></td><td><select data-referent="${e.id}" aria-label="Référent de ${esc(e.prenom)}" style="min-height:36px;padding:.3rem .5rem">${optionsRef(e.referent_id)}</select></td><td>${esc(ilYA(e.derniere_connexion))}</td></tr>`).join('')}</tbody></table></div>
        <p class="discret petit">Pour un code perdu : ouvre la fiche de l’élève, onglet Compte, « Donner un nouveau code ».</p>` : '<p class="discret">Aucun compte.</p>'}
    </div>`;

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
