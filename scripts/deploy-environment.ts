export interface ApplicationEnvironment {
  readonly name: string;
  readonly domain: string;
  readonly environmentVariables: string[];
  readonly optionalEnvironmentVariables: string[];
  readonly serviceEnvironmentVariables?: Record<string, string>;
}

export const environmentVariableNames = (
  application: ApplicationEnvironment,
): string[] => [
  ...application.environmentVariables,
  ...application.optionalEnvironmentVariables,
  ...Object.keys(application.serviceEnvironmentVariables ?? {}),
];

export const parseEnvironment = (source: string): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const delimiter = line.indexOf("=");
    if (delimiter < 1) continue;
    const name = line.slice(0, delimiter).trim();
    let value = line.slice(delimiter + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value);
      } catch {
        throw new Error(`Invalid quoted value for ${name}`);
      }
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    result[name] = value;
  }
  return result;
};

export const serializeEnvironment = (values: Record<string, string>): string =>
  Object.entries(values)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}=${JSON.stringify(value)}`)
    .join("\n");

export const serviceEnvironment = (
  application: ApplicationEnvironment,
  applications: ApplicationEnvironment[],
): Record<string, string> => {
  const selected: Record<string, string> = {};
  for (const [name, targetName] of Object.entries(
    application.serviceEnvironmentVariables ?? {},
  )) {
    const targets = applications.filter(
      (candidate) => candidate.name === targetName,
    );
    const target = targets[0];
    if (!target || targets.length !== 1) {
      throw new Error(
        `Expected exactly one service named ${targetName} for ${application.name}, found ${targets.length}.`,
      );
    }
    selected[name] = `https://${target.domain}`;
  }
  return selected;
};

export const selectedEnvironment = (
  values: Record<string, string>,
  application: ApplicationEnvironment,
  applications: ApplicationEnvironment[],
): Record<string, string> => {
  const selected: Record<string, string> = {};
  const required = new Set(application.environmentVariables);
  const names = [
    ...application.environmentVariables,
    ...application.optionalEnvironmentVariables,
  ];
  for (const name of names) {
    const value = values[name];
    if (value) selected[name] = value;
    else if (required.has(name))
      throw new Error(
        `Missing required environment variable ${name} for ${application.name}.`,
      );
  }

  Object.assign(selected, serviceEnvironment(application, applications));
  return selected;
};
