import { resolve4 } from "node:dns/promises";
import { homedir } from "node:os";
import path from "node:path";

import {
  environmentVariableNames,
  parseEnvironment,
  selectedEnvironment,
  serializeEnvironment,
} from "./deploy-environment";

type Command = "apply" | "plan" | "status";

interface ApplicationManifest {
  project: string;
  projectDescription: string;
  name: string;
  appName: string;
  githubRepository: string;
  imageRepository: string;
  privateImage: boolean;
  domain: string;
  port: number;
  healthPath: string;
  environmentVariables: string[];
  optionalEnvironmentVariables: string[];
  serviceEnvironmentVariables?: Record<string, string>;
}

interface Manifest {
  version: number;
  serverUrl: string;
  environment: string;
  applications: ApplicationManifest[];
}

interface DokployApplication {
  applicationId: string;
  name: string;
  appName: string;
  applicationStatus?: string;
  dockerImage?: string | null;
  sourceType?: string;
}

interface DokployEnvironment {
  environmentId: string;
  name: string;
  applications?: DokployApplication[];
}

interface DokployProject {
  projectId: string;
  name: string;
  environments?: DokployEnvironment[];
}

interface DokployDomain {
  domainId: string;
  host: string;
  https?: boolean;
  port?: number | null;
  certificateType?: string;
}

interface AuthConfig {
  apiKey: string;
  domain: string;
}

const root = path.resolve(import.meta.dir, "..");
const manifestPath = path.join(root, "deploy/dokploy.json");
const localEnvironmentPaths = [path.join(root, ".env.production.local")];

const readJson = async <T>(filePath: string): Promise<T> =>
  (await Bun.file(filePath).json()) as T;

const normalizeUrl = (value: string): string => value.replace(/\/+$/, "");

const loadEnvironment = async (): Promise<Record<string, string>> => {
  const result: Record<string, string> = {};
  for (const filePath of localEnvironmentPaths) {
    const file = Bun.file(filePath);
    if (await file.exists())
      Object.assign(result, parseEnvironment(await file.text()));
  }
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined) result[name] = value;
  }
  return result;
};

const loadAuth = async (
  environment: Record<string, string>,
): Promise<AuthConfig> => {
  if (environment.DOKPLOY_URL && environment.DOKPLOY_API_KEY) {
    return {
      domain: environment.DOKPLOY_URL,
      apiKey: environment.DOKPLOY_API_KEY,
    };
  }
  const configPath = path.join(homedir(), ".vps/config.json");
  const configFile = Bun.file(configPath);
  if (!(await configFile.exists())) {
    throw new Error(
      `Dokploy credentials are missing. Set DOKPLOY_URL and DOKPLOY_API_KEY or create ${configPath}.`,
    );
  }
  return readJson<AuthConfig>(configPath);
};

class DokployClient {
  readonly baseUrl: string;
  readonly apiKey: string;

  constructor(auth: AuthConfig) {
    this.baseUrl = normalizeUrl(auth.domain);
    this.apiKey = auth.apiKey;
  }

  async get<T>(
    endpoint: string,
    query: Record<string, string> = {},
  ): Promise<T> {
    const url = new URL(`/api/${endpoint}`, `${this.baseUrl}/`);
    for (const [name, value] of Object.entries(query))
      url.searchParams.set(name, value);
    return this.request<T>(url, { method: "GET" });
  }

  async post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    const url = new URL(`/api/${endpoint}`, `${this.baseUrl}/`);
    return this.request<T>(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  private async request<T>(url: URL, init: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: { ...init.headers, "x-api-key": this.apiKey },
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(
        `${init.method} ${url.pathname} failed with HTTP ${response.status}. Inspect Dokploy for redacted details.`,
      );
    }
    if (!body) return undefined as T;
    return JSON.parse(body) as T;
  }
}

const exactlyOne = <T>(values: T[], description: string): T | undefined => {
  if (values.length > 1)
    throw new Error(
      `Found duplicate ${description} records; reconcile them manually.`,
    );
  return values[0];
};

const commandOutput = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

const domainPointsTo = async (domain: string, ip: string): Promise<boolean> => {
  try {
    return (await resolve4(domain)).includes(ip);
  } catch {
    return false;
  }
};

const validateProductionClerk = (environment: Record<string, string>): void => {
  const publishableKey = environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const secretKey = environment.CLERK_SECRET_KEY;
  if (
    !publishableKey?.startsWith("pk_live_") ||
    !secretKey?.startsWith("sk_live_")
  ) {
    throw new Error(
      "Production requires matching Clerk production keys; both Clerk keys must be live keys.",
    );
  }
};

const run = async (command: Command): Promise<void> => {
  const manifest = await readJson<Manifest>(manifestPath);
  if (manifest.version !== 1)
    throw new Error(
      `Unsupported deployment manifest version ${manifest.version}.`,
    );
  const environment = await loadEnvironment();
  validateProductionClerk(environment);
  const auth = await loadAuth(environment);
  if (normalizeUrl(auth.domain) !== normalizeUrl(manifest.serverUrl)) {
    throw new Error(
      `Refusing to use ${normalizeUrl(auth.domain)}. This manifest targets ${normalizeUrl(manifest.serverUrl)}.`,
    );
  }
  const client = new DokployClient(auth);
  const version = await client.get<string>("settings.getDokployVersion");
  const serverIp = await client.get<string>("settings.getIp");
  const images = new Map(
    await Promise.all(
      manifest.applications.map(
        async (application) =>
          [application.name, await immutableImage(application)] as const,
      ),
    ),
  );
  let projects = await client.get<DokployProject[]>("project.all");

  if (command === "status") {
    const applications = await Promise.all(
      manifest.applications.map(async (desired) => {
        const project = exactlyOne(
          projects.filter((candidate) => candidate.name === desired.project),
          `project named ${desired.project}`,
        );
        const targetEnvironment = exactlyOne(
          (project?.environments ?? []).filter(
            (candidate) => candidate.name === manifest.environment,
          ),
          `${desired.project}/${manifest.environment} environment`,
        );
        const app = exactlyOne(
          (targetEnvironment?.applications ?? []).filter(
            (candidate) => candidate.name === desired.name,
          ),
          `${desired.project}/${desired.name} application`,
        );
        if (!app)
          return {
            project: desired.project,
            application: desired.name,
            exists: false,
          };
        const domains = await client.get<DokployDomain[]>(
          "domain.byApplicationId",
          {
            applicationId: app.applicationId,
          },
        );
        const dnsReady = await domainPointsTo(desired.domain, serverIp);
        let health: { ok: boolean; status?: number } = { ok: false };
        try {
          const response = await fetch(
            `https://${desired.domain}${desired.healthPath}`,
          );
          health = { ok: response.ok, status: response.status };
        } catch {
          health = { ok: false };
        }
        return {
          project: desired.project,
          application: desired.name,
          applicationId: app.applicationId,
          exists: true,
          status: app.applicationStatus,
          image: app.dockerImage,
          desiredImage: images.get(desired.name),
          dnsReady,
          domains: domains.map(({ host, https, port, certificateType }) => ({
            host,
            https,
            port,
            certificateType,
          })),
          health,
        };
      }),
    );
    commandOutput({
      server: manifest.serverUrl,
      serverIp,
      dokployVersion: version,
      applications,
    });
    return;
  }

  const plannedChanges: string[] = [];
  for (const desired of manifest.applications) {
    selectedEnvironment(environment, desired, manifest.applications);
    const project = exactlyOne(
      projects.filter((candidate) => candidate.name === desired.project),
      `project named ${desired.project}`,
    );
    if (!project) {
      plannedChanges.push(`create project ${desired.project}`);
      plannedChanges.push(`create application ${desired.name}`);
      plannedChanges.push(`configure route for ${desired.domain}`);
      continue;
    }
    const targetEnvironment = exactlyOne(
      (project.environments ?? []).filter(
        (candidate) => candidate.name === manifest.environment,
      ),
      `${desired.project}/${manifest.environment} environment`,
    );
    if (!targetEnvironment)
      plannedChanges.push(
        `create environment ${desired.project}/${manifest.environment}`,
      );
    const app = exactlyOne(
      (targetEnvironment?.applications ?? []).filter(
        (candidate) => candidate.name === desired.name,
      ),
      `${desired.project}/${desired.name} application`,
    );
    if (!app) plannedChanges.push(`create application ${desired.name}`);
    else {
      const image = images.get(desired.name);
      if (app.dockerImage !== image || app.sourceType !== "docker") {
        plannedChanges.push(`configure ${desired.name} image ${image}`);
      }
      const domains = await client.get<DokployDomain[]>(
        "domain.byApplicationId",
        {
          applicationId: app.applicationId,
        },
      );
      const domain = exactlyOne(
        domains.filter((candidate) => candidate.host === desired.domain),
        `${desired.domain} domain`,
      );
      const dnsReady = await domainPointsTo(desired.domain, serverIp);
      const desiredCertificate = dnsReady ? "letsencrypt" : "none";
      if (!domain) plannedChanges.push(`configure route for ${desired.domain}`);
      else if (
        domain.https !== dnsReady ||
        domain.port !== desired.port ||
        domain.certificateType !== desiredCertificate
      ) {
        plannedChanges.push(`reconcile ${desired.domain} routing and TLS`);
      }
    }
    plannedChanges.push(
      `reconcile ${desired.name} environment (${environmentVariableNames(desired).join(", ")})`,
    );
  }

  if (command === "plan") {
    commandOutput({
      server: manifest.serverUrl,
      serverIp,
      dokployVersion: version,
      changes: plannedChanges,
      secretValuesShown: false,
    });
    return;
  }

  if (!process.argv.includes("--confirm-production")) {
    throw new Error("Production apply requires --confirm-production.");
  }

  const registry = manifest.applications.some(
    (application) => application.privateImage,
  )
    ? await registryCredentials(environment)
    : undefined;
  const applied: Array<{
    application: string;
    applicationId: string;
    domain: string;
    image: string;
    dnsReady: boolean;
  }> = [];
  for (const desired of [...manifest.applications].reverse()) {
    const image = images.get(desired.name);
    if (!image)
      throw new Error(
        `Unable to resolve an immutable image for ${desired.name}.`,
      );
    let project = exactlyOne(
      projects.filter((candidate) => candidate.name === desired.project),
      `project named ${desired.project}`,
    );
    if (!project) {
      await client.post("project.create", {
        name: desired.project,
        description: desired.projectDescription,
      });
      projects = await client.get<DokployProject[]>("project.all");
      project = exactlyOne(
        projects.filter((candidate) => candidate.name === desired.project),
        `project named ${desired.project}`,
      );
    }
    if (!project)
      throw new Error(
        `Dokploy did not return newly created project ${desired.project}.`,
      );

    let targetEnvironment = exactlyOne(
      (project.environments ?? []).filter(
        (candidate) => candidate.name === manifest.environment,
      ),
      `${desired.project}/${manifest.environment} environment`,
    );
    if (!targetEnvironment) {
      await client.post("environment.create", {
        name: manifest.environment,
        projectId: project.projectId,
      });
      const environments = await client.get<DokployEnvironment[]>(
        "environment.byProjectId",
        {
          projectId: project.projectId,
        },
      );
      targetEnvironment = exactlyOne(
        environments.filter(
          (candidate) => candidate.name === manifest.environment,
        ),
        `${desired.project}/${manifest.environment} environment`,
      );
    }
    if (!targetEnvironment)
      throw new Error(
        `Dokploy did not return ${desired.project}/${manifest.environment}.`,
      );

    let app = exactlyOne(
      (targetEnvironment.applications ?? []).filter(
        (candidate) => candidate.name === desired.name,
      ),
      `${desired.project}/${desired.name} application`,
    );
    if (!app) {
      app = await client.post<DokployApplication>("application.create", {
        name: desired.name,
        appName: desired.appName,
        environmentId: targetEnvironment.environmentId,
        sourceType: "docker",
      });
    }

    await client.post("application.saveDockerProvider", {
      applicationId: app.applicationId,
      dockerImage: image,
      username: desired.privateImage ? registry?.username : null,
      password: desired.privateImage ? registry?.token : null,
      registryUrl: "ghcr.io",
    });
    await client.post("application.saveEnvironment", {
      applicationId: app.applicationId,
      env: serializeEnvironment(
        selectedEnvironment(environment, desired, manifest.applications),
      ),
      buildArgs: null,
      buildSecrets: null,
      createEnvFile: false,
    });
    await client.post("application.update", {
      applicationId: app.applicationId,
      name: desired.name,
      appName: desired.appName,
      sourceType: "docker",
      replicas: 1,
    });

    const domains = await client.get<DokployDomain[]>(
      "domain.byApplicationId",
      {
        applicationId: app.applicationId,
      },
    );
    let domain = exactlyOne(
      domains.filter((candidate) => candidate.host === desired.domain),
      `${desired.domain} domain`,
    );
    const dnsReady = await domainPointsTo(desired.domain, serverIp);
    const certificateType = dnsReady ? "letsencrypt" : "none";
    if (!domain) {
      domain = await client.post<DokployDomain>("domain.create", {
        host: desired.domain,
        port: desired.port,
        https: dnsReady,
        certificateType,
        applicationId: app.applicationId,
        domainType: "application",
        stripPath: false,
      });
    } else {
      await client.post("domain.update", {
        domainId: domain.domainId,
        host: desired.domain,
        port: desired.port,
        https: dnsReady,
        certificateType,
        domainType: "application",
        stripPath: false,
      });
    }

    await client.post("application.redeploy", {
      applicationId: app.applicationId,
      title: `Production release ${new Date().toISOString()}`,
    });
    await waitForDeployment(client, app.applicationId);
    applied.push({
      application: desired.name,
      applicationId: app.applicationId,
      domain: desired.domain,
      image,
      dnsReady,
    });
  }
  await configureDeploymentSecrets(manifest, applied, auth.apiKey);
  commandOutput({
    server: manifest.serverUrl,
    serverIp,
    dokployVersion: version,
    applied,
    secretValuesShown: false,
  });
};

const runCommand = async (args: string[]): Promise<string> => {
  const process = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) throw new Error(`${args[0]} failed: ${stderr.trim()}`);
  return stdout.trim();
};

const immutableImage = async (
  application: ApplicationManifest,
): Promise<string> => {
  const sha = await runCommand([
    "gh",
    "api",
    `repos/${application.githubRepository}/commits/main`,
    "--jq",
    ".sha",
  ]);
  if (!/^[a-f0-9]{40}$/.test(sha)) {
    throw new Error(
      `GitHub returned an invalid main commit for ${application.githubRepository}.`,
    );
  }
  return `${application.imageRepository}:sha-${sha}`;
};

const waitForDeployment = async (
  client: DokployClient,
  applicationId: string,
): Promise<void> => {
  await Bun.sleep(2_000);
  const deadline = Date.now() + 10 * 60 * 1000;
  while (Date.now() < deadline) {
    const application = await client.get<DokployApplication>(
      "application.one",
      {
        applicationId,
      },
    );
    if (application.applicationStatus === "done") return;
    if (application.applicationStatus === "error") {
      throw new Error(`Dokploy deployment failed for ${application.name}.`);
    }
    await Bun.sleep(5_000);
  }
  throw new Error(
    `Timed out waiting for Dokploy application ${applicationId}.`,
  );
};

const setGitHubEnvironmentSecret = async (
  repository: string,
  name: string,
  value: string,
): Promise<void> => {
  const child = Bun.spawn(
    ["gh", "secret", "set", name, "--repo", repository, "--env", "Production"],
    { stdin: "pipe", stdout: "pipe", stderr: "pipe" },
  );
  child.stdin.write(value);
  child.stdin.end();
  const [stderr, exitCode] = await Promise.all([
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (exitCode !== 0)
    throw new Error(
      `Unable to configure ${repository}/${name}: ${stderr.trim()}`,
    );
};

const configureDeploymentSecrets = async (
  manifest: Manifest,
  applied: Array<{ application: string; applicationId: string }>,
  apiKey: string,
): Promise<void> => {
  for (const result of applied) {
    const application = manifest.applications.find(
      (candidate) => candidate.name === result.application,
    );
    if (!application) continue;
    await setGitHubEnvironmentSecret(
      application.githubRepository,
      "DOKPLOY_API_KEY",
      apiKey,
    );
    await setGitHubEnvironmentSecret(
      application.githubRepository,
      "DOKPLOY_APPLICATION_ID",
      result.applicationId,
    );
  }
};

const registryCredentials = async (
  environment: Record<string, string>,
): Promise<{ username: string; token: string }> => {
  const username =
    environment.GHCR_USERNAME ||
    (await runCommand(["gh", "api", "user", "--jq", ".login"]));
  const token =
    environment.GHCR_TOKEN || (await runCommand(["gh", "auth", "token"]));
  if (!username || !token) throw new Error("GHCR credentials are missing.");
  return { username, token };
};

const command = process.argv[2] as Command | undefined;
if (!command || !["apply", "plan", "status"].includes(command)) {
  process.stderr.write(
    "Usage: bun scripts/deploy.ts <plan|apply|status> [--confirm-production]\n",
  );
  process.exit(2);
}

try {
  await run(command);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
