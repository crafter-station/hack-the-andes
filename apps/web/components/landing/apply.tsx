import {
  BrandContainer,
  BrandKicker,
  BrandSectionHeader,
  brandFrameClassName,
  brandSectionClassName,
} from "@chofex/ui/components/brand";
import { TerminalIcon } from "lucide-react";
import { CopyAgentPrompt } from "@/components/copy-agent-prompt";
import { CliInstallTabs } from "@/components/landing/cli-install-tabs";
import {
  applyCopy,
  cliInstallMethods,
  cliNextCommands,
} from "@/components/landing/content";

export function LandingApply() {
  return (
    <section
      aria-labelledby="apply-heading"
      className="bg-[var(--hud-card)] text-[var(--hud-ink)]"
      id="apply"
    >
      <BrandContainer className={brandSectionClassName}>
        <BrandSectionHeader title={applyCopy.title} titleId="apply-heading">
          <div className="max-w-xl">
            <p className="text-lg leading-relaxed text-[var(--hud-ink)]/75">
              {applyCopy.lede}
            </p>
            <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-[var(--hud-ink)]/15 border-y py-3">
              <BrandKicker className="text-[var(--hud-muted)]">
                {applyCopy.deadlineLabel}
              </BrandKicker>
              <p className="font-display text-2xl leading-none uppercase">
                {applyCopy.deadline}
              </p>
            </div>
            <div className="mt-7 border border-[var(--hud-action)]/35 bg-[var(--hud-action)]/5 p-5">
              <BrandKicker className="mb-3 text-[var(--hud-action)]">
                {applyCopy.travelTitle}
              </BrandKicker>
              <p className="text-sm leading-relaxed text-[var(--hud-ink)]/75 sm:text-base">
                {applyCopy.travelSupport}
              </p>
            </div>
            <div className="mt-7 border-[var(--hud-ink)]/15 border-t pt-5">
              <BrandKicker className="mb-4 text-[var(--hud-muted)]">
                {applyCopy.criteriaTitle}
              </BrandKicker>
              <ul className="space-y-3">
                {applyCopy.criteria.map((criterion) => (
                  <li
                    className="grid grid-cols-[1rem_1fr] gap-3 text-sm leading-relaxed text-[var(--hud-muted)]"
                    key={criterion}
                  >
                    <span
                      aria-hidden="true"
                      className="text-[var(--hud-action)]"
                    >
                      +
                    </span>
                    {criterion}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </BrandSectionHeader>

        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <article className={`p-6 ${brandFrameClassName}`}>
            <div className="mb-8 flex items-center justify-between">
              <BrandKicker className="text-[var(--hud-muted)]">01</BrandKicker>
              <TerminalIcon
                aria-hidden="true"
                className="size-5 text-[var(--hud-muted)]"
              />
            </div>
            <h3 className="font-display text-3xl leading-none uppercase">
              {applyCopy.cliTitle}
            </h3>
            <CliInstallTabs
              methods={cliInstallMethods}
              nextCommands={cliNextCommands}
            />
          </article>

          <article className={`p-6 ${brandFrameClassName}`}>
            <div className="mb-8 flex items-center justify-between">
              <BrandKicker className="text-[var(--hud-muted)]">02</BrandKicker>
              <BrandKicker className="text-[var(--hud-muted)]">
                {applyCopy.agentKicker}
              </BrandKicker>
            </div>
            <h3 className="font-display text-3xl leading-none uppercase">
              {applyCopy.agentTitle}
            </h3>
            <CopyAgentPrompt />
          </article>
        </div>
      </BrandContainer>
    </section>
  );
}
