// biome-ignore-all lint/suspicious/noApproximativeNumericConstant: these
// are normalised polygon coordinates lifted from the artwork. One of them
// lands near a mathematical constant by coincidence, and rounding a vertex
// to satisfy a heuristic would move the drawing.

/**
 * The event's mountain, as points in a unit box.
 *
 * Carried as data rather than loaded as an image because the strap's
 * texture is built on a canvas while the scene mounts, and an image would
 * make that another thing to wait for. Lifted from
 * `docs/design/mountain-mark.svg` — the favicon — and normalised, so the
 * aspect below is the drawing's own.
 *
 * 5 subpaths: the silhouette and the facets cut out of it. They are
 * filled with a single non-zero winding, which is what makes the cuts
 * read as shadow rather than as separate shapes.
 */

export const MOUNTAIN_ASPECT = 1.562;

export const MOUNTAIN_PATH: ReadonlyArray<
  ReadonlyArray<readonly [number, number]>
> = [
  [
    [0.8341, 0.662],
    [0.7759, 0.6281],
    [0.7326, 0.5203],
    [0.7249, 0.4815],
    [0.6926, 0.4274],
    [0.6789, 0.3426],
    [0.6469, 0.2516],
    [0.6438, 0.243],
    [0.6242, 0.2166],
    [0.5587, 0.0816],
    [0.5091, 0.0],
    [0.5012, 0.018],
    [0.4535, 0.1273],
    [0.4209, 0.1478],
    [0.3975, 0.2064],
    [0.3194, 0.3355],
    [0.3183, 0.4344],
    [0.2798, 0.4897],
    [0.2417, 0.5904],
    [0.179, 0.6345],
    [0.0, 1.0],
    [1.0, 1.0],
  ],
  [
    [0.589, 0.1691],
    [0.5596, 0.1559],
    [0.6096, 0.2423],
    [0.6405, 0.2571],
    [0.6483, 0.3326],
    [0.6808, 0.4244],
    [0.6838, 0.434],
    [0.7113, 0.5213],
    [0.6165, 0.3992],
    [0.6235, 0.444],
    [0.5527, 0.2869],
    [0.5903, 0.3308],
    [0.5514, 0.2],
    [0.5116, 0.2623],
    [0.5088, 0.1032],
    [0.5284, 0.1318],
    [0.5085, 0.0257],
  ],
  [
    [0.4269, 0.1591],
    [0.4508, 0.1498],
    [0.4104, 0.2303],
  ],
  [
    [0.5795, 0.667],
    [0.559, 0.7302],
    [0.4288, 0.4069],
    [0.4723, 0.7909],
    [0.3909, 0.5399],
    [0.2732, 0.7984],
    [0.4292, 0.3403],
    [0.4975, 0.4469],
    [0.4685, 0.3403],
    [0.5263, 0.2976],
    [0.6483, 0.5478],
    [0.5858, 0.6226],
    [0.5232, 0.5324],
  ],
  [
    [0.6716, 0.6595],
    [0.6091, 0.7695],
    [0.6886, 0.5401],
    [0.8149, 0.7388],
    [0.842, 0.8516],
    [0.7362, 0.6833],
    [0.7451, 0.7981],
  ],
];

/** Traces it into a 2D context at a given box. Does not fill or stroke. */
export const traceMountain = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
): void => {
  const height = width / MOUNTAIN_ASPECT;
  context.beginPath();
  for (const subpath of MOUNTAIN_PATH) {
    subpath.forEach(([px, py], index) => {
      const at: [number, number] = [x + px * width, y + py * height];
      if (index === 0) {
        context.moveTo(at[0], at[1]);
        return;
      }
      context.lineTo(at[0], at[1]);
    });
    context.closePath();
  }
};
