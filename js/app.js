// Démarrage de Ma PFMP : connexion, navigation entre les écrans.
import { get, post, definirJeton, aUnJeton, quandSessionExpiree } from './api.js';
import { $, $$, esc, toast, action, modale, ouvrirTuto } from './ui.js';
import * as eleve from './eleve.js';
import * as prof from './prof.js';
import { envoyerAttente } from './attente.js';

export const etat = { utilisateur: null, config: null, invitationInstall: null };

const ROUTES = {
  eleve: [
    [/^\/$/, eleve.accueil, 'accueil'],
    [/^\/journal(?:\/(\d{4}-\d{2}-\d{2}))?$/, eleve.journal, 'journal'],
    [/^\/dossier$/, eleve.dossier, 'dossier'],
    [/^\/dossier\/complet$/, eleve.complet, 'dossier'],
    [/^\/dossier\/(identite|organigramme|introduction|veille|interview|mission_b[1-4]|checklist|bilan|projet|autoeval|oral)$/, eleve.rubrique, 'dossier'],
    [/^\/blocs$/, eleve.blocs, 'blocs'],
  ],
  prof: [
    [/^\/$/, prof.classe, 'classe'],
    [/^\/eleve\/(\d+)(?:\/([a-z0-9_]+))?$/, prof.fiche, 'classe'],
    [/^\/competences$/, prof.competences, 'competences'],
    [/^\/comptes$/, prof.comptes, 'comptes'],
  ],
};

let nettoyage = null;
let generation = 0;

async function router() {
  const g = ++generation;
  if (nettoyage) { const n = nettoyage; nettoyage = null; try { await n(); } catch { /* rien */ } }
  if (g !== generation) return;
  // Chaque écran reçoit un élément neuf : les écouteurs de l'écran précédent disparaissent avec lui.
  const ancien = $('#vue');
  const vue = ancien.cloneNode(false);
  ancien.replaceWith(vue);
  const u = etat.utilisateur;
  if (!u) return afficherConnexion();

  const chemin = location.hash.replace(/^#/, '') || '/';
  for (const [re, ecran, nav] of ROUTES[u.role]) {
    const m = chemin.match(re);
    if (!m) continue;
    $$('[data-nav]').forEach((a) => a.classList.toggle('actif', a.dataset.nav === nav));
    vue.className = u.role === 'prof' ? 'large' : '';
    vue.innerHTML = '<div class="chargement">Chargement…</div>';
    window.scrollTo(0, 0);
    try {
      const n = await ecran(vue, ...m.slice(1));
      if (g === generation) nettoyage = typeof n === 'function' ? n : null;
      else if (typeof n === 'function') n();
    } catch (e) {
      if (g === generation && etat.utilisateur) {
        vue.innerHTML = `<div class="bandeau alerte"><p><b>Impossible d’afficher cette page.</b></p><p>${esc(e.message)}</p>
          <button class="btn neutre petit" type="button" onclick="location.reload()">Recharger</button></div>`;
      }
    }
    return;
  }
  location.replace('#/');
}

function majCadre() {
  const u = etat.utilisateur;
  $('#entete').hidden = !u;
  $('#nav-eleve').hidden = !u || u.role !== 'eleve';
  $('#nav-prof').hidden = !u || u.role !== 'prof';
  document.body.classList.toggle('sans-nav', !u || u.role !== 'eleve');
}

function afficherConnexion() {
  majCadre();
  const ancien = $('#vue');
  const vue = ancien.cloneNode(false);
  ancien.replaceWith(vue);
  vue.className = '';
  vue.innerHTML = `
  <div class="connexion">
    <div class="logo"><span class="marque-pastille">P</span>Ma PFMP</div>
    <p class="accroche">Mon carnet de bord en entreprise</p>
    <form class="carte" id="form-connexion" autocomplete="on">
      <label class="champ"><span class="lib">Identifiant</span>
        <input name="identifiant" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="prenom.nom" required></label>
      <label class="champ"><span class="lib">Code</span>
        <span class="champ-secret"><input name="secret" type="password" autocomplete="current-password" autocapitalize="characters" required>
          <button type="button" class="voir-secret" data-voir aria-label="Afficher le code" title="Afficher le code">👁</button></span>
        <span class="aide">Le code donné par ton professeur (les professeurs saisissent leur mot de passe).</span></label>
      <button class="btn plein" type="submit">Se connecter</button>
    </form>
    <button class="btn secondaire plein" type="button" data-tuto style="margin-bottom:1rem">🎬 Voir le tuto (6 min)</button>
    <p class="discret petit" style="text-align:center">Code perdu ? Demande-en un nouveau à ton professeur.</p>
    <p class="petit" style="text-align:center"><button class="btn-lien petit" type="button" data-donnees>🔒 Données personnelles</button></p>
  </div>`;
  $('[data-voir]').addEventListener('click', (e) => {
    const champ = $('#form-connexion [name=secret]');
    const visible = champ.type === 'password';
    champ.type = visible ? 'text' : 'password';
    e.currentTarget.textContent = visible ? '🙈' : '👁';
    e.currentTarget.setAttribute('aria-label', visible ? 'Masquer le code' : 'Afficher le code');
    champ.focus();
  });
  $('#form-connexion').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    action(f.querySelector('button[type=submit]'), async () => {
      const r = await post('/connexion', { identifiant: f.identifiant.value.trim(), secret: f.secret.value.trim() });
      definirJeton(r.jeton);
      etat.utilisateur = r.utilisateur;
      majCadre();
      if (location.hash && location.hash !== '#/' && location.hash !== '#/connexion') router();
      else if (location.hash === '#/') router(); else location.hash = '#/';
    });
  });
}

quandSessionExpiree(() => {
  etat.utilisateur = null;
  toast('Ta session a expiré : reconnecte-toi.', 'erreur');
  router();
});

$('#btn-deconnexion').addEventListener('click', async () => {
  try { await post('/deconnexion'); } catch { /* déjà déconnecté */ }
  definirJeton(null);
  etat.utilisateur = null;
  location.hash = '#/';
  router();
});

// Page « Données personnelles », accessible depuis la connexion, l'accueil élève et l'écran Comptes.
export function afficherDonnees() {
  modale('🔒 Données personnelles', `<div class="texte-donnees">
    <p><b>Qui utilise Ma PFMP ?</b> Ma PFMP est l’outil de suivi des périodes de formation en milieu professionnel du lycée professionnel Paul Belmondo (Arpajon), mis en place par M. &amp; Mme Berruelle pour leur classe.</p>
    <p><b>Quelles données ?</b> Ton prénom, ton nom, ta classe et ton identifiant ; ce que tu écris dans ton journal et ton dossier ; les images que tu ajoutes ; la date de ta dernière connexion. Rien d’autre : pas d’adresse, pas de téléphone, pas de suivi publicitaire.</p>
    <p><b>Pourquoi ?</b> Pour t’accompagner pendant ta PFMP, suivre ton travail et préparer ton évaluation.</p>
    <p><b>Qui les voit ?</b> Toi et tes professeurs, M. &amp; Mme Berruelle. Personne d’autre, et rien n’est public. Les données sont stockées sur un serveur situé en France.</p>
    <p><b>Relecture par l’IA.</b> Quand <i>tu</i> cliques sur « Faire relire mon travail », le texte de la rubrique (sans ton nom) est envoyé au service d’intelligence artificielle d’Anthropic pour obtenir des conseils. Ce texte n’est pas utilisé pour entraîner l’IA. C’est pour cela qu’il ne faut jamais écrire d’informations confidentielles.</p>
    <p><b>Combien de temps ?</b> Tes données sont conservées pendant ta scolarité au lycée, comme ton portfolio Pearltrees, puis supprimées au plus tard un an après ton bac.</p>
    <p><b>Tes droits.</b> Tu peux demander à tes professeurs de consulter, corriger ou supprimer tes données.</p></div>`);
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-donnees]')) afficherDonnees();
  if (e.target.closest('[data-tuto]')) ouvrirTuto();
});

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); etat.invitationInstall = e; });
window.addEventListener('hashchange', router);

async function demarrer() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  try {
    etat.config = await get('/config');
  } catch (e) {
    $('#vue').innerHTML = `<div class="connexion"><div class="logo"><span class="marque-pastille">P</span>Ma PFMP</div>
      <div class="bandeau alerte"><p><b>Le serveur ne répond pas.</b></p><p>${esc(e.message)}</p>
      <button class="btn neutre petit" type="button" onclick="location.reload()">Réessayer</button></div></div>`;
    return;
  }
  if (aUnJeton()) {
    try { etat.utilisateur = (await get('/moi')).utilisateur; } catch { etat.utilisateur = null; }
  }
  majCadre();
  router();
  envoyerAttente();
}

demarrer();
