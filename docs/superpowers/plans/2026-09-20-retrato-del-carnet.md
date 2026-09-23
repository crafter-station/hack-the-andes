# Retrato del carnet — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el carnet lleve la foto real del participante —de GitHub o
subida por él—, recortada de su fondo, dibujada en semitono, y que al
abrir la página se arme con un barrido ASCII en diagonal.

**Architecture:** El recorte ocurre **una vez, en el navegador, al elegir
la foto**: un modelo de segmentación produce un PNG transparente que se
guarda con el pipeline de subida que ya existe. A partir de ahí el
servidor sólo lee ese PNG — `sharp` lo convierte en semitono y satori lo
coloca en la cara del carnet, sin cambiar cómo se compone la tarjeta. El
barrido ASCII es una capa de introducción independiente, en canvas, que
se dibuja del mismo recorte y se retira cuando termina.

**Tech Stack:** Next 16 App Router · satori (`next/og`) · sharp ·
`@mediapipe/tasks-vision` (Apache-2.0) · three / @react-three/fiber ·
Drizzle · Clerk

**Spec:** No hay documento de spec. Lo valida la prueba interactiva
publicada en `https://claude.ai/artifact/ARY793b8RdyUnjvchAoR4f`, que
demuestra el barrido, el recorte y el semitono con las medidas de este
plan; y el diseño de referencia en `docs/design/credential-badge.svg`.

## Global Constraints

- Bun 1.3.14 / Turbo. `bun.lock` es el único lockfile.
- Biome con `--error-on-warnings`. `bun run lint`, `bun run check-types` y
  `bun test` tienen que quedar verdes en cada tarea.
- Reservar los ternarios para selección corta de dos valores en una línea.
  Para condiciones multilínea, variables con nombre o `if`/`else`.
- Los botones llevan una sola línea de texto.
- `CONTEXT.md` manda: **una imagen disponible no se usa hasta que la
  persona confirma una fuente.** Todo lo que este plan añade escribe
  `pictureSource` y `pictureUrl` sólo como resultado de una confirmación
  explícita.
- Sólo solicitudes con `status = "accepted"`, y sólo la activa.
- El texto de cara al usuario va en español.
- Ningún secreto ni URL de blob en el cliente salvo los que el endpoint
  existente ya emite.

## Decisiones ya tomadas, y por qué

Están aquí para que nadie las vuelva a abrir a mitad de camino.

**El carnet lleva semitono, no ASCII.** Medido: la ventana de foto ocupa
113 px en pantalla. A esa escala el ASCII da 1,38 px por carácter y se lee
como una mancha rayada; el semitono da 1,15 px por punto y se lee nítido.
Un punto transmite un solo valor —su tamaño—; un carácter necesita que
distingas su forma.

**El ASCII es la animación, y vive grande.** El barrido ocupa la pantalla,
donde los caracteres miden 6 px.

**El recorte se hace en el navegador, al elegir la foto.** No en la ruta
que pinta el carnet. Así el modelo se paga una vez por persona en vez de
en cada render, la persona ve el resultado antes de que quede fijo, y la
ruta de la textura sigue siendo tonta.

**El semitono lo hace el servidor con `sharp`.** El recorte guardado es la
única fuente; el semitono se deriva en cada render y no se almacena, así
que cambiar la rejilla no obliga a regenerar nada.

**No se migra satori a canvas.** Guardar el recorte hace innecesaria esa
migración: satori coloca un PNG como ya coloca el retrato hoy.

## Riesgos conocidos

- **`@mediapipe/tasks-vision` descarga su `.wasm` y su modelo en tiempo de
  ejecución.** En la app eso está permitido, pero hay que servirlos desde
  el propio dominio (Tarea 2) y no desde un CDN de terceros, o una CSP
  futura lo romperá.
- **La segmentación falla con fondos complicados.** La Tarea 4 exige que
  la persona vea el recorte y pueda rechazarlo.
- **`pictureSource` también es campo de los datos de aceptación.** Este
  plan escribe a través de la misma función de servicio, nunca contra las
  columnas, para que no haya dos caminos que se pisen.

## Estructura de ficheros

| Fichero | Responsabilidad |
| --- | --- |
| `apps/web/lib/portrait/luminance.ts` | Imagen → rejilla de luminancia normalizada. Puro, compartido por cliente y servidor. |
| `apps/web/lib/portrait/halftone.ts` | Rejilla → SVG de puntos. Puro. Lo usa el servidor. |
| `apps/web/lib/portrait/ascii.ts` | Rejilla → caracteres, y el calendario del barrido diagonal. Puro. |
| `apps/web/lib/portrait/cutout.ts` | Segmentación en el navegador. Único módulo que toca MediaPipe. |
| `apps/web/components/portrait/portrait-picker.tsx` | Elegir GitHub o subir, ver el recorte, confirmar. |
| `apps/web/components/portrait/portrait-sweep.tsx` | El barrido ASCII sobre canvas. |
| `apps/web/lib/credential/card-texture.tsx` | Modificado: coloca el semitono. |
| `apps/web/lib/credential/accepted.ts` | Modificado: expone la fuente confirmada. |
| `apps/web/app/carnet/page.tsx` | Modificado: monta el barrido y el selector. |

---

### Tarea 1: La luminancia, el semitono y el ASCII como funciones puras

Los tres son aritmética sobre una rejilla y no necesitan navegador ni
servidor. Separarlos así es lo que permite que la animación del cliente y
el render del servidor no puedan discrepar sobre cómo se ve una foto.

**Files:**
- Create: `apps/web/lib/portrait/luminance.ts`
- Create: `apps/web/lib/portrait/halftone.ts`
- Create: `apps/web/lib/portrait/ascii.ts`
- Test: `apps/web/lib/portrait/portrait.test.ts`

**Interfaces:**
- Produces:
  - `type Grid = { readonly width: number; readonly height: number; readonly values: Float32Array }`
  - `normalise(values: Float32Array): Float32Array`
  - `lumaFromRgba(data: Uint8ClampedArray, width: number, height: number): Grid`
  - `halftoneSvg(grid: Grid, options: { cell: number; ink: string }): string`
  - `ASCII_RAMP: string`, `CELL_WIDTH: 6`, `CELL_HEIGHT: 10`
  - `charForLuma(luma: number): string`
  - `sweepThreshold(x: number, y: number, columns: number, rows: number): number`

- [ ] **Step 1: Write the failing tests**

```ts
// apps/web/lib/portrait/portrait.test.ts
import { describe, expect, test } from "bun:test";

import { charForLuma, sweepThreshold } from "@/lib/portrait/ascii";
import { halftoneSvg } from "@/lib/portrait/halftone";
import { lumaFromRgba, normalise } from "@/lib/portrait/luminance";

const solid = (r: number, g: number, b: number, count: number) => {
  const data = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i += 1) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return data;
};

describe("lumaFromRgba", () => {
  test("weights green the way Rec. 709 does", () => {
    // Not an average. Equal weights turn a green photograph into mud and
    // a red one into a silhouette; this is the one line that decides
    // whether a colour portrait survives being reduced to one channel.
    const green = lumaFromRgba(solid(0, 255, 0, 1), 1, 1).values[0] ?? 0;
    const blue = lumaFromRgba(solid(0, 0, 255, 1), 1, 1).values[0] ?? 0;

    expect(green).toBeCloseTo(0.7152, 3);
    expect(blue).toBeCloseTo(0.0722, 3);
  });
});

describe("normalise", () => {
  test("stretches a flat photograph across the full range", () => {
    // A photograph's own histogram rarely spans 0..1, and quantising a
    // narrow band to ten levels throws away most of the face.
    const stretched = normalise(Float32Array.from([0.4, 0.5, 0.6]));

    expect(stretched[0]).toBeCloseTo(0, 3);
    expect(stretched[2]).toBeCloseTo(1, 3);
  });

  test("survives an image with no range at all", () => {
    // A blank upload divides by zero unless this is handled.
    const flat = normalise(Float32Array.from([0.5, 0.5, 0.5]));

    for (const value of flat) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});

describe("halftoneSvg", () => {
  test("gives a brighter cell a bigger dot", () => {
    // The whole encoding: a dot carries one value and it is its radius.
    const svg = halftoneSvg(
      { width: 2, height: 1, values: Float32Array.from([0.1, 0.9]) },
      { cell: 10, ink: "#f6f3ee" },
    );
    const radii = [...svg.matchAll(/r="([\d.]+)"/g)].map((m) => Number(m[1]));

    expect(radii).toHaveLength(2);
    expect(radii[1]).toBeGreaterThan(radii[0] ?? 0);
  });

  test("draws nothing for a cell with no ink", () => {
    // A zero-radius circle is still an element, and a few thousand of
    // them is a texture that takes seconds to rasterise.
    const svg = halftoneSvg(
      { width: 1, height: 1, values: Float32Array.from([0]) },
      { cell: 10, ink: "#f6f3ee" },
    );

    expect(svg).not.toContain("<circle");
  });
});

describe("sweepThreshold", () => {
  test("runs from the top-left corner to the bottom-right", () => {
    // The diagonal. If this ever became a column or a row sweep the
    // animation would read as a wipe, which is the thing it is not.
    const first = sweepThreshold(0, 0, 10, 10);
    const last = sweepThreshold(9, 9, 10, 10);

    expect(first).toBeLessThan(last);
  });

  test("breaks the front up instead of ruling a line", () => {
    // Cells on the same diagonal must not share a threshold, or the edge
    // arrives as a drawn line rather than as grain.
    const along = [
      sweepThreshold(0, 4, 10, 10),
      sweepThreshold(2, 2, 10, 10),
      sweepThreshold(4, 0, 10, 10),
    ];

    expect(new Set(along).size).toBe(3);
  });

  test("is deterministic, so the sweep never flickers", () => {
    expect(sweepThreshold(3, 7, 40, 40)).toBe(sweepThreshold(3, 7, 40, 40));
  });

  test("never lets a cell resolve before the sweep starts", () => {
    for (let x = 0; x < 20; x += 1) {
      for (let y = 0; y < 20; y += 1) {
        expect(sweepThreshold(x, y, 20, 20)).toBeGreaterThan(0);
      }
    }
  });
});

describe("charForLuma", () => {
  test("maps the ends of the range to the ends of the ramp", () => {
    expect(charForLuma(0)).toBe(" ");
    expect(charForLuma(1)).toBe("@");
  });

  test("clamps rather than returning undefined", () => {
    // `noUncheckedIndexedAccess` is on, and an out-of-range index here
    // would put the string "undefined" on the card.
    expect(charForLuma(-5)).toBe(" ");
    expect(charForLuma(99)).toBe("@");
    expect(charForLuma(Number.NaN)).toBe(" ");
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `bun test apps/web/lib/portrait/portrait.test.ts`
Expected: FAIL — `Cannot find module '@/lib/portrait/ascii'`

- [ ] **Step 3: Write `luminance.ts`**

```ts
/**
 * A picture as one number per cell.
 *
 * Both the halftone on the card and the ASCII in the sweep read from this,
 * so neither can disagree with the other about how bright a face is.
 */

export interface Grid {
  readonly width: number;
  readonly height: number;
  readonly values: Float32Array;
}

/** Rec. 709 luma. The green weight is why a green photo is not mud. */
export const lumaFromRgba = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Grid => {
  const values = new Float32Array(width * height);
  for (let i = 0; i < values.length; i += 1) {
    const o = i * 4;
    values[i] =
      (0.2126 * (data[o] ?? 0) +
        0.7152 * (data[o + 1] ?? 0) +
        0.0722 * (data[o + 2] ?? 0)) /
      255;
  }
  return { width, height, values };
};

/**
 * Stretch to the full range, then push contrast.
 *
 * A photograph's own histogram is far too flat to survive being quantised
 * to ten levels — without this the face arrives as one mid grey. The
 * guard on `span` is not decorative: a blank upload has no range at all
 * and would divide by zero.
 */
export const normalise = (values: Float32Array): Float32Array => {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value < lo) lo = value;
    if (value > hi) hi = value;
  }

  const span = hi - lo;
  const out = new Float32Array(values.length);
  if (!Number.isFinite(span) || span < 0.0001) {
    out.fill(0.5);
    return out;
  }

  for (let i = 0; i < values.length; i += 1) {
    const unit = ((values[i] ?? 0) - lo) / span;
    out[i] = Math.min(1, Math.max(0, (unit - 0.5) * 1.65 + 0.5));
  }
  return out;
};
```

- [ ] **Step 4: Write `halftone.ts`**

```ts
/**
 * The portrait as a field of dots.
 *
 * This is what goes on the card, and the reason is measured: the photo
 * window is 113px on screen, where a dot lands at about 1.15px and reads,
 * and a character lands at 1.38px and does not. A dot carries one value —
 * its radius — while a character needs its shape distinguished.
 */

import type { Grid } from "./luminance";

interface HalftoneOptions {
  /** The grid pitch in output pixels. */
  readonly cell: number;
  readonly ink: string;
}

/** Below this a dot is a rounding artefact, not a mark. */
const MIN_RADIUS = 0.3;

export const halftoneSvg = (
  grid: Grid,
  { cell, ink }: HalftoneOptions,
): string => {
  const parts: string[] = [];
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) {
      const radius = (grid.values[y * grid.width + x] ?? 0) * 0.52 * cell;
      if (radius <= MIN_RADIUS) {
        continue;
      }
      const cx = x * cell + cell / 2;
      const cy = y * cell + cell / 2;
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${radius.toFixed(2)}"/>`);
    }
  }

  const width = grid.width * cell;
  const height = grid.height * cell;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g fill="${ink}">${parts.join("")}</g></svg>`;
};
```

- [ ] **Step 5: Write `ascii.ts`**

```ts
/**
 * The portrait as characters, and when each one arrives.
 *
 * Only the sweep uses this. On the card the same grid would be 1.38px per
 * character, which reads as a rayed smear; played full width it is 6px
 * per character and reads as a face assembling itself.
 */

/**
 * Ten levels, darkest first, ordered by ink coverage rather than by ASCII
 * value. More levels do not read as more detail at this size — they read
 * as noise, because the eye cannot rank `+` against `*` at 10px.
 */
export const ASCII_RAMP = " .:-=+*#%@";

/** Tuned to IBM Plex Mono's advance at 12px, which is the page's face. */
export const CELL_WIDTH = 6;
export const CELL_HEIGHT = 10;

/** What a cell shows before it resolves. */
export const NOISE_CHARS = "░▒▓#@%&*+=-";

export const charForLuma = (luma: number): string => {
  const safe = Number.isFinite(luma) ? Math.min(1, Math.max(0, luma)) : 0;
  const index = Math.min(
    ASCII_RAMP.length - 1,
    Math.floor(safe * ASCII_RAMP.length),
  );
  return ASCII_RAMP[index] ?? " ";
};

/** A deterministic 0..1 per cell. Random would flicker between frames. */
const jitter = (x: number, y: number): number => {
  let hash = 0x811c9dc5 ^ x;
  hash = Math.imul(hash, 0x01000193) >>> 0;
  hash ^= y;
  hash = Math.imul(hash, 0x01000193) >>> 0;
  hash ^= hash >>> 13;
  return (hash % 1000) / 1000;
};

/**
 * When a cell stops being noise, as a fraction of the sweep.
 *
 * The distance along the diagonal sets the bulk of it and the cell's own
 * hash nudges the rest, so the front breaks up into grain instead of
 * arriving as a ruled line. Never returns zero: a cell that resolved at
 * t=0 would make the animation start half-built.
 */
export const sweepThreshold = (
  x: number,
  y: number,
  columns: number,
  rows: number,
): number => {
  const along = (x / Math.max(1, columns) + y / Math.max(1, rows)) / 2;
  return 0.02 + along * 0.8 + jitter(x, y) * 0.18;
};

export const noiseChar = (x: number, y: number): string =>
  NOISE_CHARS[Math.floor(jitter(x + 7919, y) * NOISE_CHARS.length)] ?? "#";
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `bun test apps/web/lib/portrait/portrait.test.ts`
Expected: PASS

- [ ] **Step 7: Gates and commit**

```bash
bun run check-types && bun run lint
git add apps/web/lib/portrait
git commit -m "feat(web): luminance, halftone and ascii as pure grids"
```

---

### Tarea 2: El recorte de fondo en el navegador

**Files:**
- Create: `apps/web/lib/portrait/cutout.ts`
- Create: `apps/web/lib/portrait/cutout.test.ts`
- Modify: `apps/web/package.json` (añadir `@mediapipe/tasks-vision`)
- Create: `apps/web/public/models/README.md`

**Interfaces:**
- Produces: `cutout(image: HTMLImageElement): Promise<Blob>` — PNG con
  fondo transparente.
- Produces: `CUTOUT_WIDTH = 720`

**Por qué MediaPipe y no un modelo de matting:** la rejilla del semitono
es de 5 px, así que el pelo suelto y el borde de una oreja los destruye el
propio tramado. No hace falta calidad de matting; hace falta una silueta
correcta. `selfie_segmenter.tflite` pesa unos 250 KB y es Apache-2.0.
RMBG da mejor resultado y **su licencia no es comercial** sin acuerdo — no
entra sin que alguien lo revise.

- [ ] **Step 1: Add the dependency and vendor the model**

```bash
bun add --cwd apps/web @mediapipe/tasks-vision
mkdir -p apps/web/public/models
curl -L -o apps/web/public/models/selfie_segmenter.tflite \
  https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite
cp node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm \
   node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_internal.js \
   apps/web/public/models/
```

Escribir `apps/web/public/models/README.md`:

```markdown
# Modelos servidos desde el propio dominio

`selfie_segmenter.tflite` y el runtime wasm de `@mediapipe/tasks-vision`,
copiados aquí a propósito en lugar de cargarse desde un CDN.

Dos razones. El runtime descarga estos ficheros en tiempo de ejecución, y
una CSP que restrinja `connect-src` —que es hacia donde va este proyecto—
cortaría un tercero sin dar error visible: el recorte simplemente dejaría
de ocurrir. Y la versión queda clavada junto al código que la usa, en vez
de moverse bajo nuestros pies.

Licencia: Apache-2.0. Al actualizar `@mediapipe/tasks-vision` hay que
volver a copiar el wasm, porque runtime y modelo se versionan juntos.
```

- [ ] **Step 2: Write the failing test**

El modelo no corre en Bun, así que la prueba fija lo que sí es
verificable sin navegador: el contrato del módulo y la regla que lo hace
seguro.

```ts
// apps/web/lib/portrait/cutout.test.ts
import { describe, expect, test } from "bun:test";

const source = async (): Promise<string> =>
  await Bun.file(new URL("./cutout.ts", import.meta.url)).text();

describe("cutout", () => {
  test("loads its model from this origin, never a CDN", async () => {
    // The runtime fetches the wasm and the weights at call time. From a
    // third party those requests are the first thing a tightened CSP
    // breaks, and they break silently — the cut-out just stops
    // happening and every portrait ships with its background.
    const module = await source();
    const remote = module.match(/https?:\/\/[^"'`\s]+/g) ?? [];

    expect(remote).toEqual([]);
    expect(module).toContain("/models/");
  });

  test("is the only module that reaches for MediaPipe", async () => {
    // One module owns the dependency, so replacing the segmenter is one
    // file rather than a search across the app.
    const { $ } = await import("bun");
    const hits =
      await $`grep -rl "tasks-vision" apps/web/lib apps/web/components apps/web/app`
        .nothrow()
        .text();
    const files = hits.split("\n").filter(Boolean);

    expect(files).toEqual(["apps/web/lib/portrait/cutout.ts"]);
  });

  test("never resolves to the original image on failure", async () => {
    // Returning the input when segmentation fails would put somebody's
    // kitchen on their credential without telling them. It has to throw
    // so the picker can say so.
    const module = await source();

    expect(module).toContain("CutoutError");
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `bun test apps/web/lib/portrait/cutout.test.ts`
Expected: FAIL — `cutout.ts` no existe

- [ ] **Step 4: Write `cutout.ts`**

```ts
"use client";

/**
 * The person, without their background.
 *
 * Runs once, when somebody picks a photo, rather than on every render:
 * the model is paid for once per participant, the result is something
 * they can look at and reject before it is stored, and the route that
 * draws the card stays a function of one stored PNG.
 *
 * MediaPipe's selfie segmenter rather than a matting network, and the
 * reason is the halftone: its grid is 5px, so strands of hair and the
 * edge of an ear are destroyed by the screen regardless. What is needed
 * is a correct silhouette, which this gives for 250KB and Apache-2.0.
 */

import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";

/** Wide enough that the 5px halftone grid never upscales. */
export const CUTOUT_WIDTH = 720;

export class CutoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CutoutError";
  }
}

let segmenter: ImageSegmenter | null = null;

/**
 * Loaded once and kept.
 *
 * Both files come from this origin. From a CDN they are the first thing a
 * tightened `connect-src` breaks, and it breaks without an error anybody
 * sees — the cut-out simply stops happening.
 */
const load = async (): Promise<ImageSegmenter> => {
  if (segmenter) {
    return segmenter;
  }
  const fileset = await FilesetResolver.forVisionTasks("/models");
  segmenter = await ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "/models/selfie_segmenter.tflite" },
    runningMode: "IMAGE",
    outputCategoryMask: true,
  });
  return segmenter;
};

export const cutout = async (image: HTMLImageElement): Promise<Blob> => {
  const model = await load();

  const height = Math.round((CUTOUT_WIDTH * image.height) / image.width);
  const canvas = document.createElement("canvas");
  canvas.width = CUTOUT_WIDTH;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new CutoutError("El navegador no dio un lienzo 2D");
  }
  context.drawImage(image, 0, 0, CUTOUT_WIDTH, height);

  const result = model.segment(canvas);
  const mask = result.categoryMask;
  if (!mask) {
    result.close();
    throw new CutoutError("El modelo no devolvió una máscara");
  }

  const coverage = mask.getAsUint8Array();
  const frame = context.getImageData(0, 0, CUTOUT_WIDTH, height);
  for (let i = 0; i < coverage.length; i += 1) {
    // The segmenter marks the person as a non-zero category. Anything
    // else is background and goes fully transparent — a partial alpha
    // there shows as a haze of faint dots around the head.
    frame.data[i * 4 + 3] = coverage[i] ? 255 : 0;
  }
  context.putImageData(frame, 0, 0);
  result.close();

  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new CutoutError("El lienzo no produjo un PNG"));
    }, "image/png");
  });
};
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `bun test apps/web/lib/portrait/cutout.test.ts`
Expected: PASS

- [ ] **Step 6: Gates and commit**

```bash
bun run check-types && bun run lint
git add apps/web/lib/portrait apps/web/public/models apps/web/package.json bun.lock
git commit -m "feat(web): cut the background out of a portrait in the browser"
```

---

### Tarea 3: El semitono en la cara del carnet

**Files:**
- Modify: `apps/web/lib/credential/card-texture.tsx`
- Modify: `apps/web/lib/credential/accepted.ts`
- Test: `apps/web/lib/credential/card-texture.test.ts` (crear)

**Interfaces:**
- Consumes: `halftoneSvg`, `lumaFromRgba`, `normalise` de la Tarea 1.
- Produces: `halftonePortrait(url: string | null): Promise<string | null>`
  — data URI, o `null` si no hay foto confirmada o si falla.

**El encuadre:** la ventana mide `PORTRAIT_WIDTH × PORTRAIT_HEIGHT`
(490 × 568 hoy, derivados del modelo glTF). El recorte se ajusta con
`fit: "cover"` y `position: "top"`, no centrado: un retrato pone la cara
en la mitad superior y un recorte centrado le corta la cabeza.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/lib/credential/card-texture.test.ts
import { describe, expect, test } from "bun:test";

import { halftonePortrait } from "@/lib/credential/card-texture";

describe("halftonePortrait", () => {
  test("answers null when nothing has been confirmed", async () => {
    // CONTEXT.md: available images are not used until the participant
    // confirms a source. No confirmation means initials, not a guess.
    expect(await halftonePortrait(null)).toBeNull();
  });

  test("answers null rather than throwing when the host is unreachable", async () => {
    // A credential with initials on it is a credential. One that 500s
    // because a picture host was slow is not.
    expect(
      await halftonePortrait("http://127.0.0.1:1/never.png"),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun test apps/web/lib/credential/card-texture.test.ts`
Expected: FAIL — `halftonePortrait` no se exporta

- [ ] **Step 3: Replace `pictureDataUri` with `halftonePortrait`**

En `apps/web/lib/credential/card-texture.tsx`, sustituir la función
`pictureDataUri` entera por:

```tsx
/**
 * The confirmed picture, screened into dots.
 *
 * Only ever the picture the participant confirmed: `CONTEXT.md` is
 * explicit that available images are not used until they choose a
 * source, so a card with nothing confirmed falls through to initials.
 *
 * Screened here rather than stored: the stored PNG is the cut-out, and
 * deriving the dots on each render means changing the grid does not
 * oblige anybody to regenerate anything.
 *
 * Every failure answers null. A credential with initials on it is a
 * credential; one that 500s because a picture host was slow is not.
 */
const PICTURE_TIMEOUT_MS = 2_500;

/** The grid pitch, at the size the window is sampled. */
const HALFTONE_CELL = 5;

export const halftonePortrait = async (
  url: string | null,
): Promise<string | null> => {
  if (!url) {
    return null;
  }
  try {
    const response = await fetch(url, {
      next: { revalidate },
      signal: AbortSignal.timeout(PICTURE_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    const type = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      ?.trim();
    if (!type?.startsWith("image/")) {
      return null;
    }

    const columns = Math.floor(PORTRAIT_WIDTH / HALFTONE_CELL);
    const rows = Math.floor(PORTRAIT_HEIGHT / HALFTONE_CELL);

    const { default: sharp } = await import("sharp");
    const source = Buffer.from(await response.arrayBuffer());
    // `top`, not centred: a portrait puts the face in the upper half and
    // a centre crop takes the head off.
    const { data, info } = await sharp(source)
      .resize(columns, rows, { fit: "cover", position: "top" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const grid = lumaFromRgba(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
    );
    const values = normalise(grid.values);
    // The cut-out's transparent background must not become bright dots:
    // alpha wins over luminance.
    for (let i = 0; i < values.length; i += 1) {
      if ((data[i * info.channels + 3] ?? 255) < 128) {
        values[i] = 0;
      }
    }

    const svg = halftoneSvg(
      { width: info.width, height: info.height, values },
      { cell: HALFTONE_CELL, ink: colors.ink },
    );
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
};
```

Añadir los imports al principio del fichero:

```tsx
import { halftoneSvg } from "@/lib/portrait/halftone";
import { lumaFromRgba, normalise } from "@/lib/portrait/luminance";
```

Y en `renderCardTexture`, cambiar la llamada:

```tsx
    halftonePortrait(credential.pictureUrl),
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `bun test apps/web/lib/credential`
Expected: PASS

- [ ] **Step 5: Look at it**

No es opcional. Este repo tiene un historial de funciones verdes en tests
y rotas en pantalla, porque las pruebas leen código fuente y no ven el
resultado.

```bash
bun dev
# En otra terminal, con una solicitud aceptada y sesión iniciada:
curl -s "http://localhost:3000/carnet/card-texture" -o /tmp/carnet.png
```

Abrir `/tmp/carnet.png` y comprobar: los puntos forman una cara, el fondo
del recorte es negro y no un campo de puntos tenues, y la cabeza no está
cortada por arriba.

- [ ] **Step 6: Gates and commit**

```bash
bun run check-types && bun run lint && bun test apps/web
git add apps/web/lib
git commit -m "feat(web): screen the confirmed picture into dots on the card"
```

---

### Tarea 4: El selector de foto

**Files:**
- Create: `apps/web/components/portrait/portrait-picker.tsx`
- Create: `apps/web/components/portrait/portrait-picker.test.ts`
- Modify: `apps/web/lib/credential/accepted.ts`

**Interfaces:**
- Consumes: `cutout`, `CutoutError` de la Tarea 2.
- Consumes: el endpoint existente `/api/v1/profile-picture`.
- Produces: `<PortraitPicker current={...} githubUrl={...} />`

**Lo que este selector NO hace:** no escribe columnas. Sube el recorte por
el endpoint que ya existe y confirma la fuente por el servicio que ya
existe, porque `pictureSource` es además campo de los datos de aceptación
y dos caminos que escriben lo mismo se pisan.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/components/portrait/portrait-picker.test.ts
import { describe, expect, test } from "bun:test";

const source = async (): Promise<string> =>
  await Bun.file(new URL("./portrait-picker.tsx", import.meta.url)).text();

describe("portrait-picker", () => {
  test("shows the cut-out before anything is stored", async () => {
    // Segmentation fails honestly on a busy background, and somebody has
    // to be able to see that and say no. A picker that uploaded first
    // would put a half-erased kitchen on a credential.
    const picker = await source();

    expect(picker).toContain("preview");
    expect(picker).toMatch(/confirm|Confirmar/);
  });

  test("writes through the service, never the columns", async () => {
    // `pictureSource` is also an acceptance-details field. Two paths
    // writing it is how one silently reverts the other.
    const picker = await source();

    expect(picker).not.toContain("@chofex/db");
    expect(picker).toContain("/api/v1/profile-picture");
  });

  test("says what went wrong when the cut-out fails", async () => {
    const picker = await source();

    expect(picker).toContain("CutoutError");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun test apps/web/components/portrait`
Expected: FAIL — el fichero no existe

- [ ] **Step 3: Write the picker**

Requisitos que el implementador tiene que cumplir, con el texto exacto:

- Dos orígenes: **"Usar mi foto de GitHub"** (visible sólo si
  `githubUrl` existe) y **"Subir una foto"**.
- Tras elegir, correr `cutout()` y pintar el resultado sobre el mismo
  `#141510` de la tarjeta, a 220 px de ancho. Encima, el rótulo
  **"Así quedará en tu carnet"**.
- Dos botones bajo la vista previa: **"Confirmar"** y **"Elegir otra"**.
- `CutoutError` muestra: **"No pudimos separar el fondo. Prueba con una
  foto de fondo liso."** y deja **"Elegir otra"** disponible.
- Mientras el modelo carga, el botón dice **"Recortando…"** y queda
  `disabled`.
- La subida usa `/api/v1/profile-picture` tal como lo hace hoy el resto
  del proyecto; la confirmación va contra la misma función de servicio que
  usa `/attendance`.
- Un solo texto por botón, por la convención del repositorio.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `bun test apps/web/components/portrait`
Expected: PASS

- [ ] **Step 5: Drive it in a browser**

```bash
bun dev
```

Con sesión de participante aceptado, en `/carnet`: subir una foto con
fondo liso y confirmar que la vista previa sale recortada; subir una con
fondo complicado y confirmar que el fallo se ve y no se guarda nada.

- [ ] **Step 6: Gates and commit**

```bash
bun run check-types && bun run lint && bun test apps/web
git add apps/web/components/portrait apps/web/lib/credential
git commit -m "feat(web): let a participant choose the face on their credential"
```

---

### Tarea 5: El barrido ASCII

**Files:**
- Create: `apps/web/components/portrait/portrait-sweep.tsx`
- Create: `apps/web/components/portrait/portrait-sweep.test.ts`
- Modify: `apps/web/app/carnet/page.tsx`
- Modify: `apps/web/components/credential/credential.css`

**Interfaces:**
- Consumes: `charForLuma`, `noiseChar`, `sweepThreshold`, `CELL_WIDTH`,
  `CELL_HEIGHT` de la Tarea 1.
- Produces: `<PortraitSweep src={string} onDone={() => void} />`

**Dónde vive:** capa propia sobre la escena, no la textura del carnet. La
textura es un PNG de satori y no puede animarse; el barrido es su propio
canvas y se retira al terminar, dejando ver el carnet colgado.

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/components/portrait/portrait-sweep.test.ts
import { describe, expect, test } from "bun:test";

const source = async (): Promise<string> =>
  await Bun.file(new URL("./portrait-sweep.tsx", import.meta.url)).text();

describe("portrait-sweep", () => {
  test("honours a request for reduced motion", async () => {
    // A diagonal wipe across the whole screen is exactly the kind of
    // motion that setting exists for.
    const sweep = await source();

    expect(sweep).toContain("prefers-reduced-motion");
  });

  test("always reports done, even without motion", async () => {
    // The scene underneath is revealed by `onDone`. A path that skips it
    // leaves the page stuck behind a static overlay.
    const sweep = await source();
    const calls = sweep.match(/onDone\(\)/g) ?? [];

    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  test("cancels its frame loop on unmount", async () => {
    // Navigating away mid-sweep otherwise leaves a loop drawing into a
    // detached canvas for as long as the tab lives.
    const sweep = await source();

    expect(sweep).toContain("cancelAnimationFrame");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun test apps/web/components/portrait/portrait-sweep.test.ts`
Expected: FAIL — el fichero no existe

- [ ] **Step 3: Write the sweep**

Requisitos exactos:

- `"use client"`. Un `<canvas>` a pantalla completa sobre la escena,
  `position: absolute; inset: 0`, con `--sheet` de fondo.
- Rejilla de `CELL_WIDTH × CELL_HEIGHT` sobre el tamaño del canvas.
- Duración **2200 ms**. Progreso lineal sobre `performance.now()`.
- Una celda con `progress >= sweepThreshold(...) + 0.06` dibuja
  `charForLuma`; entre el umbral y eso dibuja `noiseChar`; antes, nada.
- El alfa del recorte manda: donde es transparente no se dibuja carácter,
  igual que en el semitono.
- Al terminar, llamar `onDone()`. Con `prefers-reduced-motion: reduce`,
  llamar `onDone()` de inmediato sin animar.
- `cancelAnimationFrame` en la limpieza del efecto.
- La fuente es `--font-hta-mono`; esperar a `document.fonts.ready` antes
  del primer fotograma, porque la rejilla está calculada para un avance
  monoespaciado y una fuente proporcional la emborrona.

En `apps/web/app/carnet/page.tsx`, montar el barrido sobre
`CredentialScene` y retirarlo con `onDone`. En `credential.css`, la capa
lleva `z-index: 6` — por encima del canvas del cordón, que está en 4.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `bun test apps/web/components/portrait`
Expected: PASS

- [ ] **Step 5: Look at it, and at the seam**

```bash
bun dev
```

En `/carnet`: el barrido avanza en diagonal, no en columna; el frente se
deshace en grano y no es una línea; al terminar aparece el carnet colgado
sin salto. Con "reducir movimiento" activado en el sistema, la página
abre directamente en el carnet.

- [ ] **Step 6: Gates and commit**

```bash
bun run check-types && bun run lint && bun test apps/web
git add apps/web/components/portrait apps/web/app/carnet apps/web/components/credential/credential.css
git commit -m "feat(web): assemble the credential from an ascii sweep"
```

---

### Tarea 6: La puerta verde

**Files:**
- Modify: `apps/web/components/credential/credential-card.test.ts`

- [ ] **Step 1: Extend the picture invariant to the new path**

El test `shows no picture the participant did not confirm` vigila hoy
`credential-portrait.tsx`. Extenderlo a la textura, que es donde ahora se
dibuja el semitono:

```ts
  test("screens only the confirmed picture onto the card", async () => {
    // Same rule as the static card, now that a second surface draws a
    // face: CONTEXT.md forbids using an available image before the
    // participant picks a source.
    const texture = await Bun.file(
      new URL("../../lib/credential/card-texture.tsx", import.meta.url),
    ).text();

    expect(texture).toContain("credential.pictureUrl");
    expect(texture).not.toContain("clerkPictureUrl");
    expect(texture).not.toContain("githubAvatarUrl");
  });
```

- [ ] **Step 2: Run everything**

```bash
bun test apps/web && bun run check-types && bun run lint
```

Esperado: verde, salvo `apps/web/lib/challenges/sandbox.test.ts`, que
falla con node 20 porque el sandbox lanza `node --permission`. Necesita
`nvm use 24`, y no es de esta rama.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/credential/credential-card.test.ts
git commit -m "test(web): hold the confirmed-picture rule on both surfaces"
```

---

## Lo que este plan deja fuera, a propósito

- **El formulario completo de datos de aceptación.** `pictureSource` es
  uno de sus campos y no existe su UI, pero construirla entera es otro
  proyecto. Este plan añade sólo el paso de la foto.
- **La imagen para compartir de `/carnet`.** No existe hoy y no la crea
  esto.
- **El otro pipeline de carnets** (`lib/badges/`, `participant_badges`,
  Trigger.dev) sigue generando imágenes por su cuenta. Los dos conviven
  sin saber el uno del otro, y hay que decidir si uno reemplaza al otro.
- **Un modelo de matting de más calidad.** MediaPipe basta porque la
  rejilla de 5 px tira el detalle fino igualmente. Si el semitono se
  afinara, habría que revisar la elección — y la licencia de RMBG.
