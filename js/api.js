// Appels au serveur Immersio.
import { API } from './config.js';

const CLE_JETON = 'immersio.jeton';
let jeton = null;
try { jeton = localStorage.getItem(CLE_JETON); } catch { /* stockage indisponible */ }

export function definirJeton(j) {
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
    throw new Error('Pas de connexion avec le serveur. Vérifie ton réseau puis réessaie.');
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
  return donnees;
}

export const get = (c) => api('GET', c);
export const post = (c, b = {}) => api('POST', c, b);
export const put = (c, b = {}) => api('PUT', c, b);
export const patch = (c, b = {}) => api('PATCH', c, b);
export const del = (c, b) => api('DELETE', c, b);
