import { BrandKicker, brandFrameClassName } from "@chofex/ui/components/brand";

import { ShellCommand } from "@/components/shell-command";

const workflow = [
  {
    title: "Crea el repositorio",
    command: "chofex challenge init --challenge broken-agent",
    body: "La CLI crea broken-agent/ con el contrato, la implementación del agente y cuatro tests públicos.",
  },
  {
    title: "Confirma el punto de partida",
    command: "cd broken-agent && npm test",
    body: "Everything passes. Ese es el problema: los happy paths no demuestran que el scheduler sea seguro en producción.",
  },
  {
    title: "Audita y repara",
    command: "$EDITOR scheduler.js",
    body: "Mantén createScheduler y razona sobre concurrencia, persistencia, leases de 30 segundos, reintentos, cancelación e idempotencia.",
  },
  {
    title: "Protege el comportamiento visible",
    command:
      "chofex challenge test --challenge broken-agent --source ./scheduler.js",
    body: "Los tests públicos son ilimitados. No uses una evaluación oficial mientras tengas regresiones visibles.",
  },
  {
    title: "Solicita un veredicto oculto",
    command:
      "chofex challenge evaluate --challenge broken-agent --source ./scheduler.js",
    body: "Recibirás puntajes por capacidad, pero no los nombres de los casos ocultos. Tienes 5 evaluaciones oficiales.",
  },
] as const;

export function BrokenAgentChallengeGuide() {
  return (
    <div className="mt-14 space-y-14">
      <section aria-labelledby="broken-agent-brief-heading">
        <BrandKicker className="mb-3 text-[var(--hud-status)]">
          Challenge de clasificación / AI permitida
        </BrandKicker>
        <h2
          className="font-display text-4xl leading-none uppercase sm:text-5xl"
          id="broken-agent-brief-heading"
        >
          El agente dijo que terminó
        </h2>
        <p className="mt-5 max-w-3xl text-lg leading-relaxed text-[var(--hud-ink)]/75">
          Recibes un job scheduler generado por un agente de código. La API está
          implementada y todos los tests públicos pasan. Tu trabajo es convertir
          una solución plausible en software que realmente enviarías a
          producción.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--hud-muted)]">
          El contrato es público; los escenarios adversos son ocultos. El
          executor aplica efectos idempotentemente por job ID, así que el
          sistema puede recuperarse sin prometer exactamente-once para efectos
          arbitrarios. Puedes usar Claude Code, Codex, Cursor o cualquier otra
          AI.
        </p>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[var(--hud-muted)]">
          Puntaje: comportamiento base 10, persistencia 15, concurrencia 20,
          recuperación 20, idempotencia 15, seguridad contra regresiones 15 y
          rendimiento 5. Los empates se resuelven por menos evaluaciones
          oficiales, runtime y, al final, hora de envío.
        </p>

        <dl className="mt-8 grid gap-px bg-[var(--hud-ink)]/10 sm:grid-cols-3">
          <div className="bg-[var(--hud-card)] p-5">
            <dt>
              <BrandKicker className="text-[var(--hud-muted)]">
                Inicio
              </BrandKicker>
            </dt>
            <dd className="mt-2 font-display text-3xl uppercase">
              4/4 tests verdes
            </dd>
          </div>
          <div className="bg-[var(--hud-card)] p-5">
            <dt>
              <BrandKicker className="text-[var(--hud-muted)]">
                Hidden score
              </BrandKicker>
            </dt>
            <dd className="mt-2 font-display text-3xl uppercase">100 puntos</dd>
          </div>
          <div className="bg-[var(--hud-card)] p-5">
            <dt>
              <BrandKicker className="text-[var(--hud-muted)]">
                Intentos
              </BrandKicker>
            </dt>
            <dd className="mt-2 font-display text-3xl uppercase">
              5 evaluaciones oficiales
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="broken-agent-instructions-heading">
        <BrandKicker className="mb-3 text-[var(--hud-kicker)]">
          Field guide
        </BrandKicker>
        <h2
          className="font-display text-4xl leading-none uppercase sm:text-5xl"
          id="broken-agent-instructions-heading"
        >
          Cómo participar
        </h2>
        <ol className="mt-8 grid gap-4">
          {workflow.map((item, index) => (
            <li
              className={`grid gap-5 p-5 sm:grid-cols-[3rem_minmax(0,1fr)] sm:p-6 ${brandFrameClassName}`}
              key={item.title}
            >
              <span className="font-mono text-[var(--hud-action)]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold">{item.title}</h3>
                <pre className="brand-code mt-3 overflow-x-auto border p-4 text-sm">
                  <ShellCommand command={item.command} />
                </pre>
                <p className="mt-3 text-sm leading-relaxed text-[var(--hud-muted)]">
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
