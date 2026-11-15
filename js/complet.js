// Page « Dossier complet » : tout le dossier d'un élève sur une seule page, à lire ou à imprimer (PDF pour Pearltrees).
import { esc, pastilleStatut, imprimer, NIVEAUX } from './ui.js';
import { etat } from './app.js';
import { arbreHtml } from './orga.js';
import {
  lectureIdentite, lectureIntroduction, lectureVeille, lectureMission, lectureInterview,
  lectureBilan, lectureProjet, lectureAutoeval, diaposHtml,
} from './rubriques.js';

const ORDRE_NIV = { observe: 1, participe: 2, realise: 3 };
const dateLongue = (j) => new Date(`${j}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const commence = (s) => s && (s.modifie_le || s.statut !== 'brouillon');

// Tableau des compétences travaillées, d'après le journal.
function competencesHtml(activites) {
  const parCode = {};
  for (const a of activites) {
    if (!a.competence) continue;
    const x = parCode[a.competence] || (parCode[a.competence] = { n: 0, niv: '' });
    x.n += 1;
    if ((ORDRE_NIV[a.niveau] || 0) > (ORDRE_NIV[x.niv] || 0)) x.niv = a.niveau;
  }
  return etat.config.blocs.map((b) => {
    const lignes = b.competences.filter((c) => parCode[c.code]);
    return `<h4>${esc(b.code)} — ${esc(b.titre)}</h4>${lignes.length ? `<table class="liste dc-table"><thead><tr><th>Compétence</th><th>Niveau atteint</th><th>Activités</th></tr></thead><tbody>
      ${lignes.map((c) => { const x = parCode[c.code]; const n = NIVEAUX[x.niv]; return `<tr><td>${esc(c.libelle)}</td><td>${n ? `${n.emoji} ${esc(n.lib)}` : '—'}</td><td>${x.n}</td></tr>`; }).join('')}
    </tbody></table>` : '<p class="discret">Aucune activité notée dans ce bloc.</p>'}`;
  }).join('');
}

export function dossierCompletHtml(d, { pourProf = false } = {}) {
  const S = d.sections;
  const nom = `${d.eleve.prenom} ${d.eleve.nom.toUpperCase()}`;
  const p = etat.config.pfmp;
  const entreprise = (S.identite && S.identite.contenu.denomination) || '';
  const acts = d.journal.activites || [];

  const rubrique = (cle, corps) => {
    const s = S[cle];
    const titre = etat.config.sections[cle].titre;
    const statut = pourProf ? ` ${pastilleStatut(commence(s) ? s.statut : 'vide')}` : '';
    const manques = pourProf && commence(s) && s.manques && s.manques.length ? `<p class="dc-manques">Il manque : ${s.manques.map(esc).join(' ; ')}.</p>` : '';
    return `<section class="dc-rubrique"><h3>${esc(titre)}${statut}</h3>${manques}${commence(s) ? corps(s.contenu) : '<p class="discret">Partie pas encore commencée.</p>'}</section>`;
  };

  const missions = etat.config.blocs.map((b) => rubrique(`mission_${b.code.toLowerCase()}`, (c) => lectureMission(c, b, acts))).join('');
  const nbRealise = acts.filter((a) => a.niveau === 'realise').length;
  const nbParticipe = acts.filter((a) => a.niveau === 'participe').length;
  const nbObserve = acts.filter((a) => a.niveau === 'observe').length;

  const parties = [
    ['Introduction', rubrique('introduction', lectureIntroduction)],
    ['L’entreprise', rubrique('identite', lectureIdentite) + rubrique('organigramme', (c) => arbreHtml(c.noeuds || [])) + rubrique('veille', lectureVeille)],
    ['Mes activités et mes missions', `<section class="dc-rubrique"><h3>Ce que j’ai fait pendant la PFMP</h3>
        <p>${acts.length} activités notées dans mon journal : ${NIVEAUX.observe.emoji} ${nbObserve} observées, ${NIVEAUX.participe.emoji} ${nbParticipe} avec participation, ${NIVEAUX.realise.emoji} ${nbRealise} réalisées.</p>
        ${competencesHtml(acts)}</section>${missions}`],
    ['Le professionnel', rubrique('interview', lectureInterview)],
    ['Mon bilan', rubrique('bilan', lectureBilan) + rubrique('projet', lectureProjet) + rubrique('autoeval', lectureAutoeval)],
    ['Annexe : trame de mon oral', rubrique('oral', (c) => `<div class="diapos">${diaposHtml(c)}</div>`)],
  ];

  return `<div class="dossier-complet">
    <div class="dc-couverture">
      <p class="dc-sur">Dossier de PFMP · ${esc(p.classe)}</p>
      <h1>${esc(nom)}</h1>
      ${entreprise ? `<p class="dc-ent">${esc(entreprise)}</p>` : ''}
      <p>Période de formation en milieu professionnel<br>du ${dateLongue(p.debut)} au ${dateLongue(p.fin)}</p>
      <p class="discret">Lycée professionnel Paul Belmondo · Arpajon</p>
      <ol class="dc-sommaire">${parties.map(([t]) => `<li>${esc(t)}</li>`).join('')}</ol>
    </div>
    ${parties.map(([t, h], i) => `<div class="dc-partie"><h2>${i + 1}. ${esc(t)}</h2>${h}</div>`).join('')}
  </div>`;
}

// Écran commun élève / enseignant : bouton d'impression + dossier.
export function afficherDossierComplet(zone, d, { pourProf = false } = {}) {
  zone.innerHTML = `
    <div class="bandeau info dc-ecran-seul"><p>${pourProf
    ? 'Toutes les rubriques de l’élève sur une page, pour la lecture finale.'
    : '📄 Tout ton dossier sur une seule page. Pour Pearltrees : clique sur « Imprimer ou enregistrer en PDF », choisis <b>Enregistrer au format PDF</b>, puis dépose le fichier dans ton Pearltrees.'}</p>
      <button class="btn plein" type="button" data-imprimer-dossier style="margin-top:.75rem">🖨 Imprimer ou enregistrer en PDF</button></div>
    ${dossierCompletHtml(d, { pourProf })}`;
  zone.querySelector('[data-imprimer-dossier]').addEventListener('click', () => {
    const titreAvant = document.title;
    document.title = `PFMP - ${d.eleve.prenom} ${d.eleve.nom}`;
    imprimer(dossierCompletHtml(d));
    setTimeout(() => { document.title = titreAvant; }, 2000);
  });
}
