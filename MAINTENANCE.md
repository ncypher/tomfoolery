# Maintaining the notebook

## Pages

HTML is the deployed format. Room and field-note prose lives in Markdown; `npm run build` generates the HTML. Keep both in the same change. The builder uses a pinned Markdown renderer with a committed lockfile. It preserves the existing embedded room layouts, separates their first heading from the HTML wrapper, and translates local Markdown links to published HTML routes.

The Journal Room has one published index: `journal/index.html`, generated from `journal/index.md`. `journal/README.md` is a short contributor pointer. `.nojekyll` prevents a second Markdown renderer from claiming the same output paths. Published navigation uses `journal/` and `artifacts/philosophy.html` instead of Markdown source URLs. Old `.md` bookmarks point to source files; canonical reading links use HTML.

## Shared illustration

The related `ncypher` repository owns the vector template and animation score. From that checkout:

```sh
node scripts/render-orchestra.mjs --sync-site ../tomfoolery
```

Commit the two generated SVGs in this repository. The standalone illustration uses a synchronized nine-stage clock. `orchestra-map.svg` provides the interactive page's static geometry. `assets/orchestra-engine.mjs` owns the interactive rules; `orchestra-ui.mjs` renders state, history, controls, and the active edge.

`npm test` checks acceptance gates, failed checks, reopened work, stale evidence, retained dissent, and transition immutability. `npm run check` validates relative links and assets throughout the HTML collection. Browser checks should include phone-sized layouts, keyboard controls, and reduced motion.

## Pixel Pet

Pixel Pet keeps its pure care rules in `assets/pixel-pet-engine.mjs`, browser storage and rendering in `assets/pixel-pet-ui.mjs`, and vector artwork in `pixel-pet.html`. Its version-2 save uses `pixelPetTerrariumV2`; the old `pixelPetStatePro` save is read for migration and left intact. Older dead pets recover with a minimum of 35 in their original needs. Malformed saves fall back safely, and storage failures leave a playable session with an explanatory message. Only active, visible time advances needs; sleep restores energy, and zero needs never create an unrecoverable state. `scripts/test-pixel-pet.mjs` covers migration, invalid data, care effects, time bounds, and recovery.

## Publishing

Publish tomfoolery first, including generated HTML, both SVGs, scripts, CSS, and `.nojekyll`. Check the deployed Journal Room, Philosophy, and Polycentric Orchestra. Then publish the profile repository so its new links have destinations. The local changes alone do not update GitHub or GitHub Pages.
