// src/internal/postgres-config.ts
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
var defineConfig = (config) => config;
var DEFAULT_CONFIG_NAMES = [
  "effectdb.config.ts",
  "effectdb.config.mts",
  "effectdb.config.js",
  "effectdb.config.mjs"
];
var defaultConfig = () => ({
  dialect: "postgres",
  db: {},
  source: {
    include: [
      "src/**/*.ts",
      "src/**/*.tsx",
      "src/**/*.js",
      "src/**/*.jsx"
    ]
  },
  migrations: {
    dir: "migrations",
    table: "effect_qb_migrations"
  },
  safety: {
    nonDestructiveDefault: true
  }
});
var fileExists = async (path) => await Bun.file(path).exists();
var loadModuleConfig = async (path) => {
  const imported = await import(pathToFileURL(path).href);
  return imported.default ?? imported.config ?? imported;
};
var loadPostgresConfig = async (cwd, explicitPath) => {
  const configPath = explicitPath === undefined ? await (async () => {
    for (const name of DEFAULT_CONFIG_NAMES) {
      const candidate = resolve(cwd, name);
      if (await fileExists(candidate)) {
        return candidate;
      }
    }
    return;
  })() : resolve(cwd, explicitPath);
  if (configPath === undefined) {
    return {
      config: defaultConfig(),
      cwd
    };
  }
  const loaded = await loadModuleConfig(configPath);
  if (typeof loaded !== "object" || loaded === null) {
    throw new Error(`Config file '${configPath}' did not export an object`);
  }
  const merged = {
    ...defaultConfig(),
    ...loaded,
    db: {
      ...defaultConfig().db,
      ...loaded.db ?? {}
    },
    source: {
      ...defaultConfig().source,
      ...loaded.source ?? {}
    },
    migrations: {
      ...defaultConfig().migrations,
      ...loaded.migrations ?? {}
    },
    safety: {
      ...defaultConfig().safety,
      ...loaded.safety ?? {}
    }
  };
  if (merged.dialect !== "postgres") {
    throw new Error(`Unsupported dialect '${String(loaded.dialect)}'; only 'postgres' is supported`);
  }
  if (merged.source.include.length === 0) {
    throw new Error("Schema source discovery requires at least one include glob");
  }
  return {
    config: merged,
    cwd: dirname(configPath),
    path: configPath
  };
};
var resolveDatabaseUrl = (config, overrideUrl) => {
  if (overrideUrl) {
    return overrideUrl;
  }
  if (config.db.url) {
    return config.db.url;
  }
  if (config.db.urlEnv) {
    const value = process.env[config.db.urlEnv];
    if (value) {
      return value;
    }
    throw new Error(`Database URL env var '${config.db.urlEnv}' is not set`);
  }
  throw new Error("Database URL is required; set db.url, db.urlEnv, or pass --url");
};
export {
  resolveDatabaseUrl,
  loadPostgresConfig,
  defineConfig
};
