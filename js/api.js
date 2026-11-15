// Appels au serveur Immersio.
import { API } from './config.js';

const CLE_JETON = 'immersio.jeton';
let jeton = null;
try { jeton = localStorage.getItem(CLE_JETON); } catch { /* stockage indisponible */ }

// Dernières réponses gardées sur l'appareil : l'appli s'ouvre même sans réseau (rendez-vous à l'extérieur, déplacements…).
const GARDEES = ['/config', '/moi', '/eleve/journal', '/eleve/accueil'];
const cleGardee = (c) => `mapfmp.copie${c}`;
function lireCopie(c) { try { return JSON.parse(localStorage.getItem(cleGardee(c))); } catch { return null; } }
function garderCopie(c, d) { try { localStorage.setItem(cleGardee(c), JSON.stringify(d)); } catch { /* plein */ } }
function oublierCopies() { try { for (const c of GARDEES) if (c !== '/config') localStorage.removeItem(cleGardee(c)); } catch { /* rien */ } }

export function definirJeton(j) {
  if (!j) oublierCopies();
  jeton = j;
  try { j ? localStorage.setItem(CLE_JETON, j) : localStorage.removeItem(CLE_JETON); } catch { /* rien */ }
}
export const aUnJeton = () => !!jeton;

let surSessionExpiree = () => {};
export function quandSessionExpiree(f) { surSessionExpiree = f; }

export async function api(methode, chemin, corps) {
  let rep;
  try {
    rep = await fetch(`${API}/api${chemin}`, {
      method: methode,
      headers: { 'Content-Type': 'application/json', ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
  } catch {
    if (methode === 'GET' && GARDEES.includes(chemin)) {
      const copie = lireCopie(chemin);
      if (copie) return { ...copie, horsLigne: true };
    }
    const e = new Error('Pas de connexion avec le serveur. Vérifie ton réseau puis réessaie.');
    e.horsLigne = true;
    throw e;
  }
  let donnees = null;
  try { donnees = await rep.json(); } catch { /* réponse vide */ }
  if (rep.status === 401 && jeton && chemin !== '/connexion') {
    definirJeton(null);
    surSessionExpiree();
  }
  if (!rep.ok) {
    const e = new Error((donnees && donnees.erreur) || `Erreur du serveur (${rep.status}).`);
    e.statut = rep.status;
    throw e;
  }
  if (methode === 'GET' && GARDEES.includes(chemin)) garderCopie(chemin, donnees);
  return donnees;
}

export const get = (c) => api('GET', c);
export const post = (c, b = {}) => api('POST', c, b);
export const put = (c, b = {}) => api('PUT', c, b);
export const patch = (c, b = {}) => api('PATCH', c, b);
export const del = (c, b) => api('DELETE', c, b);

// Envoi d'une image (JPEG déjà réduit dans le navigateur).
export async function envoyerImage(chemin, blob) {
  let rep;
  try {
    rep = await fetch(`${API}/api${chemin}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg', Authorization: `Bearer ${jeton}` }, body: blob });
  } catch { throw new Error('Pas de connexion avec le serveur : l’image n’a pas été envoyée.'); }
  let d = null;
  try { d = await rep.json(); } catch { /* rien */ }
  if (!rep.ok) throw new Error((d && d.erreur) || `Erreur du serveur (${rep.status}).`);
  return d;
}

// Lecture d'une image protégée : renvoie une adresse locale (blob:) utilisable dans <img>, gardée en mémoire.
const images = new Map();
export function urlImage(chemin) {
  if (!images.has(chemin)) {
    images.set(chemin, fetch(`${API}/api${chemin}`, { headers: { Authorization: `Bearer ${jeton}` } })
      .then((r) => { if (!r.ok) throw new Error('Image indisponible.'); return r.blob(); })
      .then((b) => URL.createObjectURL(b))
      .catch((e) => { images.delete(chemin); throw e; }));
  }
  return images.get(chemin);
}
export async function donneesImage(chemin) {
  const url = await urlImage(chemin);
  const b = await (await fetch(url)).blob();
  return new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(b); });
}
