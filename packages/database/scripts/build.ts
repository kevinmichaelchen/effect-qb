import { mkdir, rm, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"

const cwd = process.cwd()
const distDir = join(cwd, "dist")

const indexDeclaration = `export interface FilterConfig {
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
`

const writeDeclarations = async (): Promise<void> => {
  await writeFile(join(distDir, "index.d.ts"), indexDeclaration)
  await writeFile(join(distDir, "cli.d.ts"), "export {};\n")
}

const main = async () => {
  await rm(distDir, { recursive: true, force: true })
  await mkdir(distDir, { recursive: true })

  const proc = Bun.spawn([
    process.execPath,
    "build",
    "--outdir",
    "dist",
    "--target",
    "node",
    "--format",
    "esm",
    "--packages",
    "external",
    "--root",
    "src",
    "src/index.ts",
    "src/cli.ts"
  ], {
    cwd,
    stdout: "inherit",
    stderr: "inherit"
  })

  const exitCode = await proc.exited
  if (exitCode !== 0) {
    process.exit(exitCode)
  }

  const distStat = await stat(distDir)
  if (!distStat.isDirectory()) {
    throw new Error("build did not produce a dist directory")
  }

  await writeDeclarations()
}

await main()
