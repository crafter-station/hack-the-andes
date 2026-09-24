/**
 * The event's own range, standing still behind the credential.
 *
 * The hero draws this live — a Draco GLB, R3F and a gradient shader. This
 * page already spends a WebGL context on the card and its rope, and
 * running the valley behind it would be two scenes competing for one
 * frame budget on the page somebody opens to look at one object.
 *
 * So it is the drawing, held down and dimmed until it is ground rather
 * than subject. The drawing and not a still of the hero: that still has
 * the wordmark, the apply button and the sponsor row baked into it, so
 * using it meant cropping around furniture — and the first crop kept the
 * sponsors, which ghosted through the card at half height. The line art
 * carries none of that, stays sharp at any size, and is the same drawing
 * printed on the back of the card. The page's ground and what the card
 * wears become one thing.
 *
 * A plain `img` and not `next/image`: one decorative drawing at one size,
 * where a srcset of 640–3840w variants is bytes spent on the wrong thing.
 */

export const CREDENTIAL_GROUND = {
  src: "/credential/ridge.png",
  width: 900,
  height: 900,
} as const;

export function CredentialGround() {
  return (
    <div aria-hidden="true" className="credential-ground">
      {/* biome-ignore lint/performance/noImgElement: one decorative drawing; avoid a srcset for ground */}
      <img
        alt=""
        decoding="async"
        height={CREDENTIAL_GROUND.height}
        src={CREDENTIAL_GROUND.src}
        width={CREDENTIAL_GROUND.width}
      />
    </div>
  );
}
