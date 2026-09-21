/**
 * The generated badge image, where somebody can always find it.
 *
 * The pipeline emails a link when the job finishes, and an email is a
 * place things get lost. This is the same image on the page the
 * participant can always reach, so losing the message stops meaning
 * losing the badge.
 *
 * A server component with no state of its own: the job's status is read
 * when the page renders, and the page is `force-dynamic`, so a reload is
 * the refresh. Polling for a job that takes seconds and runs once would
 * be machinery for a case nobody waits through twice.
 */

import type { BadgeImage } from "@/lib/credential/accepted";

interface BadgeDownloadProps {
  readonly badge: BadgeImage | null;
  /** Names the file somebody saves, so it is not `badge.png` in a pile. */
  readonly participantName: string;
}

/** What each stage of the job says, in the one place it is read. */
const STATUS_COPY: Record<BadgeImage["status"], string> = {
  pending: "Estamos preparando tu carnet para compartir.",
  running: "Estamos preparando tu carnet para compartir.",
  completed: "Tu carnet para compartir está listo.",
  failed: "No pudimos preparar tu carnet para compartir. Escríbenos.",
};

/** `Nombre Apellido` becomes `nombre-apellido`, for a sane filename. */
const fileNameFor = (name: string): string => {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `carnet-${slug || "hack-the-andes"}.png`;
};

export function BadgeDownload({ badge, participantName }: BadgeDownloadProps) {
  // Nothing was ever queued for this participant, so there is nothing to
  // say. An empty panel explaining its own emptiness is worse than no
  // panel.
  if (!badge) {
    return null;
  }

  let image = null;
  if (badge.status === "completed" && badge.url) {
    image = (
      <>
        {/* biome-ignore lint/performance/noImgElement: a blob URL outside next's loader */}
        <img
          alt={`Carnet de ${participantName} para compartir`}
          className="badge-download-image"
          src={badge.url}
        />
        <a
          className="badge-download-link"
          download={fileNameFor(participantName)}
          href={badge.url}
        >
          Descargar
        </a>
      </>
    );
  }

  return (
    <section className="badge-download">
      <p className="badge-download-status">{STATUS_COPY[badge.status]}</p>
      {image}
    </section>
  );
}
