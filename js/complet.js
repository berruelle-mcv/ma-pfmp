// Page « Dossier complet » : tout le dossier d'un élève sur une seule page, à lire ou à imprimer (PDF pour Pearltrees).
import { esc, pastilleStatut, toast, NIVEAUX } from './ui.js';
import { fabriquerPdf, telecharger, nomFichier } from './pdf.js';
import { hydraterImages } from './images.js';
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
  const prefixe = pourProf ? '/prof' : '/eleve';
  const vignettes = (cle) => { const ims = (d.images || []).filter((x) => x.cle === cle); return ims.length ? `<div class="vignettes" style="margin-top:.75rem">${ims.map((im) => `<figure class="vignette"><img data-image="${prefixe}/images/${im.id}/fichier" alt=""><figcaption>${esc(im.legende)}</figcaption></figure>`).join('')}</div>` : ''; };
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
    return `<section class="dc-rubrique"><h3>${esc(titre)}${statut}</h3>${manques}${commence(s) ? corps(s.contenu) + vignettes(cle) : '<p class="discret">Partie pas encore commencée.</p>'}</section>`;
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

// Écran commun élève / enseignant : bouton de téléchargement du PDF + aperçu du dossier.
export function afficherDossierComplet(zone, d, { pourProf = false } = {}) {
  const prefixe = pourProf ? '/prof' : '/eleve';
  zone.innerHTML = `
    <div class="bandeau info dc-ecran-seul"><p>${pourProf
    ? 'Toutes les rubriques de l’élève sur une page, pour la lecture finale. Le PDF est celui que l’élève dépose sur Pearltrees.'
    : '📄 Tout ton dossier en un seul fichier PDF, mis en page, prêt à déposer sur <b>Pearltrees</b>.'}</p>
      <button class="btn plein" type="button" data-pdf style="margin-top:.75rem">📥 Télécharger ${pourProf ? 'le' : 'mon'} dossier en PDF</button>
      <p class="petit discret" style="margin:.5rem 0 0">Fichier : ${esc(nomFichier(d.eleve))}</p></div>
    ${dossierCompletHtml(d, { pourProf })}`;
  hydraterImages(zone);
  const b = zone.querySelector('[data-pdf]');
  b.addEventListener('click', async () => {
    if (!pourProf) {
      const manquent = Object.keys(etat.config.sections)
        .filter((cle) => cle !== 'checklist' && d.sections[cle] && (d.sections[cle].manques || []).length)
        .map((cle) => etat.config.sections[cle].titre);
      if (manquent.length && !confirm(`Attention, ces parties ne sont pas complètes :\n\n• ${manquent.join('\n• ')}\n\nTélécharger quand même ?`)) return;
    }
    b.disabled = true;
    const avant = b.textContent;
    b.textContent = 'Fabrication du PDF… (quelques secondes)';
    try {
      const blob = await fabriquerPdf(d, { prefixe });
      telecharger(blob, nomFichier(d.eleve));
      toast('PDF prêt ✓ Regarde dans tes téléchargements.', 'ok', 5000);
    } catch (e) {
      toast(e.message || 'Le PDF n’a pas pu être fabriqué.', 'erreur', 6000);
    } finally { b.disabled = false; b.textContent = avant; }
  });
}
