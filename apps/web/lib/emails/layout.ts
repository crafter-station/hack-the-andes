/**
 * The house style for what the event sends people: the credential itself.
 *
 * There were three email builders and three sets of markup, which is how
 * the same event came to write to one person in two languages and two
 * palettes. This is the shell all of them can be built from, and it is
 * laid out as the card is — a printed sheet with a hairline edge, the
 * wordmark set small at its head with a stamp beside it, and the drawn
 * range standing at its foot.
 *
 * The drawing rather than a photograph of one, deliberately. The hero's
 * still has the wordmark, the apply button and the sponsor row baked into
 * it, so using it means cropping around furniture; the line art carries
 * none of that, stays sharp at any size, and is the same drawing printed
 * on the back of the card. What the email shows and what the card wears
 * become one thing.
 *
 * Email is not the web. Tables, inline styles, no custom faces — a client
 * that will not load Stack Sans Notch is most of them, so the type is a
 * system stack and the brand is carried by the drawing and the colour
 * instead. Pictures go on real `img` elements rather than CSS
 * backgrounds, because Outlook needs VML for the latter and drops it.
 */

import { brandColors, brandColorWithAlpha } from "@chofex/ui/lib/brand-theme";

const dark = brandColors.dark;

export const emailPalette = {
  page: dark.paper,
  /** The printed sheet, which is the credential's tone and not a brand one. */
  sheet: "#141510",
  /** The line around it, at the weight the card's photo window is drawn. */
  edge: "#6d6d68",
  hairline: brandColorWithAlpha(dark.ink, 0.12),
  ink: dark.ink,
  muted: dark.muted,
  action: dark.action,
} as const;

/**
 * Where the images live.
 *
 * Absolute, and on the canonical host: a mail client has no page to
 * resolve a relative path against, and one pointing at a preview
 * deployment breaks the moment that deployment is torn down.
 */
const ASSET_ORIGIN = "https://hacktheandes.com";
export const RIDGE_BAND = `${ASSET_ORIGIN}/email/ridge-band.png`;

const SANS = "Arial,Helvetica,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

export const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const row = (content: string, padding: string): string =>
  `<tr><td style="padding:${padding}">${content}</td></tr>`;

/** The eyebrow over a heading, in the one colour the page accents with. */
export const eyebrow = (text: string): string =>
  row(
    `<p style="margin:0;color:${emailPalette.action};font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:.2em">${escapeHtml(text)}</p>`,
    "30px 38px 12px",
  );

export const heading = (text: string): string =>
  row(
    `<h1 style="margin:0;color:${emailPalette.ink};font-family:${SANS};font-size:38px;line-height:1.02;letter-spacing:-.025em;text-transform:uppercase">${escapeHtml(text)}</h1>`,
    "0 38px 18px",
  );

export const paragraph = (text: string): string =>
  row(
    `<p style="margin:0;color:${emailPalette.muted};font-family:${SANS};font-size:16px;line-height:1.65">${escapeHtml(text)}</p>`,
    "0 38px 16px",
  );

/**
 * A picture, framed the way the card frames its own.
 *
 * `display:block` because a client that treats it as inline leaves a gap
 * under it where the baseline would be, which on a dark sheet reads as a
 * seam.
 */
export const picture = (src: string, alt: string): string =>
  row(
    `<img alt="${escapeHtml(alt)}" src="${escapeHtml(src)}" width="524" style="display:block;width:100%;max-width:524px;height:auto;border:1px solid ${emailPalette.edge}" />`,
    "8px 38px 24px",
  );

export const button = (label: string, url: string): string =>
  row(
    `<a href="${escapeHtml(url)}" style="display:inline-block;background:${emailPalette.action};color:${emailPalette.page};font-family:${SANS};font-size:15px;font-weight:700;text-decoration:none;padding:14px 24px">${escapeHtml(label)}</a>`,
    "6px 38px 22px",
  );

export const command = (label: string, text: string): string =>
  row(
    `<p style="margin:0 0 8px;color:${emailPalette.muted};font-family:${SANS};font-size:12px;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(label)}</p><p style="margin:0;border:1px solid ${emailPalette.hairline};color:${emailPalette.ink};font-family:${MONO};font-size:14px;padding:13px 15px"><span style="color:${emailPalette.action}">$</span>&nbsp;${escapeHtml(text)}</p>`,
    "0 38px 26px",
  );

/** A quoted aside, such as a note the review team wrote. */
export const note = (label: string, text: string): string =>
  row(
    `<div style="border-left:3px solid ${emailPalette.action};padding:2px 0 2px 18px"><p style="margin:0 0 6px;color:${emailPalette.muted};font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">${escapeHtml(label)}</p><p style="margin:0;color:${emailPalette.ink};font-family:${SANS};font-size:16px;line-height:1.6;white-space:pre-wrap">${escapeHtml(text)}</p></div>`,
    "0 38px 26px",
  );

export interface EmailShellInput {
  readonly subject: string;
  /** The line a client shows beside the subject before anything is opened. */
  readonly preheader: string;
  /**
   * What sits opposite the wordmark, the way a card carries its number.
   * The event's dates when there is nothing more specific to stamp.
   */
  readonly stamp: string;
  readonly blocks: ReadonlyArray<string>;
  /**
   * Whether the range stands at the foot.
   *
   * Off when the body already carries a picture that has one, because the
   * credential's own drawing appearing twice in a column reads as a
   * repeated asset rather than as a motif.
   */
  readonly ridge?: boolean;
}

export const emailShell = ({
  subject,
  preheader,
  stamp,
  blocks,
  ridge = true,
}: EmailShellInput): string => {
  const foot = ridge
    ? `<tr><td style="padding:0;font-size:0;line-height:0"><img alt="" src="${RIDGE_BAND}" width="600" style="display:block;width:100%;height:auto;border:0" /></td></tr>`
    : `<tr><td style="padding:0 38px 34px"></td></tr>`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:${emailPalette.page};padding:0"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${emailPalette.page}"><tr><td align="center" style="padding:36px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:${emailPalette.sheet};border:1px solid ${emailPalette.edge}">
<tr><td style="padding:26px 38px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="color:${emailPalette.ink};font-family:${SANS};font-size:13px;font-weight:700;letter-spacing:.18em">▲&nbsp;&nbsp;HACK THE ANDES</td><td align="right" style="color:${emailPalette.muted};font-family:${MONO};font-size:13px;letter-spacing:.1em">${escapeHtml(stamp)}</td></tr></table></td></tr>
<tr><td style="padding:22px 38px 0"><div style="height:1px;background:${emailPalette.hairline};font-size:0;line-height:0">&nbsp;</div></td></tr>
${blocks.join("")}
${foot}
</table><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px"><tr><td style="padding:16px 4px 0;color:${emailPalette.muted};font-family:${SANS};font-size:12px;line-height:1.6">Nos vemos en la cima. — El equipo de Hack the Andes</td></tr></table></td></tr></table></body></html>`;
};
