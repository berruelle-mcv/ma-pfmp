// Images du dossier : ajout depuis le téléphone (réduites avant l'envoi), légende, suppression.
import { get, patch, del, envoyerImage, urlImage } from './api.js';
import { esc, modale, toast, action } from './ui.js';
import { etat } from './app.js';

const COTE_MAX = 1600;

// Réduit la photo (souvent 4 à 12 Mo sur un téléphone) en JPEG d'environ 300 Ko.
async function reduire(fichier) {
  let source;
  try { source = await createImageBitmap(fichier, { imageOrientation: 'from-image' }); } catch {
    source = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('Ce fichier n’est pas une image lisible.')); i.src = URL.createObjectURL(fichier); });
  }
  const l = source.width; const h = source.height;
  const r = Math.min(1, COTE_MAX / Math.max(l, h));
  const c = document.createElement('canvas');
  c.width = Math.round(l * r); c.height = Math.round(h * r);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(source, 0, 0, c.width, c.height);
  for (const q of [0.82, 0.7, 0.55]) {
    // eslint-disable-next-line no-await-in-loop
    const b = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', q));
    if (b && b.size < 1.8 * 1024 * 1024) return b;
  }
  throw new Error('Image trop lourde, même réduite.');
}

// Remplace chaque <img data-image="/chemin"> par l'image protégée.
export function hydraterImages(racine) {
  racine.querySelectorAll('img[data-image]').forEach((img) => {
    urlImage(img.dataset.image).then((u) => { img.src = u; }).catch(() => { img.alt = 'Image indisponible'; });
  });
}

// Bloc « Images » sous une rubrique, côté élève.
export async function zoneImages(conteneur, cle, { lectureSeule = false } = {}) {
  const empl = etat.config.emplacementsImages && etat.config.emplacementsImages[cle];
  if (!empl) { conteneur.innerHTML = ''; return; }
  let liste = (await get(`/eleve/images?cle=${cle}`)).images;

  function dessiner() {
    conteneur.innerHTML = `<div class="carte zone-images"><h2>📷 Images</h2>
      <p class="discret petit">Facultatif, mais ça rend ton dossier vivant. 🔒 Aucun client reconnaissable, aucun document confidentiel, et demande toujours l’accord de ton tuteur.</p>
      ${Object.entries(empl).map(([k, e]) => {
    const ims = liste.filter((x) => x.emplacement === k);
    return `<div class="empl-image"><div class="lib">${esc(e.lib)}${e.max > 1 ? ` <span class="discret">(${ims.length}/${e.max})</span>` : ''}</div>
        <div class="vignettes">${ims.map((im) => `<figure class="vignette">
          <img data-image="/eleve/images/${im.id}/fichier" alt="">
          ${lectureSeule ? `<figcaption>${esc(im.legende)}</figcaption>` : `<input data-legende="${im.id}" maxlength="160" value="${esc(im.legende)}" placeholder="Légende${e.legendeObligatoire ? ' (obligatoire)' : ''}">
          <button class="btn-lien petit" type="button" data-suppr="${im.id}">🗑 Retirer</button>`}
        </figure>`).join('')}
        ${!lectureSeule && ims.length < e.max ? `<label class="btn secondaire petit ajout-image">➕ Ajouter une image<input type="file" accept="image/*" data-ajout="${k}" hidden></label>` : ''}</div></div>`;
  }).join('')}</div>`;
    hydraterImages(conteneur);
  }

  conteneur.addEventListener('change', (ev) => {
    const inp = ev.target.closest('[data-ajout]');
    if (!inp || !inp.files[0]) return;
    const fichier = inp.files[0];
    inp.value = '';
    preparer(inp.dataset.ajout, fichier);
  });
  conteneur.addEventListener('focusout', (ev) => {
    const inp = ev.target.closest('[data-legende]');
    if (!inp) return;
    const im = liste.find((x) => x.id === Number(inp.dataset.legende));
    if (!im || im.legende === inp.value.trim()) return;
    patch(`/eleve/images/${im.id}`, { legende: inp.value }).then(() => { im.legende = inp.value.trim(); toast('Légende enregistrée ✓', 'ok'); })
      .catch((e) => { toast(e.message, 'erreur'); inp.value = im.legende; });
  });
  conteneur.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-suppr]');
    if (!b || !confirm('Retirer cette image de ton dossier ?')) return;
    action(b, async () => {
      await del(`/eleve/images/${b.dataset.suppr}`);
      liste = liste.filter((x) => x.id !== Number(b.dataset.suppr));
      dessiner();
    });
  });

  async function preparer(emplacement, fichier) {
    let blob;
    try { blob = await reduire(fichier); } catch (e) { toast(e.message, 'erreur', 5000); return; }
    const e = empl[emplacement];
    const apercu = URL.createObjectURL(blob);
    const fen = modale('Ajouter une image', `<form>
      <img src="${apercu}" alt="" class="apercu-image">
      <label class="champ"><span class="lib">Légende${e.legendeObligatoire ? ' <span class="requis">*</span>' : ''}</span>
        <input name="legende" maxlength="160" placeholder="Ce que montre l’image, en une phrase"${e.legendeObligatoire ? ' required' : ''}></label>
      <label class="case-accord"><input type="checkbox" name="accord" required> Je confirme : aucun client reconnaissable, aucun document confidentiel, et mon tuteur est d’accord.</label>
      <button class="btn plein" type="submit" style="margin-top:1rem">Ajouter à mon dossier</button></form>`);
    const f = fen.el.querySelector('form');
    f.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (!f.accord.checked) { toast('Coche la case de confirmation.', 'erreur'); return; }
      if (e.legendeObligatoire && !f.legende.value.trim()) { toast('Ajoute une légende.', 'erreur'); return; }
      action(f.querySelector('[type=submit]'), async () => {
        const im = await envoyerImage(`/eleve/images?cle=${cle}&emplacement=${emplacement}&legende=${encodeURIComponent(f.legende.value.trim())}`, blob);
        liste.push(im);
        fen.fermer();
        URL.revokeObjectURL(apercu);
        toast('Image ajoutée ✓', 'ok');
        dessiner();
      });
    });
  }

  dessiner();
}

// Images d'une rubrique, côté enseignant (lecture + retrait).
export function imagesProfHtml(images, cle) {
  const ims = images.filter((x) => x.cle === cle);
  if (!ims.length) return '';
  return `<div class="vignettes" style="margin-top:1rem">${ims.map((im) => `<figure class="vignette">
    <img data-image="/prof/images/${im.id}/fichier" alt=""><figcaption>${esc(im.legende || '(sans légende)')}</figcaption>
    <button class="btn-lien petit" type="button" data-suppr-image="${im.id}">🗑 Retirer</button></figure>`).join('')}</div>`;
}
