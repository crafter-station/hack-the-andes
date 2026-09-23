"use client";

import { cn } from "@chofex/ui/lib/utils";
import { type KeyboardEvent, useState } from "react";
import { ShellCommand } from "@/components/shell-command";

type InstallMethod = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly hint?: string;
  readonly command: string;
};

function CliCommandRow({
  command,
  index,
  last = false,
}: {
  readonly command: string;
  readonly index: number;
  readonly last?: boolean;
}) {
  return (
    <li
      className={cn(
        "grid grid-cols-[2rem_minmax(0,1fr)] p-4",
        !last && "border-white/10 border-b",
      )}
    >
      <span className="text-[var(--code-muted)]">
        {String(index).padStart(2, "0")}
      </span>
      <ShellCommand
        className="min-w-0 break-words whitespace-normal sm:overflow-x-auto sm:whitespace-nowrap"
        command={command}
        prompt
      />
    </li>
  );
}

export function CliInstallTabs({
  methods,
  nextCommands,
}: {
  readonly methods: ReadonlyArray<InstallMethod>;
  readonly nextCommands: ReadonlyArray<string>;
}) {
  const [activeMethodId, setActiveMethodId] = useState(methods[0]?.id ?? "");

  const selectTab = (index: number) => {
    const method = methods[index];
    if (!method) return;
    setActiveMethodId(method.id);
    document.getElementById(`install-tab-${method.id}`)?.focus();
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % methods.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + methods.length) % methods.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = methods.length - 1;
    if (nextIndex === undefined) return;
    event.preventDefault();
    selectTab(nextIndex);
  };

  return (
    <div className="mt-6">
      <div
        aria-label="Método de instalación"
        className="grid grid-cols-2 border border-[var(--hud-ink)]/20"
        role="tablist"
      >
        {methods.map((method, index) => {
          const active = method.id === activeMethodId;
          let stateClassName =
            "text-[var(--hud-muted)] hover:bg-[var(--hud-ink)]/5";
          if (active) {
            stateClassName = "bg-[var(--hud-action)] text-[var(--hud-paper)]";
          }
          return (
            <button
              aria-controls={`install-panel-${method.id}`}
              aria-selected={active}
              className={cn(
                "min-h-11 border-[var(--hud-ink)]/20 px-4 font-mono text-xs uppercase tracking-[0.12em] outline-none transition-colors first:border-r focus-visible:ring-2 focus-visible:ring-[var(--hud-action)]/60 focus-visible:ring-inset",
                stateClassName,
              )}
              id={`install-tab-${method.id}`}
              key={method.id}
              onClick={() => setActiveMethodId(method.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              role="tab"
              tabIndex={active ? 0 : -1}
              type="button"
            >
              {method.label}
            </button>
          );
        })}
      </div>

      <div className="brand-code overflow-hidden border border-[var(--hud-ink)]/20 border-t-0 font-mono text-sm">
        {methods.map((method) => {
          const active = method.id === activeMethodId;
          return (
            <div
              aria-labelledby={`install-tab-${method.id}`}
              hidden={!active}
              id={`install-panel-${method.id}`}
              key={method.id}
              role="tabpanel"
            >
              <div className="border-white/10 border-b px-4 py-3 text-[var(--code-muted)] text-xs">
                <span>{method.description}</span>
                {method.hint && (
                  <span className="ml-2 text-[var(--code-muted)]/75">
                    {method.hint}
                  </span>
                )}
              </div>
              <ol>
                <CliCommandRow command={method.command} index={1} />
              </ol>
            </div>
          );
        })}

        <ol start={2}>
          {nextCommands.map((command, index) => (
            <CliCommandRow
              command={command}
              index={index + 2}
              key={command}
              last={index === nextCommands.length - 1}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}
