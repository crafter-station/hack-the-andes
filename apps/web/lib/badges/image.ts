/**
 * Escaping for the places a name reaches XML.
 *
 * What was here besides — a bone sheet with a blue band, drawn as an SVG
 * string and rasterised — is gone: the shared badge is rendered from the
 * credential's own pieces in `share-image`, so there is one printing of
 * the card rather than two.
 */
export const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
