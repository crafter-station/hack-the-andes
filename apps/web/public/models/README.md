# Sacred Valley terrain

Two meshes, one continuous landscape.

`sacred-valley.glb` is the Urubamba corridor from Ollantaytambo up to Pisac.
`west-terrain.glb` picks up exactly where it ends and runs 28 km down the gorge
to Machu Picchu. They ship separately so the western half can be fetched only
when the scroll heads that way, but they are not two places: they share a
projection, a height datum, and — the part that matters — a sampling lattice.

Rebuild with `python3 scripts/build-sacred-valley-glb.py` and
`python3 scripts/build-west-terrain-glb.py`. The first also regenerates
`components/landing/sacred-valley-place.ts` — the flight path, the town
anchors, the five site anchors and the solved camera tour — and the second
regenerates `components/landing/west-terrain-place.ts`. Pass `--places-only` to
the first to redo just the TypeScript without re-baking a 4 MB mesh.

| | corridor | western terrain |
| --- | --- | --- |
| Bounding box | -72.34, -13.50 to -71.77, -13.17 | -72.60, -13.38 to -72.34, -13.10 |
| Ground | 61.7 x 36.7 km | 28.2 x 31.2 km |
| Grid | 1152 x 686 | 526 x 583 |
| Mesh sampling | ~54 m | ~54 m |
| Drape | stripped after baking | stripped after baking |
| Shipped | 2.61 MB | not shipped |

The drape is baked and then removed. The hero draws the valley in contour
lines and samples no texture, so the imagery was 1.67 MB of JPEG riding inside
the one asset the page preloads; `scripts/strip-glb-drape.py` takes it out
after a rebuild. Bake it, strip it, and stamp the URL in
`components/landing/sacred-valley-place.ts` with the new digest.

`west-terrain.glb` is no longer shipped at all: it existed for the last leg of
the scroll flight, and nothing loads it since the drawn hero replaced that.

Accessed September 13, 2026.

## Why the seam holds

Machu Picchu first shipped as an island, 16 km clear of the corridor, on the
theory that the gorge between them was ground nobody would look at. The camera
flies straight over it, so the hole was in frame for the entire crossing — and
nothing layered on top of a hole turns it back into ground. Fog least of all:
fog fades geometry toward its own colour, and a hole has no geometry to fade.

Closing it took more than extending a bounding box. Two meshes that merely
share an edge do not share a surface: each resamples the elevation model on its
own grid, so the heights either side of the join come from different
interpolations of the same data and the seam opens into a hairline crack the
full height of the valley wall — worse than the gap, because a crack reads as a
rendering fault rather than as distance.

So `align_to_corridor` in `terrain_common.py` does not accept the box anyone
asks for. It snaps it onto the corridor's own lattice: the western mesh's
eastern column *is* the corridor's western column, and its rows step at exactly
the corridor's row spacing. Every shared vertex is then the same bilinear
sample of the same DEM at the same coordinate. The join is an identity, not a
tolerance.

That is also why the western half samples at ~54 m rather than the ~19 m the
citadel alone once had. The lattice is shared, and the camera is aerial — at
4 to 8 km out, the corridor's sampling is what the drape can carry anyway.

## The structure layer

`site-structures.glb` (20 KB) carries the terraces, towns and salt pans, built
by `scripts/build-site-structures-glb.py`. Without it the five stops are bare
hillside with a label floating over them, which undercuts the one thing the
landing is claiming about these places.

What to model was decided by arithmetic. At the tour's 5 to 8 km stand-off one
screen pixel covers about 8 m, so a single terrace is 0.4 px, a house 1.8 px
and a salt pan 0.6 px — drawing those produces a shimmering moire and nothing
else. A terrace *front* is 94 px, a town footprint 71 px and Moray's bowl
15 px. So the layer models massing, never elements: bands grouped every ~58 m
of elevation, town blocks rather than houses, a pan field rather than pans.

The shape is honest even though the scale is grouped. Terrace bands are contour
lines taken straight from the elevation model, filtered to slopes a terrace
could actually be cut into and clipped to a radius around each site, so they
bend where the real ridge bends instead of ringing the whole massif. Colour is
sampled from the satellite drape at each site — a bright percentile of a wide
neighbourhood, since half of any Andean hillside is in shadow in the imagery
and a mean would bake that shadow into the albedo — then lifted toward stone,
crop or roof.

## Attribution

Both sources require it, for both meshes — and the elevation line now covers a
third consumer, `public/deck/contour.avif`, which slices the same corridor DEM
into the contour plate the sponsorship decks sit on. It is built by
`scripts/build-deck-contour-plate.py` from this same cache.

- **Elevation** — Mapzen Terrain Tiles via the AWS Open Data Registry. SRTM
  terrain data courtesy of the U.S. Geological Survey.
  <https://registry.opendata.aws/terrain-tiles/>
  <https://github.com/tilezen/joerd/blob/master/docs/attribution.md>
- **Imagery** — Sentinel-2 cloudless 2016 by [EOX IT Services
  GmbH](https://cloudless.eox.at), containing modified Copernicus Sentinel data
  2016, released under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The 2016 layer is deliberate: every EOX cloudless layer from 2018 on is
CC BY-NC-SA, which a sponsored event site cannot use. The 2017 layer shares the
CC BY terms but serves blank tiles below zoom 14.

Nothing here derives from a heritage scan, and the meshes are the elevation
model as it was measured — no feature is cut into or added to them.

That is a decision the camera makes possible. An earlier pass flew to within a
kilometre of each site, which the data cannot support: at 54 m mesh sampling
and 15 m per texel, a near stop magnifies a blurred photograph, and filling in
the missing detail meant either licensing a heritage scan or generating
geometry and carving the terrain to host it. The tour is aerial instead, the
sites are pointed out by the HUD rather than inspected, and the terrain is left
alone.
