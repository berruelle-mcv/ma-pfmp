// Activités du journal notées sans réseau : gardées sur le téléphone, envoyées dès que le réseau revient.
import { post } from './api.js';
import { toast } from './ui.js';
import { etat } from './app.js';

// Une file par élève (un téléphone peut être prêté).
const cle = () => `mapfmp.attente.${(etat.utilisateur && etat.utilisateur.id) || 0}`;
const lire = () => { try { return JSON.parse(localStorage.getItem(cle())) || []; } catch { return []; } };
const ecrire = (l) => { try { localStorage.setItem(cle(), JSON.stringify(l)); } catch { /* rien */ } };

export const enAttente = () => lire();

export function mettreEnAttente(corps) {
  const l = lire();
  const item = { ...corps, id: `attente-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, attente: true };
  l.push(item);
  ecrire(l);
  return item;
}

export function viderAttente() { ecrire([]); }

let envoi = null;
export function envoyerAttente() {
  if (envoi || !etat.utilisateur || etat.utilisateur.role !== 'eleve' || !lire().length) return envoi;
  envoi = (async () => {
    let ok = 0;
    for (const item of lire()) {
      const { id, attente, ...corps } = item;
      try {
        await post('/eleve/journal', corps);
        ok += 1;
        ecrire(lire().filter((x) => x.id !== id));
      } catch (e) {
        if (e.horsLigne || !e.statut || e.statut >= 500 || e.statut === 401) break; // on réessaiera plus tard
        ecrire(lire().filter((x) => x.id !== id));
        toast(`Une activité gardée sur ton téléphone n’a pas pu être enregistrée : ${e.message}`, 'erreur', 8000);
      }
    }
    if (ok) {
      toast(`${ok} activité${ok > 1 ? 's' : ''} notée${ok > 1 ? 's' : ''} sans réseau ${ok > 1 ? 'ont été envoyées' : 'a été envoyée'} ✓`, 'ok', 5000);
      window.dispatchEvent(new CustomEvent('attente-envoyee'));
    }
  })().finally(() => { envoi = null; });
  return envoi;
}

window.addEventListener('online', () => envoyerAttente());
setInterval(() => { if (navigator.onLine !== false) envoyerAttente(); }, 30000);
