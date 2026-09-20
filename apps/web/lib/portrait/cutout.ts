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
 * is a correct silhouette, which this gives for 244KB of weights under
 * Apache-2.0. The matting networks that beat it — RMBG in particular —
 * are not licensed for commercial use without an agreement.
 */

/** Wide enough that the card's 5px halftone grid never upscales. */
export const CUTOUT_WIDTH = 720;

export class CutoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CutoutError";
  }
}

/**
 * The loaded segmenter, kept between calls.
 *
 * Typed loosely because the package is only reachable through the dynamic
 * import below, and importing its types statically would defeat that.
 */
// biome-ignore lint/suspicious/noExplicitAny: the package is loaded lazily
let segmenter: any = null;

/**
 * Loaded on first use, never at module scope.
 *
 * `@mediapipe/tasks-vision` unpacks to 35 MB. A static import puts its
 * wrapper in the bundle of everybody who opens the credential, including
 * everybody who never touches a photograph.
 *
 * Both the runtime and the weights come from this origin, copied there at
 * build time by `scripts/vendor-vision.mjs`. From a CDN they are the
 * first thing a tightened `connect-src` breaks, and it breaks without an
 * error anybody sees: the cut-out simply stops happening.
 */
const load = async () => {
  if (segmenter) {
    return segmenter;
  }

  const { FilesetResolver, ImageSegmenter } = await import(
    "@mediapipe/tasks-vision"
  );
  const fileset = await FilesetResolver.forVisionTasks("/vision");
  segmenter = await ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "/vision/selfie_segmenter.tflite" },
    runningMode: "IMAGE",
    outputCategoryMask: true,
  });
  return segmenter;
};

/**
 * A portrait with its background made transparent.
 *
 * Throws rather than returning the original on failure. Handing back the
 * untouched photograph would put somebody's kitchen on their credential
 * without telling them, and the caller could not tell the two apart.
 */
export const cutout = async (image: HTMLImageElement): Promise<Blob> => {
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new CutoutError("La imagen no terminó de cargar");
  }

  const model = await load();

  const height = Math.round(
    (CUTOUT_WIDTH * image.naturalHeight) / image.naturalWidth,
  );
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

  const coverage: Uint8Array = mask.getAsUint8Array();
  const frame = context.getImageData(0, 0, CUTOUT_WIDTH, height);
  for (let i = 0; i < coverage.length; i += 1) {
    // The segmenter marks the person with a non-zero category. Anything
    // else goes fully transparent — a partial alpha there shows on the
    // card as a haze of faint dots around the head.
    frame.data[i * 4 + 3] = coverage[i] ? 255 : 0;
  }
  context.putImageData(frame, 0, 0);
  result.close();

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new CutoutError("El lienzo no produjo un PNG"));
    }, "image/png");
  });
};
