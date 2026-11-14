// Organigramme : affichage en arbre et éditeur à l'écran.
import { esc, modale } from './ui.js';

function enfants(noeuds, parent) { return noeuds.filter((n) => (n.parent || null) === parent); }

function boite(n, { cliquable, selection }) {
  const cls = `boite${n.moi ? ' moi' : ''}${n.poste ? '' : ' vide'}${selection === n.id ? ' selection' : ''}`;
  const corps = `<b>${n.poste ? esc(n.poste) : 'Poste à préciser'}</b>${n.nom ? `<small>${esc(n.nom)}</small>` : ''}`;
  return cliquable
    ? `<button type="button" class="${cls}" data-noeud="${esc(n.id)}">${corps}</button>`
    : `<div class="${cls}">${corps}</div>`;
}

function branche(noeuds, n, opts) {
  const e = enfants(noeuds, n.id);
  return `<li>${boite(n, opts)}${e.length ? `<ul>${e.map((x) => branche(noeuds, x, opts)).join('')}</ul>` : ''}</li>`;
}

export function arbreHtml(noeuds, opts = {}) {
  const racines = enfants(noeuds, null);
  if (!racines.length) return '<p class="discret">Organigramme vide.</p>';
  return `<div class="orga-zone"><ul class="orga">${racines.map((r) => branche(noeuds, r, opts)).join('')}</ul></div>`;
}

const nouvelId = () => Math.random().toString(36).slice(2, 10);

// Éditeur. contenu = { noeuds: [...] } ; changer(contenu) est appelé à chaque modification.
export function editeurOrganigramme(zone, contenu, { lectureSeule, changer }) {
  let noeuds = (contenu.noeuds || []).map((n) => ({ ...n }));
  let selection = null;

  const publier = () => changer({ noeuds: noeuds.map((n) => ({ ...n })) });

  function saisir(titre, n, valider) {
    const m = modale(titre, `
      <form>
        <label class="champ"><span class="lib">Poste ou service <span class="requis">*</span></span>
          <input name="poste" maxlength="80" value="${esc(n.poste || '')}" placeholder="ex. Directeur d’agence, Conseiller commercial…" required></label>
        <label class="champ"><span class="lib">Prénom (facultatif)</span>
          <input name="nom" maxlength="60" value="${esc(n.nom || '')}" placeholder="ex. Karim">
          <span class="aide">Pas de nom de famille : seulement le poste, et le prénom si la personne est d’accord.</span></label>
        <button class="btn plein" type="submit">Valider</button>
      </form>`);
    m.el.querySelector('input[name=poste]').focus();
    m.el.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const poste = e.target.poste.value.trim();
      if (!poste) return;
      valider({ poste, nom: e.target.nom.value.trim() });
      m.fermer();
    });
  }

  function dessiner() {
    if (lectureSeule) { zone.innerHTML = arbreHtml(noeuds); return; }
    if (!noeuds.length) {
      zone.innerHTML = `<div class="carte" style="text-align:center">
        <p>Commence par la personne qui dirige l’entreprise ou l’agence.</p>
        <button class="btn" type="button" data-act="racine">➕ Ajouter la direction</button></div>`;
    } else {
      const sel = noeuds.find((n) => n.id === selection);
      zone.innerHTML = `
        <p class="discret petit">Touche une case pour la modifier ou ajouter quelqu’un en dessous.</p>
        ${arbreHtml(noeuds, { cliquable: true, selection })}
        ${sel ? `<div class="carte">
          <p><b>${esc(sel.poste || 'Poste à préciser')}</b>${sel.nom ? ` — ${esc(sel.nom)}` : ''}</p>
          <div class="orga-actions">
            <button class="btn secondaire petit" type="button" data-act="ajouter">➕ Ajouter dessous</button>
            <button class="btn secondaire petit" type="button" data-act="modifier">✏️ Modifier</button>
            <button class="btn ${sel.moi ? 'neutre' : 'accent'} petit" type="button" data-act="moi">📍 ${sel.moi ? 'Ce n’est pas moi' : 'C’est ma place'}</button>
            <button class="btn neutre petit" type="button" data-act="supprimer">🗑 Supprimer</button>
          </div>
          ${!sel.parent ? '<button class="btn-lien petit" type="button" data-act="frere">Ajouter une autre case tout en haut</button>' : ''}
        </div>` : ''}
        ${noeuds.some((n) => n.moi) ? '' : '<div class="bandeau chaud petit"><p>N’oublie pas d’indiquer ta place : ajoute une case « Stagiaire » sous ton tuteur, puis touche « 📍 C’est ma place ».</p></div>'}`;
    }
  }

  zone.addEventListener('click', (e) => {
    if (lectureSeule) return;
    const b = e.target.closest('[data-noeud]');
    if (b) { selection = selection === b.dataset.noeud ? null : b.dataset.noeud; dessiner(); return; }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const sel = noeuds.find((n) => n.id === selection);
    switch (act.dataset.act) {
      case 'racine':
      case 'frere':
        saisir('Nouvelle case', {}, (v) => { const n = { id: nouvelId(), parent: null, moi: false, ...v }; noeuds.push(n); selection = n.id; publier(); dessiner(); });
        break;
      case 'ajouter':
        if (noeuds.length >= 80) return;
        saisir('Ajouter sous « ' + (sel.poste || '…') + ' »', {}, (v) => { const n = { id: nouvelId(), parent: sel.id, moi: false, ...v }; noeuds.push(n); selection = n.id; publier(); dessiner(); });
        break;
      case 'modifier':
        saisir('Modifier la case', sel, (v) => { Object.assign(sel, v); publier(); dessiner(); });
        break;
      case 'moi': {
        const devient = !sel.moi;
        noeuds.forEach((n) => { n.moi = false; });
        sel.moi = devient;
        publier(); dessiner();
        break;
      }
      case 'supprimer': {
        const sousCases = enfants(noeuds, sel.id);
        if (!sel.parent && sousCases.length) { alert('Supprime ou déplace d’abord les cases situées en dessous.'); return; }
        if (!confirm(`Supprimer « ${sel.poste || 'cette case'} » ?${sousCases.length ? ' Les cases en dessous remonteront d’un niveau.' : ''}`)) return;
        sousCases.forEach((n) => { n.parent = sel.parent; });
        noeuds = noeuds.filter((n) => n.id !== sel.id);
        selection = null;
        publier(); dessiner();
        break;
      }
      default:
    }
  });

  dessiner();
  return { definirLectureSeule(v) { lectureSeule = v; selection = null; dessiner(); } };
}

