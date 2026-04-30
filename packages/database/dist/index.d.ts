export interface FilterConfig {
  readonly schemas?: readonly string[]
  readonly tables?: readonly string[]
}

export interface SchemaSourceConfig {
  readonly include: readonly string[]
  readonly exclude?: readonly string[]
}

export interface EffectDbConfig {
  readonly dialect: "postgres"
  readonly db?: {
    readonly url?: string
    readonly urlEnv?: string
  }
  readonly source?: SchemaSourceConfig
  readonly filter?: FilterConfig
  readonly migrations?: {
    readonly dir?: string
    readonly table?: string
  }
  readonly safety?: {
    readonly nonDestructiveDefault?: boolean
  }
}

export interface LoadedPostgresConfig {
  readonly config: Required<EffectDbConfig>
  readonly cwd: string
  readonly path?: string
}

export declare const defineConfig: <Config extends EffectDbConfig>(config: Config) => Config
export declare const loadPostgresConfig: (cwd: string, explicitPath?: string) => Promise<LoadedPostgresConfig>
export declare const resolveDatabaseUrl: (config: EffectDbConfig, overrideUrl?: string) => string
