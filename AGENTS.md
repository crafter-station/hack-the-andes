# Repository map

- This is a Bun 1.3.14/Turbo monorepo; keep `bun.lock` as the only lockfile. Root tooling requires Node 24+, although the published CLI supports Node 20+.
- `apps/web` is the Next.js participant site, admin UI, `/api/v1` API, and Trigger.dev task host. `apps/docs` is a separate Next.js app on port 3001. `apps/cli/src/index.ts` is the published `chofex` executable.
- `packages/registration-contract` and `packages/challenges-contract` are the shared schemas between the CLI and web API. Change wire formats there rather than duplicating types in an app. `packages/db/src/schema` owns the Drizzle schema; `packages/ui` owns shared UI primitives.
- Read `CONTEXT.md` before changing participant/application lifecycle semantics. It defines distinctions such as participant vs. application and active vs. historical applications.
- For either Next.js app, consult the installed Next 16 guides under that app's `node_modules/next/dist/docs/`; training-memory APIs may be stale. Preserve the generated instructions in `apps/web/AGENTS.md`.

# Commands

```sh
bun install --frozen-lockfile
bun dev                                      # Turbo dev; web :3000, docs :3001
bun run --filter chofex-cli dev -- status    # run the source CLI with arguments
bun --filter @chofex/web trigger:dev         # Trigger tasks; not started by bun dev

bun test                                     # all Bun tests; there is no root test script
bun test apps/web/lib/auth.test.ts            # one test file
bun --filter chofex-cli test test/config.test.ts # package-relative focused test
bun run lint
bun run format
bun run check-types                          # runs next typegen before Next.js tsc
DATABASE_URL=postgresql://user:pass@localhost:5432/db bun run build
```

- Use `bun --filter <package> <script>` for package-scoped work.
- After editing `packages/db/src/schema`, run `bun --filter @chofex/db db:generate`; generated migrations live in `packages/db/drizzle`. `db:generate`, `db:migrate`, and `db:studio` require `DATABASE_URL`.
- The pre-commit hook runs `bunx --bun @biomejs/biome check --write` across the repository, including import organization. Run it on changed paths first when you need to avoid unrelated hook-time edits.
- GitHub Actions publishes the CLI and the production web image; it is not general CI. Run tests, lint, and type checks locally. The CLI publisher derives `0.1.<run_number>` from the approved default-branch tip; it does not require a manual package-version bump.

# Behavioral constraints

- Keep CLI JSON mode machine-safe: stdout is exactly one versioned envelope; prompts and diagnostics go to the terminal or stderr, and the welcome screen is omitted.
- Reserve ternaries for short, obvious two-way value selection that fits on one line. Use named variables, `if`/`else`, or focused helpers for multiline conditions and conditional object or array construction.
- Route slugs, directories and identifiers are in English and consistent
  across the app; user-facing copy is in Spanish. The two are separate
  decisions. A route named in one language with its component in the
  other means neither search finds the whole feature. When renaming a
  route, move every reference with it — a QR target or a redirect left
  behind is a silent 404.
- Buttons use one line of text. Put subtitles, status, or explanatory context beside the button rather than inside it.
