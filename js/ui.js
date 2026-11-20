// Petits outils d'affichage partagés.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, racine = document) => racine.querySelector(sel);
export const $$ = (sel, racine = document) => [...racine.querySelectorAll(sel)];

export function toast(message, type = 'info', duree = 3200) {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = message;
  $('#toasts').append(t);
  setTimeout(() => t.remove(), duree);
}

const versDate = (j) => new Date(`${j}T12:00:00`);
export const dateLongue = (j) => versDate(j).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
export const dateCourte = (j) => versDate(j).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
export const jourSemaine = (j) => versDate(j).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '');
export function dateHeure(sql) {
  if (!sql) return '';
  const d = new Date(sql.replace(' ', 'T') + 'Z');
  return d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
export function ilYA(sql) {
  if (!sql) return 'jamais';
  const min = Math.round((Date.now() - new Date(sql.replace(' ', 'T') + 'Z').getTime()) / 60000);
  if (min < 2) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return j === 1 ? 'hier' : `il y a ${j} jours`;
}

export function ajouterJours(j, n) {
  const d = new Date(`${j}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const jourSem = (j) => new Date(`${j}T12:00:00Z`).getUTCDay(); // 0 = dimanche
export function lundiDe(j) { const js = jourSem(j); return ajouterJours(j, js === 0 ? -6 : 1 - js); }
export function joursOuvres(du, au) {
  const r = [];
  for (let j = du; j <= au; j = ajouterJours(j, 1)) { const s = jourSem(j); if (s >= 1 && s <= 5) r.push(j); }
  return r;
}

export function debounce(f, ms) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); };
  d.annuler = () => clearTimeout(t);
  return d;
}

export const NIVEAUX = {
  observe: { emoji: '👀', lib: 'Observé', aide: 'j’ai regardé faire' },
  participe: { emoji: '🤝', lib: 'Participé', aide: 'j’ai aidé, avec quelqu’un' },
  realise: { emoji: '⭐', lib: 'Réalisé', aide: 'je l’ai fait moi-même' },
};
export const MOMENTS = { matin: 'Matin', aprem: 'Après-midi' };
export const MOTIFS = { absent: 'Absent·e', ferme: 'Entreprise fermée', repos: 'Jour de repos prévu' };
export const STATUTS = {
  vide: { lib: 'À faire', cls: 'vide' },
  brouillon: { lib: 'Brouillon', cls: 'brouillon' },
  soumis: { lib: 'Terminée', cls: 'soumis' },
  a_revoir: { lib: 'À revoir', cls: 'revoir' },
  valide: { lib: 'Validée ✓', cls: 'valide' },
};
export const pastilleStatut = (s) => { const x = STATUTS[s] || STATUTS.vide; return `<span class="statut ${x.cls}">${x.lib}</span>`; };

export function modale(titre, contenuHtml, { fermable = true } = {}) {
  const voile = document.createElement('div');
  voile.className = 'voile';
  voile.innerHTML = `<div class="modale" role="dialog" aria-modal="true" aria-label="${esc(titre)}">
    <div class="modale-entete"><h2>${esc(titre)}</h2>${fermable ? '<button type="button" class="btn-icone" data-fermer aria-label="Fermer">✕</button>' : ''}</div>
    <div class="modale-corps">${contenuHtml}</div></div>`;
  const fermer = () => { voile.remove(); document.removeEventListener('keydown', echap); };
  const echap = (e) => { if (e.key === 'Escape' && fermable) fermer(); };
  voile.addEventListener('click', (e) => { if (fermable && (e.target === voile || e.target.closest('[data-fermer]'))) fermer(); });
  document.addEventListener('keydown', echap);
  document.body.append(voile);
  const premier = voile.querySelector('textarea, input:not([type=radio]), select');
  if (premier && matchMedia('(min-width: 640px)').matches) premier.focus();
  return { el: voile, fermer };
}

// Désactive un bouton le temps d'une action asynchrone et affiche l'erreur éventuelle.
export async function action(bouton, f) {
  if (bouton) bouton.disabled = true;
  try { return await f(); } catch (e) { toast(e.message, 'erreur', 5000); return undefined; } finally { if (bouton) bouton.disabled = false; }
}

export function imprimer(html) {
  $('#impression').innerHTML = html;
  document.body.classList.add('imprime');
  const fin = () => { document.body.classList.remove('imprime'); window.removeEventListener('afterprint', fin); };
  window.addEventListener('afterprint', fin);
  setTimeout(() => window.print(), 50);
}

export const nbMots = (s) => (String(s || '').match(/[\p{L}\p{N}'’-]+/gu) || []).length;

// Tuto vidéo (hébergé avec le site, dans video/). Lecture dans une fenêtre, arrêt à la fermeture.
export function ouvrirTuto() {
  const f = modale('🎬 Le tuto Ma PFMP', `<video class="tuto-video" controls playsinline preload="metadata" poster="video/tuto-affiche.jpg" src="video/tuto-ma-pfmp.mp4">
    Ta version du navigateur ne peut pas lire la vidéo.</video>
    <p class="petit discret" style="margin:.5rem 0 0">6 minutes · pense à monter le son 🔊 · touche ⛶ pour le plein écran.</p>`);
  f.el.querySelector('.modale').classList.add('large');
  const v = f.el.querySelector('video');
  v.play().catch(() => { /* lecture au toucher */ });
  return f;
}
