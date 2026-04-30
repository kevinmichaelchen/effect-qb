#!/usr/bin/env bun

// src/cli.ts
import { BunRuntime, BunServices } from "@effect/platform-bun";
import * as Effect4 from "effect/Effect";
import * as Option from "effect/Option";
import { Command, Flag } from "effect/unstable/cli";

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

// src/internal/postgres-migrations.ts
import { mkdir } from "node:fs/promises";
import { join, resolve as resolve2 } from "node:path";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as Effect from "effect/Effect";
var MIGRATION_UP_MARKER = "-- effect-db:up";
var MIGRATION_DOWN_MARKER = "-- effect-db:down";
var quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;
var qualifyIdentifier = (value) => {
  const parts = value.split(".").filter((part) => part.length > 0);
  return parts.map(quoteIdentifier).join(".");
};
var sanitizeName = (value) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "migration";
var migrationTableSql = (tableName) => `create table if not exists ${qualifyIdentifier(tableName)} (
    id bigint generated always as identity primary key,
    name text not null unique,
    applied_at timestamptz not null default now()
  )`;
var renderStatements = (statements) => statements.map((statement) => statement.endsWith(";") ? statement : `${statement};`).join(`
`);
var parseMigrationSections = (contents) => {
  const normalized = contents.replaceAll(`\r
`, `
`);
  if (!normalized.includes(MIGRATION_UP_MARKER)) {
    const sql2 = normalized.trim();
    return {
      sql: sql2
    };
  }
  const lines = normalized.split(`
`);
  let section;
  const upLines = [];
  const downLines = [];
  for (const line of lines) {
    const marker = line.trim();
    if (marker === MIGRATION_UP_MARKER) {
      section = "up";
      continue;
    }
    if (marker === MIGRATION_DOWN_MARKER) {
      section = "down";
      continue;
    }
    if (section === "down") {
      downLines.push(line);
    } else {
      upLines.push(line);
    }
  }
  const sql = upLines.join(`
`).trim();
  const downSql = downLines.join(`
`).trim();
  return {
    sql,
    downSql: downSql.length > 0 ? downSql : undefined
  };
};
var renderMigrationFile = (changes) => {
  const upStatements = changes.map((change) => change.sql).filter((statement) => statement !== undefined);
  const reversible = changes.every((change) => change.rollbackSql !== undefined);
  const downStatements = reversible ? [...changes].reverse().map((change) => change.rollbackSql).filter((statement) => statement !== undefined) : [];
  const sections = [
    MIGRATION_UP_MARKER,
    renderStatements(upStatements)
  ];
  if (reversible && downStatements.length > 0) {
    sections.push(MIGRATION_DOWN_MARKER, renderStatements(downStatements));
  }
  return sections.join(`
`);
};
var writeMigrationFile = async (migrationsDir, name, changes) => {
  const directory = resolve2(migrationsDir);
  await mkdir(directory, { recursive: true });
  const files = await Array.fromAsync(new Bun.Glob("*.sql").scan({
    cwd: directory,
    absolute: false
  }));
  const nextNumber = files.map((file) => /^(\d+)_/.exec(file)?.[1]).filter((value) => value !== undefined).map((value) => Number(value)).reduce((max, current) => Math.max(max, current), 0) + 1;
  const fileName = `${String(nextNumber).padStart(4, "0")}_${sanitizeName(name)}.sql`;
  const filePath = join(directory, fileName);
  await Bun.write(filePath, `${renderMigrationFile(changes)}
`);
  return filePath;
};
var ensureDirectory = async (dir) => {
  await mkdir(resolve2(dir), { recursive: true });
};
var applyStatements = (statements) => Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) => sql.withTransaction(Effect.forEach(statements, (statement) => sql.unsafe(statement), { discard: true })));
var readPendingMigrationFiles = async (migrationsDir, appliedNames) => {
  await ensureDirectory(migrationsDir);
  const directory = resolve2(migrationsDir);
  const files = (await Array.fromAsync(new Bun.Glob("*.sql").scan({
    cwd: directory,
    absolute: true
  }))).sort();
  const pending = [];
  for (const path of files) {
    const name = path.slice(path.lastIndexOf("/") + 1);
    if (appliedNames.has(name)) {
      continue;
    }
    const contents = await Bun.file(path).text();
    const parsed = parseMigrationSections(contents);
    pending.push({
      name,
      path,
      sql: parsed.sql,
      downSql: parsed.downSql
    });
  }
  return pending;
};
var readMigrationFiles = async (migrationsDir) => {
  await ensureDirectory(migrationsDir);
  const directory = resolve2(migrationsDir);
  const files = (await Array.fromAsync(new Bun.Glob("*.sql").scan({
    cwd: directory,
    absolute: true
  }))).sort();
  const parsed = [];
  for (const path of files) {
    const name = path.slice(path.lastIndexOf("/") + 1);
    const contents = await Bun.file(path).text();
    const sections = parseMigrationSections(contents);
    parsed.push({
      name,
      path,
      sql: sections.sql,
      downSql: sections.downSql
    });
  }
  return parsed;
};
var ensureMigrationTable = (tableName) => Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) => Effect.asVoid(sql.unsafe(migrationTableSql(tableName))));
var readAppliedMigrationNames = (tableName) => Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) => Effect.map(sql.unsafe(`select name from ${qualifyIdentifier(tableName)} order by name`), (rows) => new Set(rows.map((row) => row.name))));
var readAppliedMigrationRows = (tableName) => Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) => Effect.map(sql.unsafe(`select id, name from ${qualifyIdentifier(tableName)} order by id`), (rows) => rows));
var applyMigrationFiles = (tableName, files) => Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) => sql.withTransaction(Effect.forEach(files, (file) => Effect.andThen(sql.unsafe(file.sql), sql.unsafe(`insert into ${qualifyIdentifier(tableName)} (name) values ($1)`, [file.name])), {
  discard: true
})));
var rollbackMigrationFiles = (tableName, files) => Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) => sql.withTransaction(Effect.forEach(files, (file) => {
  if (file.downSql === undefined) {
    return Effect.fail(new Error(`Migration '${file.name}' does not have a rollback section`));
  }
  return Effect.andThen(sql.unsafe(file.downSql), sql.unsafe(`delete from ${qualifyIdentifier(tableName)} where name = $1`, [file.name]));
}, {
  discard: true
})));
var deleteAppliedMigrationNames = (tableName, names) => Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) => sql.withTransaction(Effect.forEach(names, (name) => sql.unsafe(`delete from ${qualifyIdentifier(tableName)} where name = $1`, [name]), {
  discard: true
})));
var migrationFileLabel = (path) => path.slice(path.lastIndexOf("/") + 1);
var migrationDirFromConfig = (cwd, dir) => resolve2(cwd, dir);

// src/internal/postgres-pull.ts
import { mkdir as mkdir2 } from "node:fs/promises";
import { dirname as dirname2, extname, relative, resolve as resolve3 } from "node:path";
import { Datatypes } from "effect-qb/postgres";

// src/internal/postgres-schema-sql.ts
import { SchemaExpression } from "effect-qb/postgres";
var quote = (value) => `"${value.replaceAll('"', '""')}"`;
var qualify = (schemaName, name) => `${quote(schemaName ?? "public")}.${quote(name)}`;
var renderAction = (action) => {
  switch (action) {
    case "noAction":
      return "no action";
    case "restrict":
      return "restrict";
    case "cascade":
      return "cascade";
    case "setNull":
      return "set null";
    case "setDefault":
      return "set default";
  }
};
var renderIdentity = (generation) => `generated ${generation === "byDefault" ? "by default" : "always"} as identity`;
var defaultIndexName = (tableName, keys, unique) => `${tableName}_${keys.join("_")}_${unique ? "uniq" : "idx"}`;
var defaultConstraintName = (table, option) => {
  switch (option.kind) {
    case "primaryKey":
      return `${table.name}_pkey`;
    case "unique":
      return `${table.name}_${option.columns.join("_")}_key`;
    case "foreignKey":
      return `${table.name}_${option.columns.join("_")}_fkey`;
    case "check":
      return option.name;
  }
};
var renderColumnDefinition = (column) => {
  const clauses = [
    quote(column.name),
    column.ddlType
  ];
  if (column.identity) {
    clauses.push(renderIdentity(column.identity.generation));
  } else if (column.generatedSql) {
    clauses.push(`generated always as (${column.generatedSql}) stored`);
  } else if (column.defaultSql) {
    clauses.push(`default ${column.defaultSql}`);
  }
  if (!column.nullable) {
    clauses.push("not null");
  }
  return clauses.join(" ");
};
var renderConstraint = (table, option) => {
  switch (option.kind) {
    case "primaryKey":
      return `${option.name ? `constraint ${quote(option.name)} ` : ""}primary key (${option.columns.map(quote).join(", ")})${option.deferrable ? ` deferrable${option.initiallyDeferred ? " initially deferred" : ""}` : ""}`;
    case "unique":
      return `${option.name ? `constraint ${quote(option.name)} ` : ""}unique${option.nullsNotDistinct ? " nulls not distinct" : ""} (${option.columns.map(quote).join(", ")})${option.deferrable ? ` deferrable${option.initiallyDeferred ? " initially deferred" : ""}` : ""}`;
    case "foreignKey": {
      const reference = option.references();
      return `${option.name ? `constraint ${quote(option.name)} ` : ""}foreign key (${option.columns.map(quote).join(", ")}) references ${qualify(reference.schemaName, reference.tableName)} (${reference.columns.map(quote).join(", ")})${option.onDelete ? ` on delete ${renderAction(option.onDelete)}` : ""}${option.onUpdate ? ` on update ${renderAction(option.onUpdate)}` : ""}${option.deferrable ? ` deferrable${option.initiallyDeferred ? " initially deferred" : ""}` : ""}`;
    }
    case "check":
      return `constraint ${quote(option.name)} check (${SchemaExpression.renderDdlExpressionSql(option.predicate)})${option.noInherit ? " no inherit" : ""}`;
  }
};
var indexKeysOf = (option) => option.keys ?? (option.columns ?? []).map((column) => ({
  kind: "column",
  column
}));
var renderIndexDefinition = (table, option) => {
  const keys = indexKeysOf(option);
  const name = option.name ?? defaultIndexName(table.name, keys.map((key) => key.kind === "column" ? key.column : "expr"), option.unique ?? false);
  const renderedKeys = keys.map((key) => {
    const base = key.kind === "column" ? quote(key.column) : `(${SchemaExpression.renderDdlExpressionSql(key.expression)})`;
    return `${base}${key.order ? ` ${key.order}` : ""}${key.nulls ? ` nulls ${key.nulls}` : ""}`;
  }).join(", ");
  return `create${option.unique ? " unique" : ""} index ${quote(name)} on ${qualify(table.schemaName, table.name)}${option.method ? ` using ${option.method}` : ""} (${renderedKeys})${option.include && option.include.length > 0 ? ` include (${option.include.map(quote).join(", ")})` : ""}${option.predicate ? ` where ${SchemaExpression.renderDdlExpressionSql(option.predicate)}` : ""}`;
};
var renderCreateTable = (table) => {
  const definitions = [
    ...table.columns.map(renderColumnDefinition),
    ...table.options.filter((option) => option.kind !== "index").map((option) => renderConstraint(table, option))
  ];
  return `create table ${qualify(table.schemaName, table.name)} (${definitions.join(", ")})`;
};
var renderCreateEnum = (enumType) => `create type ${qualify(enumType.schemaName, enumType.name)} as enum (${enumType.values.map((value) => `'${value.replaceAll("'", "''")}'`).join(", ")})`;
var renderDropEnum = (enumType) => `drop type ${qualify(enumType.schemaName, enumType.name)}`;
var renderRenameEnum = (enumType, nextName) => `alter type ${qualify(enumType.schemaName, enumType.name)} rename to ${quote(nextName)}`;
var renderDropTable = (table) => `drop table ${qualify(table.schemaName, table.name)}`;
var renderRenameTable = (table, nextName) => `alter table ${qualify(table.schemaName, table.name)} rename to ${quote(nextName)}`;
var renderRenameColumn = (table, column, nextName) => `alter table ${qualify(table.schemaName, table.name)} rename column ${quote(column)} to ${quote(nextName)}`;
var renderRenameConstraint = (table, name, nextName) => `alter table ${qualify(table.schemaName, table.name)} rename constraint ${quote(name)} to ${quote(nextName)}`;
var renderRenameIndex = (table, name, nextName) => `alter index ${qualify(table.schemaName, name)} rename to ${quote(nextName)}`;
var renderAddColumn = (table, column) => `alter table ${qualify(table.schemaName, table.name)} add column ${renderColumnDefinition(column)}`;
var renderDropColumn = (table, column) => `alter table ${qualify(table.schemaName, table.name)} drop column ${quote(column.name)}`;
var renderAddConstraint = (table, option) => `alter table ${qualify(table.schemaName, table.name)} add ${renderConstraint(table, {
  ...option,
  name: option.name ?? defaultConstraintName(table, option)
})}`;
var renderDropConstraint = (table, option) => `alter table ${qualify(table.schemaName, table.name)} drop constraint ${quote(option.name ?? defaultConstraintName(table, option))}`;
var renderDropIndex = (table, option) => {
  const keys = indexKeysOf(option);
  const name = option.name ?? defaultIndexName(table.name, keys.map((key) => key.kind === "column" ? key.column : "expr"), option.unique ?? false);
  return `drop index ${qualify(table.schemaName, name)}`;
};

// src/internal/postgres-pull.ts
import { enumKey, tableKey, renderDdlExpressionSql, normalizeDdlExpressionSql, toEnumModel, toTableModel } from "effect-qb/postgres/metadata";

// src/internal/postgres-type-utils.ts
var normalize = (value) => value.trim().replace(/\s+/g, " ").toLowerCase();
var canonicalBaseType = (value) => {
  switch (value) {
    case "boolean":
      return "bool";
    case "smallint":
      return "int2";
    case "integer":
      return "int4";
    case "bigint":
      return "int8";
    case "real":
      return "float4";
    case "double precision":
      return "float8";
    case "character varying":
      return "varchar";
    case "character":
    case "bpchar":
      return "char";
    case "time without time zone":
      return "time";
    case "time with time zone":
      return "timetz";
    case "timestamp without time zone":
      return "timestamp";
    case "timestamp with time zone":
      return "timestamptz";
    case "bit varying":
      return "varbit";
    case "jsonb":
      return "jsonb";
    default:
      return value;
  }
};
var canonicalizePostgresTypeName = (value) => {
  const normalized = normalize(value);
  if (normalized.endsWith("[]")) {
    return `${canonicalizePostgresTypeName(normalized.slice(0, -2))}[]`;
  }
  const arrayPrefix = /^_+/.exec(normalized);
  if (arrayPrefix !== null) {
    const depth = arrayPrefix[0].length;
    const base2 = normalized.slice(depth);
    return `${canonicalBaseType(base2)}${"[]".repeat(depth)}`;
  }
  const base = normalized.replace(/\(.+\)$/, "");
  if (base === "character" || base === "bpchar") {
    return `${canonicalBaseType(base)}${normalized === base ? "(1)" : normalized.slice(base.length)}`;
  }
  return `${canonicalBaseType(base)}${normalized.slice(base.length)}`;
};
var inferPostgresTypeKind = (ddlType) => {
  const normalized = normalize(ddlType);
  if (normalized.endsWith("[]")) {
    return normalized;
  }
  const arrayPrefix = /^_+/.exec(normalized);
  if (arrayPrefix !== null) {
    const depth = arrayPrefix[0].length;
    const base2 = normalized.slice(depth);
    return `${canonicalBaseType(base2)}${"[]".repeat(depth)}`;
  }
  const base = normalized.replace(/\(.+\)$/, "");
  return canonicalBaseType(base);
};

// src/internal/postgres-pull.ts
import { parse } from "pgsql-ast-parser";
var TABLE_ALIAS = "Table";
var COLUMN_ALIAS = "Column";
var PG_ALIAS = "Pg";
var SCHEMA_ALIAS = "Schema";
var isIdentifier = (value) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
var indent = (value, spaces = 2) => value.split(`
`).map((line) => `${" ".repeat(spaces)}${line}`).join(`
`);
var renderStringLiteral = (value) => JSON.stringify(value);
var renderPropertyKey = (value) => isIdentifier(value) ? value : renderStringLiteral(value);
var renderStringTuple = (values) => `[${values.map(renderStringLiteral).join(", ")}] as const`;
var pairUniqueBySignature = (sourceItems, dbItems, sourceSignatureOf, dbSignatureOf) => {
  const sourceBySignature = new Map;
  for (const item of sourceItems) {
    const signature = sourceSignatureOf(item);
    const list = sourceBySignature.get(signature) ?? [];
    list.push(item);
    sourceBySignature.set(signature, list);
  }
  const dbBySignature = new Map;
  for (const item of dbItems) {
    const signature = dbSignatureOf(item);
    const list = dbBySignature.get(signature) ?? [];
    list.push(item);
    dbBySignature.set(signature, list);
  }
  const pairs = [];
  for (const [signature, source] of sourceBySignature) {
    const db = dbBySignature.get(signature);
    if (source.length === 1 && db?.length === 1) {
      pairs.push({
        source: source[0],
        db: db[0]
      });
    }
  }
  return pairs;
};
var sortPulledAdditions = (additions) => {
  if (additions.length <= 1) {
    return additions;
  }
  return [...additions].sort((left, right) => left.sourceIndex - right.sourceIndex);
};
var normalizeType = (value) => value.trim().replace(/\s+/g, " ").toLowerCase();
var canonicalDdlType = (value) => {
  return canonicalizePostgresTypeName(value);
};
var renderQueryTypeName = (typeName, context) => {
  const normalized = normalizeType(typeName);
  const schemaName = inferSchemaNameFromDdl(typeName);
  const kind = inferKindFromDdl(typeName);
  if (context !== undefined && context.enumKeys.has(enumKey(schemaName, kind))) {
    const qualified = schemaName === undefined || schemaName === "public" ? kind : `${schemaName}.${kind}`;
    return `${PG_ALIAS}.Query.type.enum(${renderStringLiteral(qualified)})`;
  }
  if (normalized.endsWith("[]")) {
    const elementType = typeName.trim().slice(0, -2);
    return `${PG_ALIAS}.Query.type.array(${renderQueryTypeName(elementType, context)})`;
  }
  switch (kind) {
    case "bool":
      return `${PG_ALIAS}.Query.type.bool()`;
    case "date":
      return `${PG_ALIAS}.Query.type.date()`;
    case "int2":
      return `${PG_ALIAS}.Query.type.int2()`;
    case "int4":
      return `${PG_ALIAS}.Query.type.int4()`;
    case "int8":
      return `${PG_ALIAS}.Query.type.int8()`;
    case "numeric":
      return `${PG_ALIAS}.Query.type.numeric()`;
    case "float4":
      return `${PG_ALIAS}.Query.type.float4()`;
    case "float8":
      return `${PG_ALIAS}.Query.type.float8()`;
    case "time":
      return `${PG_ALIAS}.Query.type.time()`;
    case "timetz":
      return `${PG_ALIAS}.Query.type.timetz()`;
    case "timestamp":
      return `${PG_ALIAS}.Query.type.timestamp()`;
    case "timestamptz":
      return `${PG_ALIAS}.Query.type.timestamptz()`;
    case "uuid":
      return `${PG_ALIAS}.Query.type.uuid()`;
    case "text":
      return `${PG_ALIAS}.Query.type.text()`;
    case "varchar":
      return `${PG_ALIAS}.Query.type.varchar()`;
    case "char":
    case "bpchar":
      return `${PG_ALIAS}.Query.type.char()`;
    case "name":
      return `${PG_ALIAS}.Query.type.name()`;
    case "interval":
      return `${PG_ALIAS}.Query.type.interval()`;
    case "bytea":
      return `${PG_ALIAS}.Query.type.bytea()`;
    case "json":
      return `${PG_ALIAS}.Query.type.json()`;
    case "jsonb":
      return `${PG_ALIAS}.Query.type.jsonb()`;
    case "regclass":
      return `${PG_ALIAS}.Query.type.regclass()`;
    case "oid":
      return `${PG_ALIAS}.Query.type.oid()`;
    case "bit":
      return `${PG_ALIAS}.Query.type.bit()`;
    case "varbit":
      return `${PG_ALIAS}.Query.type.varbit()`;
    case "xml":
      return `${PG_ALIAS}.Query.type.xml()`;
    case "pg_lsn":
      return `${PG_ALIAS}.Query.type.pg_lsn()`;
    default:
      return `${PG_ALIAS}.Query.type.custom(${renderStringLiteral(typeName)})`;
  }
};
var renderCastTarget = (target, context) => {
  if (typeof target === "string") {
    return renderQueryTypeName(target, context);
  }
  if (target !== null && typeof target === "object") {
    const record = target;
    if (record.kind === "array" && record.arrayOf !== undefined) {
      return `${PG_ALIAS}.Query.type.array(${renderCastTarget(record.arrayOf, context)})`;
    }
    if (typeof record.schema === "string" && typeof record.name === "string") {
      const qualified = `${record.schema}.${record.name}`;
      if (Array.isArray(record.config) && record.config.length > 0) {
        return `${PG_ALIAS}.Query.type.custom(${renderStringLiteral(`${qualified}(${record.config.join(", ")})`)})`;
      }
      return renderQueryTypeName(qualified, context);
    }
    if (typeof record.name === "string") {
      if (Array.isArray(record.config) && record.config.length > 0) {
        return `${PG_ALIAS}.Query.type.custom(${renderStringLiteral(`${record.name}(${record.config.join(", ")})`)})`;
      }
      return renderQueryTypeName(record.name, context);
    }
    if (typeof record.type === "string") {
      return renderQueryTypeName(record.type, context);
    }
  }
  throw new Error(`Unsupported cast target in pulled schema: ${JSON.stringify(target)}`);
};
var renderQueryTypeExpression = (column, context) => {
  const normalized = normalizeType(column.ddlType);
  if (normalized.endsWith("[]")) {
    const elementType = normalized.slice(0, -2);
    const elementColumn = {
      ...column,
      ddlType: elementType,
      dbTypeKind: inferKindFromDdl(elementType),
      typeKind: undefined,
      typeSchema: undefined
    };
    return `${PG_ALIAS}.Query.type.array(${renderQueryTypeExpression(elementColumn, context)})`;
  }
  if (column.typeKind === "e" || "enumKeys" in context && context.enumKeys.has(enumKey(column.typeSchema, column.dbTypeKind))) {
    const typeName = column.typeSchema === undefined || column.typeSchema === "public" ? column.dbTypeKind : `${column.typeSchema}.${column.dbTypeKind}`;
    return `${PG_ALIAS}.Query.type.enum(${renderStringLiteral(typeName)})`;
  }
  return renderQueryTypeName(normalized);
};
var renderQueryColumnReference = (name, context) => {
  const column = context.columnByName.get(name);
  if (column === undefined) {
    throw new Error(`Unsupported PostgreSQL expression: unknown column reference '${name}'`);
  }
  return `${PG_ALIAS}.Query.column(${renderStringLiteral(name)}, ${renderQueryTypeExpression(column, context)}${column.nullable ? ", true" : ""})`;
};
var renderSqlExpressionCode = (expression, context) => {
  const isTextCastTarget = (value) => {
    if (typeof value !== "object" || value === null || !("name" in value)) {
      return false;
    }
    const name = String(value.name).toLowerCase();
    return name === "text" || name === "varchar" || name === "char" || name === "character varying" || name === "character" || name === "bpchar";
  };
  const extractStringLiteral = (value) => {
    switch (value.type) {
      case "string":
        return value.value;
      case "cast":
        return isTextCastTarget(value.to) ? extractStringLiteral(value.operand) : undefined;
      default:
        return;
    }
  };
  const extractStringArrayLiterals = (value) => {
    switch (value.type) {
      case "array": {
        const values = value.expressions.map((item) => extractStringLiteral(item));
        return values.every((item) => item !== undefined) ? values : undefined;
      }
      case "cast":
        return extractStringArrayLiterals(value.operand);
      default:
        return;
    }
  };
  switch (expression.type) {
    case "ref":
      return renderQueryColumnReference(expression.name, context);
    case "string":
      return `${PG_ALIAS}.Query.literal(${renderStringLiteral(expression.value)})`;
    case "integer":
      return `${PG_ALIAS}.Query.literal(${String(expression.value)})`;
    case "numeric":
      return `${PG_ALIAS}.Query.literal(${String(expression.value)})`;
    case "boolean":
      return `${PG_ALIAS}.Query.literal(${String(expression.value)})`;
    case "null":
      return `${PG_ALIAS}.Query.literal(null)`;
    case "keyword": {
      const keyword = expression.keyword.toLowerCase();
      switch (keyword) {
        case "current_date":
          return `${PG_ALIAS}.Function.currentDate()`;
        case "current_time":
          return `${PG_ALIAS}.Function.currentTime()`;
        case "current_timestamp":
          return `${PG_ALIAS}.Function.currentTimestamp()`;
        case "localtime":
          return `${PG_ALIAS}.Function.localTime()`;
        case "localtimestamp":
          return `${PG_ALIAS}.Function.localTimestamp()`;
        case "current_schema":
        case "current_catalog":
        case "current_role":
        case "current_user":
        case "session_user":
        case "user":
          return `${PG_ALIAS}.Function.call(${renderStringLiteral(keyword)})`;
        case "distinct":
          throw new Error("Unsupported PostgreSQL keyword in pulled schema: distinct");
      }
      return `${PG_ALIAS}.Function.call(${renderStringLiteral(keyword)})`;
    }
    case "cast":
      return `${PG_ALIAS}.Query.cast(${renderSqlExpressionCode(expression.operand, context)}, ${renderCastTarget(expression.to, context)})`;
    case "member": {
      const base = renderSqlExpressionCode(expression.operand, context);
      const member = expression.member;
      const path = typeof member === "number" ? `${PG_ALIAS}.Function.json.index(${member})` : `${PG_ALIAS}.Function.json.key(${renderStringLiteral(member)})`;
      return expression.op === "->>" ? `${PG_ALIAS}.Function.json.text(${base}, ${path})` : `${PG_ALIAS}.Function.json.get(${base}, ${path})`;
    }
    case "call": {
      const name = (expression.function.name ?? "").toLowerCase();
      const args = Array.isArray(expression.args) ? expression.args : [];
      switch (name) {
        case "lower":
          return `${PG_ALIAS}.Function.lower(${args.map((arg) => renderSqlExpressionCode(arg, context)).join(", ")})`;
        case "upper":
          return `${PG_ALIAS}.Function.upper(${args.map((arg) => renderSqlExpressionCode(arg, context)).join(", ")})`;
        case "coalesce":
          return `${PG_ALIAS}.Function.coalesce(${args.map((arg) => renderSqlExpressionCode(arg, context)).join(", ")})`;
        case "now":
          return `${PG_ALIAS}.Function.now()`;
        case "current_timestamp":
          return `${PG_ALIAS}.Function.currentTimestamp()`;
        case "current_date":
          return `${PG_ALIAS}.Function.currentDate()`;
        case "current_time":
          return `${PG_ALIAS}.Function.currentTime()`;
        case "localtime":
          return `${PG_ALIAS}.Function.localTime()`;
        case "localtimestamp":
          return `${PG_ALIAS}.Function.localTimestamp()`;
        case "uuid_generate_v4":
        case "gen_random_uuid":
          return `${PG_ALIAS}.Function.uuidGenerateV4()`;
        case "nextval":
          return `${PG_ALIAS}.Function.nextVal(${args.map((arg) => renderSqlExpressionCode(arg, context)).join(", ")})`;
        case "jsonb_build_object": {
          if (args.length % 2 !== 0) {
            throw new Error("Unsupported PostgreSQL expression: jsonb_build_object requires key/value pairs");
          }
          const entries = [];
          for (let index = 0;index < args.length; index += 2) {
            const key = args[index];
            const value = args[index + 1];
            if (key === undefined || value === undefined || key.type !== "string") {
              throw new Error("Unsupported PostgreSQL expression: jsonb_build_object requires literal string keys");
            }
            entries.push(`${renderStringLiteral(key.value)}: ${renderSqlExpressionCode(value, context)}`);
          }
          return `${PG_ALIAS}.Function.json.buildObject({ ${entries.join(", ")} })`;
        }
        case "jsonb_build_array":
          return `${PG_ALIAS}.Function.json.buildArray(${args.map((arg) => renderSqlExpressionCode(arg, context)).join(", ")})`;
        case "to_json":
          return `${PG_ALIAS}.Function.json.toJson(${args.map((arg) => renderSqlExpressionCode(arg, context)).join(", ")})`;
        case "to_jsonb":
          return `${PG_ALIAS}.Function.json.toJsonb(${args.map((arg) => renderSqlExpressionCode(arg, context)).join(", ")})`;
        case "jsonb_strip_nulls":
          return `${PG_ALIAS}.Function.json.stripNulls(${args.map((arg) => renderSqlExpressionCode(arg, context)).join(", ")})`;
        case "jsonb_typeof":
          return `${PG_ALIAS}.Function.json.typeOf(${args.map((arg) => renderSqlExpressionCode(arg, context)).join(", ")})`;
      }
      return `${PG_ALIAS}.Function.call(${renderStringLiteral(name)}${args.length === 0 ? "" : `, ${args.map((arg) => renderSqlExpressionCode(arg, context)).join(", ")}`})`;
    }
    case "binary": {
      const op = expression.op;
      if (op === "=" && expression.right.type === "call" && (expression.right.function.name ?? "").toLowerCase() === "any") {
        const anyArgs = Array.isArray(expression.right.args) ? expression.right.args : [];
        if (anyArgs.length === 1 && anyArgs[0]?.type === "array") {
          const arrayValues = anyArgs[0].expressions.map((item) => renderSqlExpressionCode(item, context));
          return `${PG_ALIAS}.Query.in(${renderSqlExpressionCode(expression.left, context)}, ${arrayValues.join(", ")})`;
        }
      }
      const left = renderSqlExpressionCode(expression.left, context);
      const right = renderSqlExpressionCode(expression.right, context);
      switch (op) {
        case "=":
          return `${PG_ALIAS}.Query.eq(${left}, ${right})`;
        case "!=":
        case "<>":
          return `${PG_ALIAS}.Query.neq(${left}, ${right})`;
        case "<":
          return `${PG_ALIAS}.Query.lt(${left}, ${right})`;
        case "<=":
          return `${PG_ALIAS}.Query.lte(${left}, ${right})`;
        case ">":
          return `${PG_ALIAS}.Query.gt(${left}, ${right})`;
        case ">=":
          return `${PG_ALIAS}.Query.gte(${left}, ${right})`;
        case "AND":
        case "and":
          return `${PG_ALIAS}.Query.and(${left}, ${right})`;
        case "OR":
        case "or":
          return `${PG_ALIAS}.Query.or(${left}, ${right})`;
        case "LIKE":
        case "like":
          return `${PG_ALIAS}.Query.like(${left}, ${right})`;
        case "ILIKE":
        case "ilike":
          return `${PG_ALIAS}.Query.ilike(${left}, ${right})`;
        case "~":
          return `${PG_ALIAS}.Query.regexMatch(${left}, ${right})`;
        case "~*":
          return `${PG_ALIAS}.Query.regexIMatch(${left}, ${right})`;
        case "!~":
          return `${PG_ALIAS}.Query.regexNotMatch(${left}, ${right})`;
        case "!~*":
          return `${PG_ALIAS}.Query.regexNotIMatch(${left}, ${right})`;
        case "?": {
          const key = extractStringLiteral(expression.right);
          if (key === undefined) {
            throw new Error("Unsupported PostgreSQL expression: jsonb key predicate requires a literal string key");
          }
          return `${PG_ALIAS}.Function.jsonb.hasKey(${left}, ${renderStringLiteral(key)})`;
        }
        case "?|": {
          const keys = extractStringArrayLiterals(expression.right);
          if (keys === undefined || keys.length === 0) {
            throw new Error("Unsupported PostgreSQL expression: jsonb any-key predicate requires a literal text array");
          }
          return `${PG_ALIAS}.Function.jsonb.hasAnyKeys(${left}, ${keys.map((key) => renderStringLiteral(key)).join(", ")})`;
        }
        case "?&": {
          const keys = extractStringArrayLiterals(expression.right);
          if (keys === undefined || keys.length === 0) {
            throw new Error("Unsupported PostgreSQL expression: jsonb all-keys predicate requires a literal text array");
          }
          return `${PG_ALIAS}.Function.jsonb.hasAllKeys(${left}, ${keys.map((key) => renderStringLiteral(key)).join(", ")})`;
        }
        case "@?":
          return `${PG_ALIAS}.Function.jsonb.pathExists(${left}, ${right})`;
        case "@@":
          return `${PG_ALIAS}.Function.jsonb.pathMatch(${left}, ${right})`;
        case "IS DISTINCT FROM":
          return `${PG_ALIAS}.Query.isDistinctFrom(${left}, ${right})`;
        case "IS NOT DISTINCT FROM":
          return `${PG_ALIAS}.Query.isNotDistinctFrom(${left}, ${right})`;
        case "@>":
          return `${PG_ALIAS}.Query.contains(${left}, ${right})`;
        case "<@":
          return `${PG_ALIAS}.Query.containedBy(${left}, ${right})`;
        case "&&":
          return `${PG_ALIAS}.Query.overlaps(${left}, ${right})`;
      }
      throw new Error(`Unsupported PostgreSQL binary operator in pulled schema: ${expression.op}`);
    }
    case "unary": {
      const operand = renderSqlExpressionCode(expression.operand, context);
      switch (expression.op.toUpperCase()) {
        case "IS NULL":
          return `${PG_ALIAS}.Query.isNull(${operand})`;
        case "IS NOT NULL":
          return `${PG_ALIAS}.Query.isNotNull(${operand})`;
        case "IS TRUE":
          return `${PG_ALIAS}.Query.and(${PG_ALIAS}.Query.isNotNull(${operand}), ${PG_ALIAS}.Query.eq(${operand}, ${PG_ALIAS}.Query.literal(true)))`;
        case "IS FALSE":
          return `${PG_ALIAS}.Query.and(${PG_ALIAS}.Query.isNotNull(${operand}), ${PG_ALIAS}.Query.eq(${operand}, ${PG_ALIAS}.Query.literal(false)))`;
        case "IS NOT TRUE":
          return `${PG_ALIAS}.Query.or(${PG_ALIAS}.Query.isNull(${operand}), ${PG_ALIAS}.Query.eq(${operand}, ${PG_ALIAS}.Query.literal(false)))`;
        case "IS NOT FALSE":
          return `${PG_ALIAS}.Query.or(${PG_ALIAS}.Query.isNull(${operand}), ${PG_ALIAS}.Query.eq(${operand}, ${PG_ALIAS}.Query.literal(true)))`;
        case "IS UNKNOWN":
          return `${PG_ALIAS}.Query.isNull(${operand})`;
        case "IS NOT UNKNOWN":
          return `${PG_ALIAS}.Query.isNotNull(${operand})`;
        case "NOT":
          return `${PG_ALIAS}.Query.not(${operand})`;
      }
      throw new Error(`Unsupported PostgreSQL unary operator in pulled schema: ${expression.op}`);
    }
    case "array": {
      const values = Array.isArray(expression.expressions) ? expression.expressions : [];
      return values.length === 0 ? `${PG_ALIAS}.Function.call("array")` : `${PG_ALIAS}.Function.call("array", ${values.map((item) => renderSqlExpressionCode(item, context)).join(", ")})`;
    }
    case "case": {
      const whens = Array.isArray(expression.whens) ? expression.whens : [];
      if (whens.length === 0) {
        throw new Error("Unsupported PostgreSQL case expression in pulled schema");
      }
      const base = expression.value === null ? `${PG_ALIAS}.Query.case()` : expression.value === undefined ? `${PG_ALIAS}.Query.case()` : `${PG_ALIAS}.Query.match(${renderSqlExpressionCode(expression.value, context)})`;
      const chained = whens.reduce((acc, branch) => `${acc}.when(${renderSqlExpressionCode(branch.when, context)}, ${renderSqlExpressionCode(branch.value, context)})`, base);
      return expression.else == null ? `${chained}.else(${PG_ALIAS}.Query.literal(null))` : `${chained}.else(${renderSqlExpressionCode(expression.else, context)})`;
    }
    case "extract":
      return `${PG_ALIAS}.Function.call("extract", ${renderStringLiteral(expression.field.name)}, ${renderSqlExpressionCode(expression.from, context)})`;
    default:
      throw new Error(`Unsupported PostgreSQL expression in pulled schema: ${expression.type}`);
  }
};
var renderDdlExpressionCode = (sql, context) => renderSqlExpressionCode(parse(sql, "expr"), context);
var columnShapeSignature = (column) => JSON.stringify({
  ddlType: canonicalDdlType(column.ddlType),
  dbTypeKind: canonicalDdlType(column.dbTypeKind),
  typeSchema: column.typeSchema ?? null,
  typeKind: column.typeKind ?? null,
  nullable: column.nullable,
  hasDefault: column.hasDefault,
  generated: column.generated,
  defaultSql: column.defaultSql ?? null,
  generatedSql: column.generatedSql ?? null,
  identity: column.identity ?? null
});
var constraintShapeSignature = (option) => {
  switch (option.kind) {
    case "primaryKey":
      return JSON.stringify({
        kind: option.kind,
        columns: option.columns,
        deferrable: option.deferrable ?? false,
        initiallyDeferred: option.initiallyDeferred ?? false
      });
    case "unique":
      return JSON.stringify({
        kind: option.kind,
        columns: option.columns,
        nullsNotDistinct: option.nullsNotDistinct ?? false,
        deferrable: option.deferrable ?? false,
        initiallyDeferred: option.initiallyDeferred ?? false
      });
    case "foreignKey": {
      const reference = option.references();
      return JSON.stringify({
        kind: option.kind,
        columns: option.columns,
        referencedSchemaName: reference.schemaName ?? "public",
        referencedTableName: reference.tableName,
        referencedColumns: reference.columns,
        onUpdate: option.onUpdate ?? null,
        onDelete: option.onDelete ?? null,
        deferrable: option.deferrable ?? false,
        initiallyDeferred: option.initiallyDeferred ?? false
      });
    }
    case "check":
      return JSON.stringify({
        kind: option.kind,
        predicate: normalizeDdlExpressionSql(option.predicate),
        noInherit: option.noInherit ?? false
      });
  }
};
var indexShapeSignature = (option) => {
  const keys = option.keys ?? (option.columns ?? []).map((column) => ({
    kind: "column",
    column
  }));
  return JSON.stringify({
    kind: option.kind,
    unique: option.unique ?? false,
    method: option.method ?? null,
    include: option.include ?? [],
    predicate: option.predicate ? normalizeDdlExpressionSql(option.predicate) : null,
    keys: keys.map((key) => key.kind === "column" ? {
      kind: key.kind,
      column: key.column,
      order: key.order ?? null,
      nulls: key.nulls ?? null
    } : {
      kind: key.kind,
      expression: normalizeDdlExpressionSql(key.expression),
      order: key.order ?? null,
      nulls: key.nulls ?? null
    })
  });
};
var tableShapeSignature = (table) => JSON.stringify({
  schemaName: table.schemaName ?? "public",
  columns: table.columns.map((column) => columnShapeSignature(column)),
  options: table.options.map((option) => option.kind === "index" ? indexShapeSignature(option) : constraintShapeSignature(option)).sort()
});
var enumShapeSignature = (enumType) => JSON.stringify({
  schemaName: enumType.schemaName ?? "public",
  values: enumType.values
});
var schemaNameOfTable = (table) => table.schemaName ?? "public";
var schemaNameOfEnum = (enumType) => enumType.schemaName ?? "public";
var inferKindFromDdl = (ddlType) => {
  return inferPostgresTypeKind(ddlType);
};
var inferSchemaNameFromDdl = (ddlType) => {
  const withoutParams = ddlType.trim().replace(/\(.+\)$/, "").replace(/\[\]$/, "");
  const match = /^(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_$]*))\.(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_$]*))$/.exec(withoutParams);
  if (match === null) {
    return;
  }
  return match[1] ?? match[2];
};
var runtimeTagOfColumn = (column) => {
  if (normalizeType(column.ddlType).endsWith("[]")) {
    return "array";
  }
  if (column.typeKind === "e") {
    return "string";
  }
  return Datatypes.postgresDatatypeKinds[column.dbTypeKind]?.runtime;
};
var schemaExpressionForRuntimeTag = (runtimeTag) => {
  switch (runtimeTag) {
    case "string":
    case "bigintString":
    case "localDate":
    case "localTime":
    case "offsetTime":
    case "localDateTime":
    case "instant":
    case "decimalString":
    case "year":
      return `${SCHEMA_ALIAS}.String`;
    case "number":
      return `${SCHEMA_ALIAS}.Number`;
    case "boolean":
      return `${SCHEMA_ALIAS}.Boolean`;
    default:
      return `${SCHEMA_ALIAS}.Unknown`;
  }
};
var makeDerivedColumn = (column, context, ddlType) => {
  const schemaName = inferSchemaNameFromDdl(ddlType) ?? column.typeSchema;
  const dbTypeKind = inferKindFromDdl(ddlType);
  return {
    ...column,
    ddlType,
    dbTypeKind,
    typeSchema: schemaName,
    typeKind: context.enumKeys.has(enumKey(schemaName, dbTypeKind)) ? "e" : undefined
  };
};
var renderDbTypeDescriptor = (column, context) => {
  const normalizedDdl = normalizeType(column.ddlType);
  if (normalizedDdl.endsWith("[]")) {
    const elementDdl = column.ddlType.trim().slice(0, -2);
    return `{
  dialect: "postgres",
  kind: ${renderStringLiteral(normalizedDdl)},
  element: ${renderDbTypeDescriptor(makeDerivedColumn(column, context, elementDdl), context)}
}`;
  }
  if (column.typeKind === "e" || context.enumKeys.has(enumKey(column.typeSchema, column.dbTypeKind))) {
    return `{
  dialect: "postgres",
  kind: ${renderStringLiteral(column.dbTypeKind)},
  variant: "enum"
}`;
  }
  return `{
  dialect: "postgres",
  kind: ${renderStringLiteral(column.dbTypeKind)}
}`;
};
var renderColumnBase = (column, context) => {
  const normalizeArrayType = (value) => {
    let current = normalizeType(value);
    let arrayDepth2 = 0;
    while (current.endsWith("[]")) {
      current = current.slice(0, -2);
      arrayDepth2 += 1;
    }
    return { baseType: current, arrayDepth: arrayDepth2 };
  };
  const effectiveDdlType = column.ddlType ?? column.dbTypeKind;
  const { baseType, arrayDepth } = normalizeArrayType(effectiveDdlType);
  if (arrayDepth > 0) {
    const baseColumn = {
      ...column,
      ddlType: baseType,
      dbTypeKind: inferKindFromDdl(baseType),
      typeSchema: inferSchemaNameFromDdl(baseType) ?? column.typeSchema,
      typeKind: inferSchemaNameFromDdl(baseType) !== undefined && context.enumKeys.has(enumKey(inferSchemaNameFromDdl(baseType), inferKindFromDdl(baseType))) ? "e" : column.typeKind
    };
    const base = renderColumnBase(baseColumn, context);
    return {
      code: base.code,
      defaultDdlType: base.defaultDdlType === undefined ? `${baseType}${"[]".repeat(arrayDepth)}` : `${base.defaultDdlType}${"[]".repeat(arrayDepth)}`,
      arrayDepth
    };
  }
  const sizedTextLength = (kind) => {
    const match = new RegExp(`^${kind}\\((\\d+)\\)$`).exec(baseType);
    if (match !== null) {
      return Number(match[1]);
    }
    if (kind === "char" && (baseType === "char" || baseType === "character" || baseType === "bpchar")) {
      return 1;
    }
    return;
  };
  const numericConfig = () => {
    const match = /^numeric\((\d+)(?:,\s*(\d+))?\)$/.exec(baseType);
    if (match === null) {
      return;
    }
    return {
      precision: Number(match[1]),
      scale: match[2] === undefined ? undefined : Number(match[2])
    };
  };
  if (baseType === "jsonb" || normalizeType(column.dbTypeKind) === "jsonb") {
    return {
      code: `${COLUMN_ALIAS}.jsonb(${SCHEMA_ALIAS}.Unknown)`,
      defaultDdlType: "jsonb"
    };
  }
  if (column.typeKind === "e") {
    return {
      code: `${COLUMN_ALIAS}.custom(${SCHEMA_ALIAS}.String, ${renderDbTypeDescriptor(column, context)})`
    };
  }
  switch (column.dbTypeKind) {
    case "uuid":
      return { code: `${COLUMN_ALIAS}.uuid()`, defaultDdlType: "uuid" };
    case "text":
      return { code: `${COLUMN_ALIAS}.text()`, defaultDdlType: "text" };
    case "varchar": {
      const length = sizedTextLength("varchar");
      return length === undefined ? { code: `${COLUMN_ALIAS}.varchar()`, defaultDdlType: "varchar" } : { code: `${COLUMN_ALIAS}.varchar(${length})`, defaultDdlType: `varchar(${length})` };
    }
    case "char": {
      const length = sizedTextLength("char") ?? 1;
      return { code: `${COLUMN_ALIAS}.char(${length})`, defaultDdlType: `char(${length})` };
    }
    case "int2":
      return { code: `${COLUMN_ALIAS}.int2()`, defaultDdlType: "int2" };
    case "int4":
      return { code: `${COLUMN_ALIAS}.int()`, defaultDdlType: "int4" };
    case "int8":
      return { code: `${COLUMN_ALIAS}.int8()`, defaultDdlType: "int8" };
    case "numeric": {
      const config = numericConfig();
      return config === undefined ? { code: `${COLUMN_ALIAS}.number()`, defaultDdlType: "numeric" } : {
        code: config.scale === undefined ? `${COLUMN_ALIAS}.number({ precision: ${config.precision} })` : `${COLUMN_ALIAS}.number({ precision: ${config.precision}, scale: ${config.scale} })`,
        defaultDdlType: config.scale === undefined ? `numeric(${config.precision})` : `numeric(${config.precision},${config.scale})`
      };
    }
    case "float4":
      return { code: `${COLUMN_ALIAS}.float4()`, defaultDdlType: "float4" };
    case "float8":
      return { code: `${COLUMN_ALIAS}.float8()`, defaultDdlType: "float8" };
    case "bool":
      return { code: `${COLUMN_ALIAS}.boolean()`, defaultDdlType: "bool" };
    case "date":
      return { code: `${COLUMN_ALIAS}.date()`, defaultDdlType: "date" };
    case "time":
      return { code: `${COLUMN_ALIAS}.time()`, defaultDdlType: "time" };
    case "timetz":
      return { code: `${COLUMN_ALIAS}.timetz()`, defaultDdlType: "timetz" };
    case "timestamp":
      return { code: `${COLUMN_ALIAS}.timestamp()`, defaultDdlType: "timestamp" };
    case "timestamptz":
      return { code: `${COLUMN_ALIAS}.timestamptz()`, defaultDdlType: "timestamptz" };
    case "interval":
      return { code: `${COLUMN_ALIAS}.interval()`, defaultDdlType: "interval" };
    case "bytea":
      return { code: `${COLUMN_ALIAS}.bytea()`, defaultDdlType: "bytea" };
    case "json":
      return { code: `${COLUMN_ALIAS}.json(${SCHEMA_ALIAS}.Unknown)`, defaultDdlType: "json" };
    case "name":
      return { code: `${COLUMN_ALIAS}.name()`, defaultDdlType: "name" };
    case "oid":
      return { code: `${COLUMN_ALIAS}.oid()`, defaultDdlType: "oid" };
    case "regclass":
      return { code: `${COLUMN_ALIAS}.regclass()`, defaultDdlType: "regclass" };
    case "bit":
      return { code: `${COLUMN_ALIAS}.bit()`, defaultDdlType: "bit" };
    case "varbit":
      return { code: `${COLUMN_ALIAS}.varbit()`, defaultDdlType: "varbit" };
    case "xml":
      return { code: `${COLUMN_ALIAS}.xml()`, defaultDdlType: "xml" };
    case "pg_lsn":
      return { code: `${COLUMN_ALIAS}.pg_lsn()`, defaultDdlType: "pg_lsn" };
    default:
      return {
        code: `${COLUMN_ALIAS}.custom(${schemaExpressionForRuntimeTag(runtimeTagOfColumn(column))}, ${renderDbTypeDescriptor(column, context)})`
      };
  }
};
var renderExpressionContext = (table, context) => ({
  columnByName: new Map(table.columns.map((column) => [column.name, column])),
  enumKeys: context.enumKeys
});
var renderColumnDefinition2 = (table, column, context, inlinePrimaryKey) => {
  const base = renderColumnBase(column, context);
  const expressionContext = renderExpressionContext(table, context);
  const pipes = base.arrayDepth === undefined ? [] : Array.from({ length: base.arrayDepth }, () => `${COLUMN_ALIAS}.array()`);
  if (base.defaultDdlType === undefined || canonicalDdlType(column.ddlType) !== canonicalDdlType(base.defaultDdlType)) {
    pipes.push(`${COLUMN_ALIAS}.ddlType(${renderStringLiteral(column.ddlType)})`);
  }
  if (column.nullable) {
    pipes.push(`${COLUMN_ALIAS}.nullable`);
  }
  if (inlinePrimaryKey) {
    pipes.push(`${COLUMN_ALIAS}.primaryKey`);
  }
  if (column.identity) {
    pipes.push(column.identity.generation === "always" ? `${COLUMN_ALIAS}.identityAlways` : `${COLUMN_ALIAS}.identityByDefault`);
  } else if (column.generatedSql) {
    pipes.push(`${COLUMN_ALIAS}.generated(${renderDdlExpressionCode(column.generatedSql, expressionContext)})`);
  } else if (column.defaultSql) {
    pipes.push(`${COLUMN_ALIAS}.default(${renderDdlExpressionCode(column.defaultSql, expressionContext)})`);
  }
  return pipes.length === 0 ? base.code : `${base.code}.pipe(${pipes.join(", ")})`;
};
var renderIndexKey = (key, table, context) => key.kind === "column" ? `{ column: ${renderStringLiteral(key.column)}${key.order ? `, order: ${renderStringLiteral(key.order)}` : ""}${key.nulls ? `, nulls: ${renderStringLiteral(key.nulls)}` : ""} }` : `{ expression: ${renderDdlExpressionCode(renderDdlExpressionSql(key.expression), renderExpressionContext(table, context))}${key.order ? `, order: ${renderStringLiteral(key.order)}` : ""}${key.nulls ? `, nulls: ${renderStringLiteral(key.nulls)}` : ""} }`;
var renderIndexOption = (table, option, context) => {
  const simple = option.name === undefined && option.unique === undefined && option.method === undefined && option.include === undefined && option.predicate === undefined && option.keys === undefined && option.columns !== undefined;
  if (simple) {
    return `${TABLE_ALIAS}.index(${renderStringTuple(option.columns)})`;
  }
  const parts = [];
  if (option.columns) {
    parts.push(`columns: ${renderStringTuple(option.columns)}`);
  }
  if (option.keys) {
    parts.push(`keys: [${option.keys.map((key) => renderIndexKey(key, table, context)).join(", ")}] as const`);
  }
  if (option.name) {
    parts.push(`name: ${renderStringLiteral(option.name)}`);
  }
  if (option.unique !== undefined) {
    parts.push(`unique: ${String(option.unique)}`);
  }
  if (option.method) {
    parts.push(`method: ${renderStringLiteral(option.method)}`);
  }
  if (option.include && option.include.length > 0) {
    parts.push(`include: [${option.include.map(renderStringLiteral).join(", ")}] as const`);
  }
  if (option.predicate) {
    parts.push(`predicate: ${renderDdlExpressionCode(renderDdlExpressionSql(option.predicate), renderExpressionContext(table, context))}`);
  }
  return `${TABLE_ALIAS}.index({ ${parts.join(", ")} })`;
};
var renderTableOption = (table, option, context) => {
  switch (option.kind) {
    case "primaryKey": {
      const simple = option.name === undefined && option.deferrable === undefined && option.initiallyDeferred === undefined;
      return simple ? `${TABLE_ALIAS}.primaryKey(${renderStringTuple(option.columns)})` : `${TABLE_ALIAS}.primaryKey({ columns: ${renderStringTuple(option.columns)}${option.name ? `, name: ${renderStringLiteral(option.name)}` : ""}${option.deferrable !== undefined ? `, deferrable: ${String(option.deferrable)}` : ""}${option.initiallyDeferred !== undefined ? `, initiallyDeferred: ${String(option.initiallyDeferred)}` : ""} })`;
    }
    case "unique": {
      const simple = option.name === undefined && option.nullsNotDistinct === undefined && option.deferrable === undefined && option.initiallyDeferred === undefined;
      return simple ? `${TABLE_ALIAS}.unique(${renderStringTuple(option.columns)})` : `${TABLE_ALIAS}.unique({ columns: ${renderStringTuple(option.columns)}${option.name ? `, name: ${renderStringLiteral(option.name)}` : ""}${option.nullsNotDistinct !== undefined ? `, nullsNotDistinct: ${String(option.nullsNotDistinct)}` : ""}${option.deferrable !== undefined ? `, deferrable: ${String(option.deferrable)}` : ""}${option.initiallyDeferred !== undefined ? `, initiallyDeferred: ${String(option.initiallyDeferred)}` : ""} })`;
    }
    case "index":
      return renderIndexOption(table, option, context);
    case "foreignKey": {
      const reference = option.references();
      const targetKey = tableKey(reference.schemaName, reference.tableName);
      const target = context.bindingByKey.get(targetKey);
      if (target === undefined || target.kind !== "table") {
        throw new Error(`Cannot render foreign key from ${tableKey(table.schemaName, table.name)} to missing source table '${targetKey}'`);
      }
      return `${TABLE_ALIAS}.foreignKey({ columns: ${renderStringTuple(option.columns)}, target: () => ${target.declaration.identifier}, referencedColumns: ${renderStringTuple(reference.columns)}${option.name ? `, name: ${renderStringLiteral(option.name)}` : ""}${option.onUpdate ? `, onUpdate: ${renderStringLiteral(option.onUpdate)}` : ""}${option.onDelete ? `, onDelete: ${renderStringLiteral(option.onDelete)}` : ""}${option.deferrable !== undefined ? `, deferrable: ${String(option.deferrable)}` : ""}${option.initiallyDeferred !== undefined ? `, initiallyDeferred: ${String(option.initiallyDeferred)}` : ""} })`;
    }
    case "check":
      return option.noInherit ? `${TABLE_ALIAS}.check({ name: ${renderStringLiteral(option.name)}, predicate: ${renderDdlExpressionCode(renderDdlExpressionSql(option.predicate), renderExpressionContext(table, context))}, noInherit: true })` : `${TABLE_ALIAS}.check(${renderStringLiteral(option.name)}, ${renderDdlExpressionCode(renderDdlExpressionSql(option.predicate), renderExpressionContext(table, context))})`;
  }
};
var inlinePrimaryKeyColumn = (declaration, table) => {
  if (declaration.kind !== "tableClass") {
    return;
  }
  const primaryKeys = table.options.filter((option) => option.kind === "primaryKey");
  if (primaryKeys.length === 0) {
    return;
  }
  if (primaryKeys.length > 1) {
    throw new Error(`Class table '${tableKey(table.schemaName, table.name)}' has multiple primary-key declarations`);
  }
  const primaryKey = primaryKeys[0];
  const defaultName = defaultConstraintName(table, primaryKey);
  if (primaryKey.columns.length !== 1 || primaryKey.name !== undefined && primaryKey.name !== defaultName || primaryKey.deferrable || primaryKey.initiallyDeferred) {
    throw new Error(`Class table '${tableKey(table.schemaName, table.name)}' cannot represent its primary key inline`);
  }
  return primaryKey.columns[0];
};
var renderFieldBlock = (declaration, table, context) => {
  const inlinePrimaryKey = inlinePrimaryKeyColumn(declaration, table);
  return `{
${table.columns.map((column) => `  ${renderPropertyKey(column.name)}: ${renderColumnDefinition2(table, column, context, inlinePrimaryKey === column.name)}`).join(`,
`)}
}`;
};
var renderTableDeclaration = (declaration, table, context) => {
  const inlinePrimaryKey = inlinePrimaryKeyColumn(declaration, table);
  const tableOptions = table.options.filter((option) => !(declaration.kind === "tableClass" && option.kind === "primaryKey" && inlinePrimaryKey !== undefined));
  const renderedOptions = tableOptions.map((option) => renderTableOption(table, option, context));
  const fields = renderFieldBlock(declaration, table, context);
  const nameLiteral = renderStringLiteral(table.name);
  const schemaLiteral = table.schemaName && table.schemaName !== "public" ? `, ${renderStringLiteral(table.schemaName)}` : "";
  switch (declaration.kind) {
    case "tableFactory":
      return renderedOptions.length === 0 ? `const ${declaration.identifier} = ${TABLE_ALIAS}.make(${nameLiteral}, ${fields}${schemaLiteral})` : `const ${declaration.identifier} = ${TABLE_ALIAS}.make(${nameLiteral}, ${fields}${schemaLiteral}).pipe(
${indent(renderedOptions.join(`,
`))}
)`;
    case "tableSchema":
      return renderedOptions.length === 0 ? `const ${declaration.identifier} = ${declaration.schemaBuilderIdentifier}.table(${nameLiteral}, ${fields})` : `const ${declaration.identifier} = ${declaration.schemaBuilderIdentifier}.table(
${indent([nameLiteral, fields, ...renderedOptions].join(`,
`))}
)`;
    case "tableClass": {
      const head = `class ${declaration.identifier} extends ${TABLE_ALIAS}.Class<${declaration.identifier}>(${nameLiteral}${schemaLiteral})(${fields})`;
      if (renderedOptions.length === 0) {
        return `${head} {}`;
      }
      return `${head} {
${indent(`static readonly [${TABLE_ALIAS}.options] = [
${indent(renderedOptions.join(`,
`))}
]`)}
}`;
    }
    default:
      throw new Error(`Cannot render table declaration for kind '${declaration.kind}'`);
  }
};
var renderTableAdditionBase = (declaration, table, context) => {
  const inlinePrimaryKey = inlinePrimaryKeyColumn(declaration, table);
  const hasForeignKeys = table.options.some((option) => option.kind === "foreignKey");
  const tableOptions = table.options.filter((option) => option.kind !== "foreignKey" && !(declaration.kind === "tableClass" && option.kind === "primaryKey" && inlinePrimaryKey !== undefined));
  const renderedOptions = tableOptions.map((option) => renderTableOption(table, option, context));
  const fields = renderFieldBlock(declaration, table, context);
  const nameLiteral = renderStringLiteral(table.name);
  const schemaLiteral = table.schemaName && table.schemaName !== "public" ? `, ${renderStringLiteral(table.schemaName)}` : "";
  switch (declaration.kind) {
    case "tableFactory": {
      const head = `${hasForeignKeys ? "let" : "const"} ${declaration.identifier} = ${TABLE_ALIAS}.make(${nameLiteral}, ${fields}${schemaLiteral})`;
      return renderedOptions.length === 0 ? head : `${head}.pipe(
${indent(renderedOptions.join(`,
`))}
)`;
    }
    case "tableClass":
      return renderTableDeclaration(declaration, table, context);
    case "tableSchema": {
      const head = `${hasForeignKeys ? "let" : "const"} ${declaration.identifier} = ${declaration.schemaBuilderIdentifier}.table(${nameLiteral}, ${fields})`;
      return renderedOptions.length === 0 ? head : `${head}.pipe(
${indent(renderedOptions.join(`,
`))}
)`;
    }
    default:
      throw new Error(`Cannot render table declaration for kind '${declaration.kind}'`);
  }
};
var renderTableForeignKeyUpdate = (declaration, table, context) => {
  const foreignKeys = table.options.filter((option) => option.kind === "foreignKey");
  if (foreignKeys.length === 0) {
    return;
  }
  return `${declaration.identifier} = ${declaration.identifier}.pipe(
${indent(foreignKeys.map((option) => renderTableOption(table, option, context)).join(`,
`))}
)`;
};
var renderEnumDeclaration = (declaration, enumType) => {
  const values = renderStringTuple(enumType.values);
  switch (declaration.kind) {
    case "enumFactory":
      return `const ${declaration.identifier} = ${PG_ALIAS}.schema(${renderStringLiteral(enumType.schemaName ?? "public")}).enum(${renderStringLiteral(enumType.name)}, ${values})`;
    case "enumSchema":
      return `const ${declaration.identifier} = ${declaration.schemaBuilderIdentifier}.enum(${renderStringLiteral(enumType.name)}, ${values})`;
    default:
      throw new Error(`Cannot render enum declaration for kind '${declaration.kind}'`);
  }
};
var ensureImports = (contents) => {
  const cleaned = contents.replace(/^import \* as [A-Za-z0-9_$]+ from "effect-qb\/postgres"\n?/gm, "").replace(/^import \{[^}]+\} from "effect-qb\/postgres"\n?/gm, "").replace(/^import \* as [A-Za-z0-9_$]+ from "effect\/Schema"\n?/gm, "").trimStart();
  const required = [
    `import * as ${PG_ALIAS} from "effect-qb/postgres"`,
    `import { ${TABLE_ALIAS}, ${COLUMN_ALIAS} } from "effect-qb/postgres"`,
    `import * as ${SCHEMA_ALIAS} from "effect/Schema"`
  ];
  const missing = required.filter((line) => !cleaned.includes(line));
  if (missing.length === 0) {
    return cleaned;
  }
  return `${missing.join(`
`)}
${cleaned}`;
};
var sanitizeIdentifier = (value) => {
  const normalized = value.trim().replace(/[^A-Za-z0-9_$]+/g, "_").replace(/^_+|_+$/g, "");
  if (normalized.length === 0) {
    return "item";
  }
  return /^[A-Za-z_$]/.test(normalized) ? normalized : `_${normalized}`;
};
var uniqueIdentifier = (preferred, used) => {
  const base = sanitizeIdentifier(preferred);
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let index = 2;
  while (used.has(`${base}_${index}`)) {
    index += 1;
  }
  const identifier = `${base}_${index}`;
  used.add(identifier);
  return identifier;
};
var inferSourceRoot = (cwd, includes) => {
  const first = includes[0] ?? "src/**/*.ts";
  const wildcard = first.search(/[*?{\[]/);
  const prefix = wildcard === -1 ? first : first.slice(0, wildcard);
  if (prefix.length === 0) {
    return cwd;
  }
  if (prefix.endsWith("/")) {
    return resolve3(cwd, prefix);
  }
  if (extname(prefix).length > 0) {
    return resolve3(cwd, dirname2(prefix));
  }
  return resolve3(cwd, prefix);
};
var renderDeclaredModule = (original, declarations, exportNames) => {
  const declarationBlock = declarations.join(`

`);
  if (!original.includes("export {")) {
    const body2 = declarationBlock.length > 0 ? `${declarationBlock}
export { ${exportNames.join(", ")} }` : `export { ${exportNames.join(", ")} }`;
    return ensureImports(body2);
  }
  const exportIndex = original.lastIndexOf("export {");
  const beforeExport = original.slice(0, exportIndex).trimEnd();
  const exportLine = original.slice(exportIndex).trim();
  const match = /^export\s*\{([^}]*)\}/.exec(exportLine);
  if (match === null) {
    const body2 = declarationBlock.length > 0 ? `${original.trimEnd()}
${declarationBlock}
export { ${exportNames.join(", ")} }` : original.trimEnd();
    return ensureImports(body2);
  }
  const existingNames = match[1].split(",").map((value) => value.trim()).filter((value) => value.length > 0);
  const merged = [...new Set([...existingNames, ...exportNames])];
  const replacement = `export { ${merged.join(", ")} }`;
  const body = declarationBlock.length > 0 ? `${beforeExport}
${declarationBlock}
${replacement}` : `${beforeExport}
${replacement}`;
  return ensureImports(body);
};
var planPostgresPull = async (cwd, source, discovered, database) => {
  const bindingByKey = new Map(discovered.bindings.map((binding) => [binding.key, binding]));
  const databaseTablesByKey = new Map(database.tables.map((table) => [tableKey(table.schemaName, table.name), table]));
  const databaseEnumsByKey = new Map(database.enums.map((enumType) => [enumKey(enumType.schemaName, enumType.name), enumType]));
  const context = {
    bindingByKey,
    enumKeys: new Set(databaseEnumsByKey.keys())
  };
  const sourceRoot = inferSourceRoot(cwd, source.include);
  const schemaFilePathByName = new Map;
  for (const binding of discovered.bindings) {
    const schemaName = binding.kind === "table" ? schemaNameOfTable(toTableModel(binding.value)) : schemaNameOfEnum(toEnumModel(binding.value));
    if (!schemaFilePathByName.has(schemaName)) {
      schemaFilePathByName.set(schemaName, binding.declaration.filePath);
    }
  }
  const matchedSourceBindings = new Set;
  const matchedDbTableKeys = new Set;
  const matchedDbEnumKeys = new Set;
  const filePlans = new Map;
  const ensureFilePlan = async (filePath) => {
    const existing = filePlans.get(filePath);
    if (existing !== undefined) {
      return existing;
    }
    const original = await Bun.file(filePath).exists() ? await Bun.file(filePath).text() : "";
    const created = {
      original,
      replacements: [],
      additions: []
    };
    filePlans.set(filePath, created);
    return created;
  };
  const scheduleReplacement = async (binding, model) => {
    const plan = await ensureFilePlan(binding.declaration.filePath);
    plan.replacements.push(binding);
    bindingByKey.set(binding.key, binding);
  };
  for (const [key, table] of databaseTablesByKey) {
    const binding = bindingByKey.get(key);
    if (binding !== undefined && binding.kind === "table") {
      matchedSourceBindings.add(binding);
      matchedDbTableKeys.add(key);
      await scheduleReplacement(binding, table);
    }
  }
  for (const [key, enumType] of databaseEnumsByKey) {
    const binding = bindingByKey.get(key);
    if (binding !== undefined && binding.kind === "enum") {
      matchedSourceBindings.add(binding);
      matchedDbEnumKeys.add(key);
      await scheduleReplacement(binding, enumType);
    }
  }
  const renameTablePairs = pairUniqueBySignature(discovered.bindings.filter((binding) => binding.kind === "table" && !matchedSourceBindings.has(binding)), database.tables.filter((table) => !matchedDbTableKeys.has(tableKey(table.schemaName, table.name))), (binding) => tableShapeSignature(toTableModel(binding.value)), (table) => tableShapeSignature(table));
  for (const { source: binding, db: table } of renameTablePairs) {
    matchedSourceBindings.add(binding);
    matchedDbTableKeys.add(tableKey(table.schemaName, table.name));
    await scheduleReplacement(binding, table);
  }
  const renameEnumPairs = pairUniqueBySignature(discovered.bindings.filter((binding) => binding.kind === "enum" && !matchedSourceBindings.has(binding)), database.enums.filter((enumType) => !matchedDbEnumKeys.has(enumKey(enumType.schemaName, enumType.name))), (binding) => enumShapeSignature(toEnumModel(binding.value)), (enumType) => enumShapeSignature(enumType));
  for (const { source: binding, db: enumType } of renameEnumPairs) {
    matchedSourceBindings.add(binding);
    matchedDbEnumKeys.add(enumKey(enumType.schemaName, enumType.name));
    await scheduleReplacement(binding, enumType);
  }
  const newBindingsByFile = new Map;
  for (const table of database.tables) {
    const key = tableKey(table.schemaName, table.name);
    if (matchedDbTableKeys.has(key)) {
      continue;
    }
    const sourceBinding = discovered.bindings.find((binding) => binding.kind === "table" && !matchedSourceBindings.has(binding) && tableShapeSignature(toTableModel(binding.value)) === tableShapeSignature(table));
    if (sourceBinding !== undefined) {
      matchedSourceBindings.add(sourceBinding);
      matchedDbTableKeys.add(key);
      await scheduleReplacement(sourceBinding, table);
      continue;
    }
    const schemaName = schemaNameOfTable(table);
    const filePath = schemaFilePathByName.get(schemaName) ?? resolve3(sourceRoot, `${schemaName}.schema.ts`);
    const list = newBindingsByFile.get(filePath) ?? [];
    const declaration = {
      kind: "tableFactory",
      filePath,
      identifier: "",
      start: 0,
      end: 0
    };
    list.push({
      binding: {
        declaration,
        kind: "table",
        key,
        value: table
      },
      model: table
    });
    newBindingsByFile.set(filePath, list);
  }
  for (const enumType of database.enums) {
    const key = enumKey(enumType.schemaName, enumType.name);
    if (matchedDbEnumKeys.has(key)) {
      continue;
    }
    const sourceBinding = discovered.bindings.find((binding) => binding.kind === "enum" && !matchedSourceBindings.has(binding) && enumShapeSignature(toEnumModel(binding.value)) === enumShapeSignature(enumType));
    if (sourceBinding !== undefined) {
      matchedSourceBindings.add(sourceBinding);
      matchedDbEnumKeys.add(key);
      await scheduleReplacement(sourceBinding, enumType);
      continue;
    }
    const schemaName = schemaNameOfEnum(enumType);
    const filePath = schemaFilePathByName.get(schemaName) ?? resolve3(sourceRoot, `${schemaName}.schema.ts`);
    const list = newBindingsByFile.get(filePath) ?? [];
    const declaration = {
      kind: "enumFactory",
      filePath,
      identifier: "",
      start: 0,
      end: 0
    };
    list.push({
      binding: {
        declaration,
        kind: "enum",
        key,
        value: enumType
      },
      model: enumType
    });
    newBindingsByFile.set(filePath, list);
  }
  for (const [filePath, additions] of newBindingsByFile) {
    const plan = await ensureFilePlan(filePath);
    plan.additions.push(...additions);
  }
  const updates = [];
  for (const [filePath, plan] of filePlans) {
    let next = ensureImports(plan.original);
    const importOffset = next.length - plan.original.length;
    for (const binding of [...plan.replacements].sort((left, right) => right.declaration.start - left.declaration.start)) {
      const model = binding.kind === "table" ? databaseTablesByKey.get(binding.key) ?? (() => {
        throw new Error(`Missing database table '${binding.key}'`);
      })() : databaseEnumsByKey.get(binding.key) ?? (() => {
        throw new Error(`Missing database enum '${binding.key}'`);
      })();
      const replacement = binding.kind === "table" ? renderTableDeclaration(binding.declaration, model, context) : renderEnumDeclaration(binding.declaration, model);
      const start = binding.declaration.start + importOffset;
      const end = binding.declaration.end + importOffset;
      next = `${next.slice(0, start)}${replacement}${next.slice(end)}`;
    }
    if (plan.additions.length > 0) {
      const usedIdentifiers = new Set(discovered.bindings.filter((binding) => binding.declaration.filePath === filePath).map((binding) => binding.declaration.identifier));
      const syntheticAdditions = plan.additions.map(({ binding, model }, sourceIndex) => {
        const identifier = uniqueIdentifier(binding.kind === "table" ? model.name : model.name, usedIdentifiers);
        return {
          ...binding,
          model,
          sourceIndex,
          declaration: {
            ...binding.declaration,
            identifier
          }
        };
      });
      const syntheticBindings = syntheticAdditions.map(({ model: _model, sourceIndex: _sourceIndex, ...binding }) => binding);
      const combinedBindingByKey = new Map(bindingByKey);
      for (const binding of syntheticBindings) {
        combinedBindingByKey.set(binding.key, binding);
      }
      const combinedEnumKeys = new Set(context.enumKeys);
      for (const binding of syntheticBindings) {
        if (binding.kind === "enum") {
          combinedEnumKeys.add(binding.key);
        }
      }
      const fileContext = {
        bindingByKey: combinedBindingByKey,
        enumKeys: combinedEnumKeys
      };
      const orderedAdditions = sortPulledAdditions(syntheticAdditions);
      const renderedAdditions = [
        ...orderedAdditions.map((binding) => binding.kind === "table" ? renderTableAdditionBase(binding.declaration, binding.model, fileContext) : renderEnumDeclaration(binding.declaration, binding.model)),
        ...orderedAdditions.flatMap((binding) => binding.kind === "table" ? [renderTableForeignKeyUpdate(binding.declaration, binding.model, fileContext)] : []).filter((value) => value !== undefined)
      ];
      next = renderDeclaredModule(next, renderedAdditions, orderedAdditions.map((binding) => binding.declaration.identifier));
    }
    if (next !== plan.original) {
      updates.push({
        filePath,
        before: plan.original,
        after: next
      });
    }
  }
  return {
    updates
  };
};
var applyPullPlan = async (plan) => {
  for (const update of plan.updates) {
    await mkdir2(dirname2(update.filePath), { recursive: true });
    await Bun.write(update.filePath, update.after);
  }
};
var summarizePullPlan = (cwd, plan) => plan.updates.map((update) => `${update.before.length === 0 ? "create" : "update"} ${relative(cwd, update.filePath)}`);

// src/internal/postgres-runtime.ts
import { PgClient } from "@effect/sql-pg";
import * as Effect2 from "effect/Effect";
import * as Redacted from "effect/Redacted";
var providePostgresUrl = (url, effect) => Effect2.provide(effect, PgClient.layer({
  url: Redacted.make(url)
}));
var runPostgresUrl = (url, effect) => Effect2.runPromise(providePostgresUrl(url, effect));

// src/internal/postgres-schema-diff.ts
import { enumKey as enumKey2, tableKey as tableKey2, normalizeDdlExpressionSql as normalizeDdlExpressionSql2 } from "effect-qb/postgres/metadata";
var normalizeSql = (value) => value?.trim().replace(/\s+/g, " ");
var schemaNamesOf = (model) => {
  const schemas = new Set;
  for (const enumType of model.enums) {
    schemas.add(enumType.schemaName ?? "public");
  }
  for (const table of model.tables) {
    schemas.add(table.schemaName ?? "public");
  }
  return schemas;
};
var quoteLiteral = (value) => `'${value.replaceAll("'", "''")}'`;
var effectiveConstraintName = (table, option) => option.name ?? defaultConstraintName(table, option);
var indexKeysOf2 = (option) => option.keys ?? (option.columns ?? []).map((column) => ({
  kind: "column",
  column
}));
var effectiveIndexName = (table, option) => option.name ?? defaultIndexName(table.name, indexKeysOf2(option).map((key) => key.kind === "column" ? key.column : "expr"), option.unique ?? false);
var columnSignature = (column) => JSON.stringify({
  ddlType: canonicalizePostgresTypeName(column.ddlType),
  dbTypeKind: canonicalizePostgresTypeName(column.dbTypeKind),
  nullable: column.nullable,
  hasDefault: column.hasDefault,
  generated: column.generated,
  defaultSql: normalizeSql(column.defaultSql) ?? null,
  generatedSql: normalizeSql(column.generatedSql) ?? null,
  identity: column.identity ?? null
});
var constraintSignature = (table, option) => {
  switch (option.kind) {
    case "primaryKey":
      return JSON.stringify({
        kind: option.kind,
        name: effectiveConstraintName(table, option),
        columns: option.columns,
        deferrable: option.deferrable ?? false,
        initiallyDeferred: option.initiallyDeferred ?? false
      });
    case "unique":
      return JSON.stringify({
        kind: option.kind,
        name: effectiveConstraintName(table, option),
        columns: option.columns,
        nullsNotDistinct: option.nullsNotDistinct ?? false,
        deferrable: option.deferrable ?? false,
        initiallyDeferred: option.initiallyDeferred ?? false
      });
    case "foreignKey": {
      const reference = option.references();
      return JSON.stringify({
        kind: option.kind,
        name: effectiveConstraintName(table, option),
        columns: option.columns,
        referencedSchemaName: reference.schemaName ?? "public",
        referencedTableName: reference.tableName,
        referencedColumns: reference.columns,
        onUpdate: option.onUpdate ?? null,
        onDelete: option.onDelete ?? null,
        deferrable: option.deferrable ?? false,
        initiallyDeferred: option.initiallyDeferred ?? false
      });
    }
    case "check":
      return JSON.stringify({
        kind: option.kind,
        name: effectiveConstraintName(table, option),
        predicate: normalizeDdlExpressionSql2(option.predicate),
        noInherit: option.noInherit ?? false
      });
  }
};
var indexSignature = (table, option) => JSON.stringify({
  kind: option.kind,
  name: effectiveIndexName(table, option),
  unique: option.unique ?? false,
  method: option.method ?? null,
  include: option.include ?? [],
  predicate: option.predicate ? normalizeDdlExpressionSql2(option.predicate) : null,
  keys: indexKeysOf2(option).map((key) => key.kind === "column" ? {
    kind: key.kind,
    column: key.column,
    order: key.order ?? null,
    nulls: key.nulls ?? null
  } : {
    kind: key.kind,
    expression: normalizeDdlExpressionSql2(key.expression),
    order: key.order ?? null,
    nulls: key.nulls ?? null
  })
});
var constraintShapeSignature2 = (option) => {
  switch (option.kind) {
    case "primaryKey":
      return JSON.stringify({
        kind: option.kind,
        columns: option.columns,
        deferrable: option.deferrable ?? false,
        initiallyDeferred: option.initiallyDeferred ?? false
      });
    case "unique":
      return JSON.stringify({
        kind: option.kind,
        columns: option.columns,
        nullsNotDistinct: option.nullsNotDistinct ?? false,
        deferrable: option.deferrable ?? false,
        initiallyDeferred: option.initiallyDeferred ?? false
      });
    case "foreignKey": {
      const reference = option.references();
      return JSON.stringify({
        kind: option.kind,
        columns: option.columns,
        referencedSchemaName: reference.schemaName ?? "public",
        referencedTableName: reference.tableName,
        referencedColumns: reference.columns,
        onUpdate: option.onUpdate ?? null,
        onDelete: option.onDelete ?? null,
        deferrable: option.deferrable ?? false,
        initiallyDeferred: option.initiallyDeferred ?? false
      });
    }
    case "check":
      return JSON.stringify({
        kind: option.kind,
        predicate: normalizeDdlExpressionSql2(option.predicate),
        noInherit: option.noInherit ?? false
      });
  }
};
var indexShapeSignature2 = (option) => JSON.stringify({
  kind: option.kind,
  unique: option.unique ?? false,
  method: option.method ?? null,
  include: option.include ?? [],
  predicate: option.predicate ? normalizeDdlExpressionSql2(option.predicate) : null,
  keys: indexKeysOf2(option).map((key) => key.kind === "column" ? {
    kind: key.kind,
    column: key.column,
    order: key.order ?? null,
    nulls: key.nulls ?? null
  } : {
    kind: key.kind,
    expression: normalizeDdlExpressionSql2(key.expression),
    order: key.order ?? null,
    nulls: key.nulls ?? null
  })
});
var tableShapeSignature2 = (table) => JSON.stringify({
  schemaName: table.schemaName ?? "public",
  columns: table.columns.map((column) => columnSignature(column)),
  options: table.options.map((option) => option.kind === "index" ? indexShapeSignature2(option) : constraintShapeSignature2(option)).sort()
});
var isSafeColumnAddition = (column) => column.nullable || column.hasDefault || column.generated || column.identity !== undefined;
var isSafeConstraintAddition = (option) => option.kind === "primaryKey" || option.kind === "unique" || option.kind === "foreignKey" || option.kind === "check";
var makeChange = (change) => change;
var pairUniqueBySignature2 = (sourceItems, dbItems, sourceSignatureOf, dbSignatureOf) => {
  const sourceBySignature = new Map;
  for (const item of sourceItems) {
    const signature = sourceSignatureOf(item);
    const list = sourceBySignature.get(signature) ?? [];
    list.push(item);
    sourceBySignature.set(signature, list);
  }
  const dbBySignature = new Map;
  for (const item of dbItems) {
    const signature = dbSignatureOf(item);
    const list = dbBySignature.get(signature) ?? [];
    list.push(item);
    dbBySignature.set(signature, list);
  }
  const pairs = [];
  for (const [signature, source] of sourceBySignature) {
    const db = dbBySignature.get(signature);
    if (source.length === 1 && db?.length === 1) {
      pairs.push({
        source: source[0],
        db: db[0]
      });
    }
  }
  return pairs;
};
var diffEnum = (sourceEnum, dbEnum) => {
  const key = enumKey2(sourceEnum.schemaName, sourceEnum.name);
  if (dbEnum === undefined) {
    return [makeChange({
      kind: "createEnum",
      key,
      summary: `create enum ${key}`,
      sql: renderCreateEnum(sourceEnum),
      rollbackSql: renderDropEnum(sourceEnum),
      safe: true,
      destructive: false
    })];
  }
  const sharedPrefix = dbEnum.values.every((value, index) => sourceEnum.values[index] === value);
  if (sharedPrefix && sourceEnum.values.length > dbEnum.values.length) {
    return sourceEnum.values.slice(dbEnum.values.length).map((value) => makeChange({
      kind: "alterEnumAddValue",
      key,
      summary: `add enum value ${quoteLiteral(value)} to ${key}`,
      sql: `alter type "${sourceEnum.schemaName ?? "public"}"."${sourceEnum.name}" add value if not exists ${quoteLiteral(value)}`,
      safe: true,
      destructive: false
    }));
  }
  if (sharedPrefix && sourceEnum.values.length === dbEnum.values.length) {
    return [];
  }
  return [makeChange({
    kind: "manual",
    key,
    summary: `manual enum migration required for ${key}`,
    safe: false,
    destructive: true
  })];
};
var enumShapeSignature2 = (enumType) => JSON.stringify({
  schemaName: enumType.schemaName ?? "public",
  values: enumType.values
});
var filterConstraints = (table) => table.options.filter((option) => option.kind !== "index");
var filterIndexes = (table) => table.options.filter((option) => option.kind === "index");
var diffExistingTable = (sourceTable, dbTable) => {
  const changes = [];
  const key = tableKey2(sourceTable.schemaName, sourceTable.name);
  const dbColumns = new Map(dbTable.columns.map((column) => [column.name, column]));
  const sourceColumns = new Map(sourceTable.columns.map((column) => [column.name, column]));
  const matchedDbColumns = new Set;
  const matchedSourceColumns = new Set;
  for (const { source, db } of pairUniqueBySignature2(sourceTable.columns.filter((column) => !dbColumns.has(column.name)), dbTable.columns.filter((column) => !sourceColumns.has(column.name)), columnSignature, columnSignature)) {
    matchedDbColumns.add(db.name);
    matchedSourceColumns.add(source.name);
    if (db.name !== source.name) {
      changes.push(makeChange({
        kind: "renameColumn",
        key: `${key}.${db.name}`,
        summary: `rename column ${key}.${db.name} to ${source.name}`,
        sql: renderRenameColumn(sourceTable, db.name, source.name),
        rollbackSql: renderRenameColumn(sourceTable, source.name, db.name),
        safe: true,
        destructive: false
      }));
    }
  }
  for (const column of dbTable.columns) {
    if (matchedDbColumns.has(column.name)) {
      continue;
    }
    if (!sourceColumns.has(column.name)) {
      changes.push(makeChange({
        kind: "dropColumn",
        key: `${key}.${column.name}`,
        summary: `drop column ${key}.${column.name}`,
        sql: renderDropColumn(sourceTable, column),
        rollbackSql: renderAddColumn(sourceTable, column),
        safe: false,
        destructive: true
      }));
      continue;
    }
    const sourceColumn = sourceColumns.get(column.name);
    if (columnSignature(sourceColumn) !== columnSignature(column)) {
      changes.push(makeChange({
        kind: "dropColumn",
        key: `${key}.${column.name}`,
        summary: `replace column ${key}.${column.name} (drop)`,
        sql: renderDropColumn(sourceTable, column),
        rollbackSql: renderAddColumn(sourceTable, column),
        safe: false,
        destructive: true
      }));
      changes.push(makeChange({
        kind: "addColumn",
        key: `${key}.${column.name}`,
        summary: `replace column ${key}.${column.name} (add)`,
        sql: renderAddColumn(sourceTable, sourceColumn),
        rollbackSql: renderDropColumn(sourceTable, sourceColumn),
        safe: false,
        destructive: true
      }));
    }
  }
  for (const column of sourceTable.columns) {
    if (matchedSourceColumns.has(column.name)) {
      continue;
    }
    const dbColumn = dbColumns.get(column.name);
    if (dbColumn === undefined) {
      changes.push(makeChange({
        kind: "addColumn",
        key: `${key}.${column.name}`,
        summary: `add column ${key}.${column.name}`,
        sql: renderAddColumn(sourceTable, column),
        rollbackSql: renderDropColumn(sourceTable, column),
        safe: isSafeColumnAddition(column),
        destructive: false
      }));
    }
  }
  const dbConstraints = new Map(filterConstraints(dbTable).map((option) => [effectiveConstraintName(dbTable, option), option]));
  const sourceConstraints = new Map(filterConstraints(sourceTable).map((option) => [effectiveConstraintName(sourceTable, option), option]));
  const matchedDbConstraints = new Set;
  const matchedSourceConstraints = new Set;
  for (const { source, db } of pairUniqueBySignature2(filterConstraints(sourceTable).filter((option) => !dbConstraints.has(effectiveConstraintName(sourceTable, option))), filterConstraints(dbTable).filter((option) => !sourceConstraints.has(effectiveConstraintName(dbTable, option))), constraintShapeSignature2, constraintShapeSignature2)) {
    const sourceName = effectiveConstraintName(sourceTable, source);
    const dbName = effectiveConstraintName(dbTable, db);
    matchedDbConstraints.add(dbName);
    matchedSourceConstraints.add(sourceName);
    if (dbName !== sourceName) {
      changes.push(makeChange({
        kind: "renameConstraint",
        key: `${key}.${dbName}`,
        summary: `rename constraint ${key}.${dbName} to ${sourceName}`,
        sql: renderRenameConstraint(sourceTable, dbName, sourceName),
        rollbackSql: renderRenameConstraint(sourceTable, sourceName, dbName),
        safe: true,
        destructive: false
      }));
    }
  }
  for (const [name, option] of dbConstraints) {
    if (matchedDbConstraints.has(name)) {
      continue;
    }
    const next = sourceConstraints.get(name);
    if (next === undefined) {
      changes.push(makeChange({
        kind: "dropConstraint",
        key: `${key}.${name}`,
        summary: `drop constraint ${key}.${name}`,
        sql: renderDropConstraint(sourceTable, option),
        rollbackSql: renderAddConstraint(sourceTable, option),
        safe: false,
        destructive: true
      }));
      continue;
    }
    if (constraintSignature(dbTable, option) !== constraintSignature(sourceTable, next)) {
      changes.push(makeChange({
        kind: "dropConstraint",
        key: `${key}.${name}`,
        summary: `replace constraint ${key}.${name} (drop)`,
        sql: renderDropConstraint(sourceTable, option),
        rollbackSql: renderAddConstraint(sourceTable, option),
        safe: false,
        destructive: true
      }));
      changes.push(makeChange({
        kind: "addConstraint",
        key: `${key}.${name}`,
        summary: `replace constraint ${key}.${name} (add)`,
        sql: renderAddConstraint(sourceTable, next),
        rollbackSql: renderDropConstraint(sourceTable, next),
        safe: false,
        destructive: true
      }));
    }
  }
  for (const [name, option] of sourceConstraints) {
    if (matchedSourceConstraints.has(name)) {
      continue;
    }
    if (!dbConstraints.has(name)) {
      changes.push(makeChange({
        kind: "addConstraint",
        key: `${key}.${name}`,
        summary: `add constraint ${key}.${name}`,
        sql: renderAddConstraint(sourceTable, option),
        rollbackSql: renderDropConstraint(sourceTable, option),
        safe: isSafeConstraintAddition(option),
        destructive: false
      }));
    }
  }
  const dbIndexes = new Map(filterIndexes(dbTable).map((option) => [effectiveIndexName(dbTable, option), option]));
  const sourceIndexes = new Map(filterIndexes(sourceTable).map((option) => [effectiveIndexName(sourceTable, option), option]));
  const matchedDbIndexes = new Set;
  const matchedSourceIndexes = new Set;
  for (const { source, db } of pairUniqueBySignature2(filterIndexes(sourceTable).filter((option) => !dbIndexes.has(effectiveIndexName(sourceTable, option))), filterIndexes(dbTable).filter((option) => !sourceIndexes.has(effectiveIndexName(dbTable, option))), indexShapeSignature2, indexShapeSignature2)) {
    const sourceName = effectiveIndexName(sourceTable, source);
    const dbName = effectiveIndexName(dbTable, db);
    matchedDbIndexes.add(dbName);
    matchedSourceIndexes.add(sourceName);
    if (dbName !== sourceName) {
      changes.push(makeChange({
        kind: "renameIndex",
        key: `${key}.${dbName}`,
        summary: `rename index ${key}.${dbName} to ${sourceName}`,
        sql: renderRenameIndex(sourceTable, dbName, sourceName),
        rollbackSql: renderRenameIndex(sourceTable, sourceName, dbName),
        safe: true,
        destructive: false
      }));
    }
  }
  for (const [name, option] of dbIndexes) {
    if (matchedDbIndexes.has(name)) {
      continue;
    }
    const next = sourceIndexes.get(name);
    if (next === undefined) {
      changes.push(makeChange({
        kind: "dropIndex",
        key: `${key}.${name}`,
        summary: `drop index ${key}.${name}`,
        sql: renderDropIndex(sourceTable, option),
        rollbackSql: renderIndexDefinition(sourceTable, option),
        safe: false,
        destructive: true
      }));
      continue;
    }
    if (indexSignature(dbTable, option) !== indexSignature(sourceTable, next)) {
      changes.push(makeChange({
        kind: "dropIndex",
        key: `${key}.${name}`,
        summary: `replace index ${key}.${name} (drop)`,
        sql: renderDropIndex(sourceTable, option),
        rollbackSql: renderIndexDefinition(sourceTable, option),
        safe: false,
        destructive: true
      }));
      changes.push(makeChange({
        kind: "createIndex",
        key: `${key}.${name}`,
        summary: `replace index ${key}.${name} (create)`,
        sql: renderIndexDefinition(sourceTable, next),
        rollbackSql: renderDropIndex(sourceTable, next),
        safe: false,
        destructive: true
      }));
    }
  }
  for (const [name, option] of sourceIndexes) {
    if (matchedSourceIndexes.has(name)) {
      continue;
    }
    if (!dbIndexes.has(name)) {
      changes.push(makeChange({
        kind: "createIndex",
        key: `${key}.${name}`,
        summary: `create index ${key}.${name}`,
        sql: renderIndexDefinition(sourceTable, option),
        rollbackSql: renderDropIndex(sourceTable, option),
        safe: true,
        destructive: false
      }));
    }
  }
  return changes;
};
var orderChanges = (changes) => {
  const order = {
    createSchema: 0,
    createEnum: 1,
    alterEnumAddValue: 2,
    renameEnum: 3,
    createTable: 4,
    renameTable: 5,
    renameColumn: 6,
    renameConstraint: 7,
    renameIndex: 8,
    dropConstraint: 9,
    dropIndex: 10,
    dropColumn: 11,
    addColumn: 12,
    addConstraint: 13,
    createIndex: 14,
    dropTable: 15,
    dropEnum: 16,
    manual: 17
  };
  return [...changes].sort((left, right) => {
    const delta = order[left.kind] - order[right.kind];
    return delta !== 0 ? delta : left.key.localeCompare(right.key);
  });
};
var planPostgresSchemaDiff = (source, database) => {
  const changes = [];
  const dbSchemas = schemaNamesOf(database);
  for (const schemaName of [...schemaNamesOf(source)].sort()) {
    if (!dbSchemas.has(schemaName)) {
      changes.push(makeChange({
        kind: "createSchema",
        key: schemaName,
        summary: `create schema ${schemaName}`,
        sql: `create schema if not exists "${schemaName}"`,
        rollbackSql: `drop schema if exists "${schemaName}" cascade`,
        safe: true,
        destructive: false
      }));
    }
  }
  const dbEnums = new Map(database.enums.map((enumType) => [enumKey2(enumType.schemaName, enumType.name), enumType]));
  const sourceEnums = new Map(source.enums.map((enumType) => [enumKey2(enumType.schemaName, enumType.name), enumType]));
  const matchedDbEnumKeys = new Set;
  const matchedSourceEnumKeys = new Set;
  for (const enumType of source.enums) {
    const key = enumKey2(enumType.schemaName, enumType.name);
    const dbEnum = dbEnums.get(key);
    if (dbEnum !== undefined) {
      matchedDbEnumKeys.add(key);
      matchedSourceEnumKeys.add(key);
      changes.push(...diffEnum(enumType, dbEnum));
    }
  }
  for (const { source: sourceEnum, db: dbEnum } of pairUniqueBySignature2(source.enums.filter((enumType) => !dbEnums.has(enumKey2(enumType.schemaName, enumType.name))), database.enums.filter((enumType) => !sourceEnums.has(enumKey2(enumType.schemaName, enumType.name))), enumShapeSignature2, enumShapeSignature2)) {
    const sourceKey = enumKey2(sourceEnum.schemaName, sourceEnum.name);
    const dbKey = enumKey2(dbEnum.schemaName, dbEnum.name);
    matchedSourceEnumKeys.add(sourceKey);
    matchedDbEnumKeys.add(dbKey);
    if (sourceKey !== dbKey) {
      changes.push(makeChange({
        kind: "renameEnum",
        key: dbKey,
        summary: `rename enum ${dbKey} to ${sourceKey}`,
        sql: renderRenameEnum(dbEnum, sourceEnum.name),
        rollbackSql: renderRenameEnum(sourceEnum, dbEnum.name),
        safe: true,
        destructive: false
      }));
    }
  }
  for (const enumType of source.enums) {
    const key = enumKey2(enumType.schemaName, enumType.name);
    if (matchedSourceEnumKeys.has(key) || dbEnums.has(key)) {
      continue;
    }
    changes.push(makeChange({
      kind: "createEnum",
      key,
      summary: `create enum ${key}`,
      sql: renderCreateEnum(enumType),
      rollbackSql: renderDropEnum(enumType),
      safe: true,
      destructive: false
    }));
  }
  for (const enumType of database.enums) {
    const key = enumKey2(enumType.schemaName, enumType.name);
    if (!matchedDbEnumKeys.has(key) && !sourceEnums.has(key)) {
      changes.push(makeChange({
        kind: "dropEnum",
        key,
        summary: `drop enum ${key}`,
        sql: renderDropEnum(enumType),
        rollbackSql: renderCreateEnum(enumType),
        safe: false,
        destructive: true
      }));
    }
  }
  const dbTables = new Map(database.tables.map((table) => [tableKey2(table.schemaName, table.name), table]));
  const sourceTables = new Map(source.tables.map((table) => [tableKey2(table.schemaName, table.name), table]));
  const matchedDbTableKeys = new Set;
  const matchedSourceTableKeys = new Set;
  for (const table of source.tables) {
    const key = tableKey2(table.schemaName, table.name);
    const dbTable = dbTables.get(key);
    if (dbTable !== undefined) {
      matchedDbTableKeys.add(key);
      matchedSourceTableKeys.add(key);
      changes.push(...diffExistingTable(table, dbTable));
    }
  }
  for (const { source: sourceTable, db: dbTable } of pairUniqueBySignature2(source.tables.filter((table) => !dbTables.has(tableKey2(table.schemaName, table.name))), database.tables.filter((table) => !sourceTables.has(tableKey2(table.schemaName, table.name))), tableShapeSignature2, tableShapeSignature2)) {
    const sourceKey = tableKey2(sourceTable.schemaName, sourceTable.name);
    const dbKey = tableKey2(dbTable.schemaName, dbTable.name);
    matchedDbTableKeys.add(dbKey);
    matchedSourceTableKeys.add(sourceKey);
    changes.push(makeChange({
      kind: "renameTable",
      key: dbKey,
      summary: `rename table ${dbKey} to ${sourceKey}`,
      sql: renderRenameTable(dbTable, sourceTable.name),
      rollbackSql: renderRenameTable(sourceTable, dbTable.name),
      safe: true,
      destructive: false
    }));
    changes.push(...diffExistingTable(sourceTable, dbTable));
  }
  for (const table of source.tables) {
    const key = tableKey2(table.schemaName, table.name);
    if (matchedSourceTableKeys.has(key)) {
      continue;
    }
    if (!dbTables.has(key)) {
      changes.push(makeChange({
        kind: "createTable",
        key,
        summary: `create table ${key}`,
        sql: renderCreateTable(table),
        rollbackSql: renderDropTable(table),
        safe: true,
        destructive: false
      }));
      for (const option of filterIndexes(table)) {
        changes.push(makeChange({
          kind: "createIndex",
          key: `${key}.${effectiveIndexName(table, option)}`,
          summary: `create index ${key}.${effectiveIndexName(table, option)}`,
          sql: renderIndexDefinition(table, option),
          rollbackSql: renderDropIndex(table, option),
          safe: true,
          destructive: false
        }));
      }
    }
  }
  for (const table of database.tables) {
    const key = tableKey2(table.schemaName, table.name);
    if (!matchedDbTableKeys.has(key) && !sourceTables.has(key)) {
      changes.push(makeChange({
        kind: "dropTable",
        key,
        summary: `drop table ${key}`,
        sql: renderDropTable(table),
        rollbackSql: renderCreateTable(table),
        safe: false,
        destructive: true
      }));
      for (const option of filterIndexes(table)) {
        changes.push(makeChange({
          kind: "dropIndex",
          key: `${key}.${effectiveIndexName(table, option)}`,
          summary: `drop index ${key}.${effectiveIndexName(table, option)}`,
          sql: renderDropIndex(table, option),
          rollbackSql: renderIndexDefinition(table, option),
          safe: false,
          destructive: true
        }));
      }
    }
  }
  const ordered = orderChanges(changes);
  return {
    changes: ordered,
    safeChanges: ordered.filter((change) => change.safe),
    unsafeChanges: ordered.filter((change) => !change.safe),
    executableChanges: ordered.filter((change) => change.sql !== undefined),
    manualChanges: ordered.filter((change) => change.sql === undefined)
  };
};

// src/internal/postgres-introspector.ts
import * as Effect3 from "effect/Effect";
import * as SqlClient3 from "effect/unstable/sql/SqlClient";
import { SchemaExpression as SchemaExpression2 } from "effect-qb/postgres";
var normalizeFilter = (filter) => ({
  schemas: filter?.schemas?.length ? [...filter.schemas] : null,
  tables: filter?.tables?.length ? [...filter.tables] : null
});
var parseVector = (value) => value.trim() === "" ? [] : value.trim().split(" ").map((item) => Number(item));
var parseAction = (value) => {
  switch (value) {
    case "a":
      return "noAction";
    case "r":
      return "restrict";
    case "c":
      return "cascade";
    case "n":
      return "setNull";
    case "d":
      return "setDefault";
    default:
      throw new Error(`Unsupported foreign-key action code '${value}'`);
  }
};
var stripOrderingSuffix = (value) => {
  let remaining = value.trim();
  let nulls;
  let order;
  if (remaining.toUpperCase().endsWith(" NULLS FIRST")) {
    nulls = "first";
    remaining = remaining.slice(0, -12).trimEnd();
  } else if (remaining.toUpperCase().endsWith(" NULLS LAST")) {
    nulls = "last";
    remaining = remaining.slice(0, -11).trimEnd();
  }
  if (remaining.toUpperCase().endsWith(" DESC")) {
    order = "desc";
    remaining = remaining.slice(0, -5).trimEnd();
  } else if (remaining.toUpperCase().endsWith(" ASC")) {
    order = "asc";
    remaining = remaining.slice(0, -4).trimEnd();
  }
  return {
    expressionSql: remaining,
    order,
    nulls
  };
};
var quoteIdentifier2 = (value) => `"${value.replaceAll('"', '""')}"`;
var isSimpleIndexColumnReference = (sql, columnName) => {
  const trimmed = sql.trim();
  return trimmed === columnName || trimmed === quoteIdentifier2(columnName);
};
var parseExpression = (sql, context) => {
  try {
    return SchemaExpression2.normalize(SchemaExpression2.parseExpression(sql));
  } catch (error) {
    throw new Error(`Unsupported PostgreSQL expression in ${context}: ${error.message}`);
  }
};
var makeColumnModel = (row) => ({
  name: row.column_name,
  ddlType: canonicalizePostgresTypeName(row.ddl_type),
  dbTypeKind: row.ddl_type.trim().endsWith("[]") ? inferPostgresTypeKind(row.ddl_type.trim().replace(/\s+/g, " ").toLowerCase()) : inferPostgresTypeKind(row.db_type_kind),
  typeKind: row.type_kind,
  typeSchema: row.type_schema,
  nullable: row.nullable,
  hasDefault: row.has_default || row.identity_generation === "d",
  generated: row.generated_sql !== null || row.identity_generation === "a",
  defaultSql: row.default_sql === null ? undefined : SchemaExpression2.render(parseExpression(row.default_sql, `default for ${row.table_name}.${row.column_name}`)),
  generatedSql: row.generated_sql === null ? undefined : SchemaExpression2.render(parseExpression(row.generated_sql, `generated expression for ${row.table_name}.${row.column_name}`)),
  identity: row.identity_generation === "" ? undefined : {
    generation: row.identity_generation === "a" ? "always" : "byDefault"
  },
  column: undefined
});
var introspectPostgresSchema = (filter) => Effect3.flatMap(Effect3.service(SqlClient3.SqlClient), (sql) => Effect3.gen(function* () {
  const normalizedFilter = normalizeFilter(filter);
  const tables = yield* sql.unsafe(`
        select
          n.nspname as schema_name,
          c.relname as table_name,
          c.oid as table_oid
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where c.relkind = 'r'
          and n.nspname not in ('pg_catalog', 'information_schema')
          and ($1::text[] is null or n.nspname = any($1))
          and ($2::text[] is null or c.relname = any($2))
        order by n.nspname, c.relname
      `, [normalizedFilter.schemas, normalizedFilter.tables]);
  const tableOids = tables.map((table) => table.table_oid);
  if (tableOids.length === 0) {
    return {
      dialect: "postgres",
      enums: [],
      tables: []
    };
  }
  const columns = yield* sql.unsafe(`
        select
          n.nspname as schema_name,
          c.relname as table_name,
          c.oid as table_oid,
          a.attnum as attnum,
          a.attname as column_name,
          format_type(a.atttypid, a.atttypmod) as ddl_type,
          t.typname as db_type_kind,
          tn.nspname as type_schema,
          t.typtype as type_kind,
          not a.attnotnull as nullable,
          ad.adbin is not null and a.attgenerated = '' as has_default,
          case when a.attgenerated = '' then pg_get_expr(ad.adbin, ad.adrelid, true) else null end as default_sql,
          case when a.attgenerated <> '' then pg_get_expr(ad.adbin, ad.adrelid, true) else null end as generated_sql,
          a.attidentity as identity_generation,
          a.attcollation as attcollation_oid
        from pg_attribute a
        join pg_class c on c.oid = a.attrelid
        join pg_namespace n on n.oid = c.relnamespace
        join pg_type t on t.oid = a.atttypid
        join pg_namespace tn on tn.oid = t.typnamespace
        left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
        where a.attnum > 0
          and not a.attisdropped
          and c.oid = any($1::oid[])
        order by n.nspname, c.relname, a.attnum
      `, [tableOids]);
  const constraints = yield* sql.unsafe(`
        select
          n.nspname as schema_name,
          c.relname as table_name,
          con.conname as constraint_name,
          con.contype as constraint_type,
          con.conkey as local_attnums,
          con.confkey as referenced_attnums,
          fn.nspname as referenced_schema_name,
          fc.relname as referenced_table_name,
          con.condeferrable as deferrable,
          con.condeferred as initially_deferred,
          case when con.contype = 'c' then pg_get_expr(con.conbin, con.conrelid, true) else null end as check_sql,
          con.connoinherit as no_inherit,
          coalesce(conind.indnullsnotdistinct, false) as nulls_not_distinct,
          con.confupdtype as on_update,
          con.confdeltype as on_delete
        from pg_constraint con
        join pg_class c on c.oid = con.conrelid
        join pg_namespace n on n.oid = c.relnamespace
        left join pg_class fc on fc.oid = con.confrelid
        left join pg_namespace fn on fn.oid = fc.relnamespace
        left join pg_index conind on conind.indexrelid = con.conindid
        where c.oid = any($1::oid[])
          and con.contype in ('p', 'u', 'f', 'c')
        order by n.nspname, c.relname, con.conname
      `, [tableOids]);
  const indexes = yield* sql.unsafe(`
        select
          n.nspname as schema_name,
          c.relname as table_name,
          idx.relname as index_name,
          idx.oid as index_oid,
          ind.indisunique as unique,
          am.amname as method,
          pg_get_expr(ind.indpred, ind.indrelid, true) as predicate_sql,
          ind.indnkeyatts as indnkeyatts,
          ind.indnatts as indnatts,
          ind.indkey::text as indkey,
          ind.indclass::text as indclass,
          ind.indcollation::text as indcollation,
          ind.indoption::text as indoption
        from pg_index ind
        join pg_class idx on idx.oid = ind.indexrelid
        join pg_class c on c.oid = ind.indrelid
        join pg_namespace n on n.oid = c.relnamespace
        join pg_am am on am.oid = idx.relam
        left join pg_constraint con on con.conindid = ind.indexrelid
        where c.oid = any($1::oid[])
          and not ind.indisprimary
          and con.oid is null
        order by n.nspname, c.relname, idx.relname
      `, [tableOids]);
  const indexOids = indexes.map((index) => index.index_oid);
  const indexKeys = indexOids.length === 0 ? [] : yield* sql.unsafe(`
            select
              ind.indexrelid as index_oid,
              pos.n as position,
              pg_get_indexdef(ind.indexrelid, pos.n, true) as key_sql
            from pg_index ind
            cross join lateral generate_series(1, ind.indnkeyatts) as pos(n)
            where ind.indexrelid = any($1::oid[])
            order by ind.indexrelid, pos.n
          `, [indexOids]);
  const opclassOids = indexes.flatMap((index) => parseVector(index.indclass));
  const opclassRows = opclassOids.length === 0 ? [] : yield* sql.unsafe(`
            select oid, opcdefault
            from pg_opclass
            where oid = any($1::oid[])
          `, [[...new Set(opclassOids)]]);
  const opclassDefaults = new Map(opclassRows.map((row) => [row.oid, row.opcdefault]));
  const defaultCollationRow = yield* sql.unsafe(`
        select oid
        from pg_collation
        where collname = 'default'
          and collnamespace = 'pg_catalog'::regnamespace
        limit 1
      `);
  const defaultCollationOid = defaultCollationRow[0]?.oid ?? 0;
  const enumTypeNames = columns.filter((column) => column.type_kind === "e").map((column) => `${column.type_schema}.${column.db_type_kind}`);
  const enums = enumTypeNames.length === 0 ? [] : yield* sql.unsafe(`
            select
              n.nspname as schema_name,
              t.typname as type_name,
              e.enumlabel as enum_label,
              e.enumsortorder as sort_order
            from pg_type t
            join pg_namespace n on n.oid = t.typnamespace
            join pg_enum e on e.enumtypid = t.oid
            where concat(n.nspname, '.', t.typname) = any($1::text[])
            order by n.nspname, t.typname, e.enumsortorder
          `, [[...new Set(enumTypeNames)]]);
  const columnsByTable = new Map;
  const attnumByTable = new Map;
  const attcollationByTable = new Map;
  for (const column of columns) {
    const key = `${column.schema_name}.${column.table_name}`;
    const list = columnsByTable.get(key) ?? [];
    list.push(makeColumnModel(column));
    columnsByTable.set(key, list);
    const attnums = attnumByTable.get(key) ?? new Map;
    attnums.set(column.attnum, column.column_name);
    attnumByTable.set(key, attnums);
    const attcollations = attcollationByTable.get(key) ?? new Map;
    attcollations.set(column.attnum, column.attcollation_oid);
    attcollationByTable.set(key, attcollations);
  }
  const optionsByTable = new Map;
  for (const constraint of constraints) {
    const key = `${constraint.schema_name}.${constraint.table_name}`;
    const list = optionsByTable.get(key) ?? [];
    const attnums = attnumByTable.get(key) ?? new Map;
    const localColumns = (constraint.local_attnums ?? []).map((attnum) => attnums.get(attnum)).filter((value) => value !== undefined);
    switch (constraint.constraint_type) {
      case "p":
        list.push({
          kind: "primaryKey",
          name: constraint.constraint_name,
          columns: localColumns,
          deferrable: constraint.deferrable,
          initiallyDeferred: constraint.initially_deferred
        });
        break;
      case "u":
        list.push({
          kind: "unique",
          name: constraint.constraint_name,
          columns: localColumns,
          nullsNotDistinct: constraint.nulls_not_distinct,
          deferrable: constraint.deferrable,
          initiallyDeferred: constraint.initially_deferred
        });
        break;
      case "f": {
        const referencedKey = `${constraint.referenced_schema_name ?? "public"}.${constraint.referenced_table_name ?? ""}`;
        const referencedAttnums = attnumByTable.get(referencedKey) ?? new Map;
        const referencedColumns = (constraint.referenced_attnums ?? []).map((attnum) => referencedAttnums.get(attnum)).filter((value) => value !== undefined);
        list.push({
          kind: "foreignKey",
          name: constraint.constraint_name,
          columns: localColumns,
          references: () => ({
            tableName: constraint.referenced_table_name ?? "",
            schemaName: constraint.referenced_schema_name ?? undefined,
            columns: referencedColumns
          }),
          onUpdate: parseAction(constraint.on_update),
          onDelete: parseAction(constraint.on_delete),
          deferrable: constraint.deferrable,
          initiallyDeferred: constraint.initially_deferred
        });
        break;
      }
      case "c":
        if (constraint.check_sql === null) {
          throw new Error(`Missing check SQL for constraint '${constraint.constraint_name}'`);
        }
        list.push({
          kind: "check",
          name: constraint.constraint_name,
          predicate: parseExpression(constraint.check_sql, `check constraint ${constraint.constraint_name}`),
          noInherit: constraint.no_inherit
        });
        break;
    }
    optionsByTable.set(key, list);
  }
  const keySqlByIndex = new Map;
  for (const key of indexKeys) {
    const list = keySqlByIndex.get(key.index_oid) ?? [];
    list.push(key);
    keySqlByIndex.set(key.index_oid, list);
  }
  for (const index of indexes) {
    const key = `${index.schema_name}.${index.table_name}`;
    const list = optionsByTable.get(key) ?? [];
    const attnums = attnumByTable.get(key) ?? new Map;
    const attcollations = attcollationByTable.get(key) ?? new Map;
    const indkey = parseVector(index.indkey);
    const indclass = parseVector(index.indclass);
    const indcollation = parseVector(index.indcollation);
    const indoption = parseVector(index.indoption);
    const keys = (keySqlByIndex.get(index.index_oid) ?? []).map((entry) => {
      const attnum = indkey[entry.position - 1] ?? 0;
      const opclass = indclass[entry.position - 1];
      const collation = indcollation[entry.position - 1];
      const optionBits = indoption[entry.position - 1] ?? 0;
      const order = (optionBits & 1) === 1 ? "desc" : "asc";
      const nulls = (optionBits & 2) === 2 ? "first" : "last";
      const parsed = stripOrderingSuffix(entry.key_sql);
      if (opclass !== undefined && opclassDefaults.get(opclass) === false) {
        throw new Error(`Unsupported PostgreSQL index key definition '${entry.key_sql}' on ${index.index_name}`);
      }
      if (attnum > 0) {
        const columnName = attnums.get(attnum);
        if (columnName === undefined) {
          throw new Error(`Unknown index column attnum '${attnum}' on ${key}`);
        }
        const columnCollation = attcollations.get(attnum) ?? defaultCollationOid;
        if (collation !== undefined && collation !== 0 && collation !== columnCollation) {
          throw new Error(`Unsupported PostgreSQL index collation on ${index.index_name}`);
        }
        if (!isSimpleIndexColumnReference(parsed.expressionSql, columnName)) {
          throw new Error(`Unsupported PostgreSQL index key definition '${entry.key_sql}' on ${index.index_name}`);
        }
        return {
          kind: "column",
          column: columnName,
          order: parsed.order ?? order,
          nulls: parsed.nulls ?? nulls
        };
      }
      if (collation !== undefined && collation !== 0 && collation !== defaultCollationOid) {
        throw new Error(`Unsupported PostgreSQL index collation on ${index.index_name}`);
      }
      return {
        kind: "expression",
        expression: parseExpression(parsed.expressionSql, `index ${index.index_name}`),
        order: parsed.order ?? order,
        nulls: parsed.nulls ?? nulls
      };
    });
    const include = indkey.slice(index.indnkeyatts, index.indnatts).map((attnum) => attnums.get(attnum)).filter((value) => value !== undefined);
    list.push({
      kind: "index",
      name: index.index_name,
      unique: index.unique,
      method: index.method,
      keys,
      include,
      predicate: index.predicate_sql === null ? undefined : parseExpression(index.predicate_sql, `index predicate ${index.index_name}`)
    });
    optionsByTable.set(key, list);
  }
  const enumMap = new Map;
  for (const enumRow of enums) {
    const key = `${enumRow.schema_name}.${enumRow.type_name}`;
    const existing = enumMap.get(key);
    if (existing) {
      enumMap.set(key, {
        ...existing,
        values: [...existing.values, enumRow.enum_label]
      });
    } else {
      enumMap.set(key, {
        kind: "enum",
        schemaName: enumRow.schema_name,
        name: enumRow.type_name,
        values: [enumRow.enum_label]
      });
    }
  }
  const tableModels = tables.map((table) => {
    const key = `${table.schema_name}.${table.table_name}`;
    return {
      kind: "table",
      schemaName: table.schema_name,
      name: table.table_name,
      columns: columnsByTable.get(key) ?? [],
      options: optionsByTable.get(key) ?? []
    };
  });
  return {
    dialect: "postgres",
    enums: [...enumMap.values()],
    tables: tableModels
  };
}));

// src/internal/postgres-source-filter.ts
import { enumKey as enumKey3, tableKey as tableKey3 } from "effect-qb/postgres/metadata";
var normalizeSchemas = (filter) => filter?.schemas && filter.schemas.length > 0 ? new Set(filter.schemas) : undefined;
var normalizeTables = (filter) => filter?.tables && filter.tables.length > 0 ? new Set(filter.tables) : undefined;
var inferSchemaFromDdlType = (ddlType) => {
  const withoutParams = ddlType.trim().replace(/\(.+\)$/, "").replace(/\[\]$/, "");
  const match = /^(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_$]*))\.(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_$]*))$/.exec(withoutParams);
  if (match === null) {
    return;
  }
  return match[1] ?? match[2];
};
var inferNameFromDdlType = (ddlType) => {
  const withoutParams = ddlType.trim().replace(/\(.+\)$/, "").replace(/\[\]$/, "");
  const match = /^(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_$]*))\.(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_$]*))$/.exec(withoutParams);
  if (match === null) {
    return;
  }
  return match[3] ?? match[4];
};
var enumCandidatesForColumn = (column, tableSchemaName) => {
  const schemaFromDdl = inferSchemaFromDdlType(column.ddlType);
  const nameFromDdl = inferNameFromDdlType(column.ddlType);
  return [
    enumKey3(column.typeSchema, column.dbTypeKind),
    enumKey3(schemaFromDdl, nameFromDdl ?? column.dbTypeKind),
    enumKey3(tableSchemaName, column.dbTypeKind)
  ];
};
var matchesTableFilter = (schemaName, name, allowedSchemas, allowedTables) => (allowedSchemas === undefined || allowedSchemas.has(schemaName ?? "public")) && (allowedTables === undefined || allowedTables.has(name));
var filterDiscoveredSourceSchema = (discovered, filter) => {
  const allowedSchemas = normalizeSchemas(filter);
  const allowedTables = normalizeTables(filter);
  if (allowedSchemas === undefined && allowedTables === undefined) {
    return discovered;
  }
  const filteredTables = discovered.model.tables.filter((table) => matchesTableFilter(table.schemaName, table.name, allowedSchemas, allowedTables));
  const filteredTableKeys = new Set(filteredTables.map((table) => tableKey3(table.schemaName, table.name)));
  const sourceEnumKeys = new Set(discovered.model.enums.map((enumType) => enumKey3(enumType.schemaName, enumType.name)));
  const referencedEnumKeys = new Set;
  for (const table of filteredTables) {
    for (const column of table.columns) {
      for (const candidate of enumCandidatesForColumn(column, table.schemaName)) {
        if (sourceEnumKeys.has(candidate)) {
          referencedEnumKeys.add(candidate);
        }
      }
    }
  }
  const filteredEnums = discovered.model.enums.filter((enumType) => {
    const key = enumKey3(enumType.schemaName, enumType.name);
    if (referencedEnumKeys.has(key)) {
      return true;
    }
    return allowedTables === undefined && (allowedSchemas === undefined || allowedSchemas.has(enumType.schemaName ?? "public"));
  });
  const filteredEnumKeys = new Set(filteredEnums.map((enumType) => enumKey3(enumType.schemaName, enumType.name)));
  const allowedBindingKeys = new Set([
    ...filteredTableKeys,
    ...filteredEnumKeys
  ]);
  const bindings = discovered.bindings.filter((binding) => allowedBindingKeys.has(binding.key));
  const declarations = discovered.declarations.filter((declaration) => bindings.some((binding) => binding.declaration === declaration));
  return {
    declarations,
    bindings,
    model: {
      dialect: "postgres",
      enums: filteredEnums,
      tables: filteredTables
    }
  };
};

// src/internal/postgres-source-discovery.ts
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { basename, dirname as dirname3, extname as extname2, join as join2, relative as relative2, resolve as resolve4 } from "node:path";
import { pathToFileURL as pathToFileURL2 } from "node:url";
import ts from "typescript";
import {
  enumKey as enumKey4,
  fromDiscoveredValues,
  isEnumDefinition,
  isTableDefinition,
  tableKey as tableKey4
} from "effect-qb/postgres/metadata";
import { Table } from "effect-qb/postgres";
var DEFAULT_SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs"
]);
var isPostgresModule = (value) => value === "effect-qb/postgres" || value === "#postgres" || value.endsWith("/postgres");
var isSchemaCall = (expression, importInfo) => {
  if (!ts.isCallExpression(expression)) {
    return false;
  }
  if (ts.isIdentifier(expression.expression)) {
    return importInfo.schemaAliases.has(expression.expression.text);
  }
  if (!ts.isPropertyAccessExpression(expression.expression)) {
    return false;
  }
  const target = expression.expression;
  if (target.name.text !== "schema") {
    return false;
  }
  if (ts.isIdentifier(target.expression)) {
    return importInfo.postgresNamespaceAliases.has(target.expression.text);
  }
  return false;
};
var unwrapPipeRoot = (expression) => {
  if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression) && expression.expression.name.text === "pipe") {
    return expression.expression.expression;
  }
  return expression;
};
var isTableMakeRoot = (expression, importInfo) => {
  const root = unwrapPipeRoot(expression);
  if (!ts.isCallExpression(root) || !ts.isPropertyAccessExpression(root.expression)) {
    return false;
  }
  const target = root.expression;
  if (target.name.text !== "make") {
    return false;
  }
  if (ts.isIdentifier(target.expression)) {
    return importInfo.tableAliases.has(target.expression.text);
  }
  return ts.isPropertyAccessExpression(target.expression) && ts.isIdentifier(target.expression.expression) && importInfo.postgresNamespaceAliases.has(target.expression.expression.text) && target.expression.name.text === "Table";
};
var isSchemaTableRoot = (expression, schemaBuilders) => {
  const root = unwrapPipeRoot(expression);
  if (!ts.isCallExpression(root) || !ts.isPropertyAccessExpression(root.expression)) {
    return;
  }
  const target = root.expression;
  if (target.name.text !== "table" || !ts.isIdentifier(target.expression)) {
    return;
  }
  return schemaBuilders.has(target.expression.text) ? target.expression.text : undefined;
};
var isEnumFactoryRoot = (expression, importInfo) => {
  if (!ts.isCallExpression(expression) || !ts.isPropertyAccessExpression(expression.expression)) {
    return false;
  }
  const target = expression.expression;
  if (target.name.text !== "enum") {
    return false;
  }
  return isSchemaCall(target.expression, importInfo);
};
var isSchemaEnumRoot = (expression, schemaBuilders) => {
  if (!ts.isCallExpression(expression) || !ts.isPropertyAccessExpression(expression.expression)) {
    return;
  }
  const target = expression.expression;
  if (target.name.text !== "enum" || !ts.isIdentifier(target.expression)) {
    return;
  }
  return schemaBuilders.has(target.expression.text) ? target.expression.text : undefined;
};
var isTableClass = (declaration, importInfo) => {
  const heritage = declaration.heritageClauses?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword);
  const type = heritage?.types[0];
  if (type === undefined) {
    return false;
  }
  let expression = type.expression;
  if (ts.isCallExpression(expression)) {
    expression = expression.expression;
  }
  if (!ts.isCallExpression(expression) || !ts.isPropertyAccessExpression(expression.expression)) {
    return false;
  }
  const target = expression.expression;
  if (target.name.text !== "Class") {
    return false;
  }
  if (ts.isIdentifier(target.expression)) {
    return importInfo.tableAliases.has(target.expression.text);
  }
  return ts.isPropertyAccessExpression(target.expression) && ts.isIdentifier(target.expression.expression) && importInfo.postgresNamespaceAliases.has(target.expression.expression.text) && target.expression.name.text === "Table";
};
var isTableClassReference = (expression, importInfo) => {
  let current = expression;
  if (ts.isCallExpression(current)) {
    current = current.expression;
  }
  if (!ts.isCallExpression(current) || !ts.isPropertyAccessExpression(current.expression)) {
    return false;
  }
  const target = current.expression;
  if (target.name.text !== "Class") {
    return false;
  }
  if (ts.isIdentifier(target.expression)) {
    return importInfo.tableAliases.has(target.expression.text);
  }
  return ts.isPropertyAccessExpression(target.expression) && ts.isIdentifier(target.expression.expression) && importInfo.postgresNamespaceAliases.has(target.expression.expression.text) && target.expression.name.text === "Table";
};
var expressionContainsDiscoveryConstruct = (expression, importInfo, schemaBuilders) => {
  let found = false;
  const knownSchemaBuilders = new Set(schemaBuilders);
  const visit = (node) => {
    if (found) {
      return;
    }
    if (ts.isExpression(node) && (isSchemaCall(node, importInfo) || isTableMakeRoot(node, importInfo) || isEnumFactoryRoot(node, importInfo) || isTableClassReference(node, importInfo) || isSchemaTableRoot(node, knownSchemaBuilders) !== undefined || isSchemaEnumRoot(node, knownSchemaBuilders) !== undefined)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(expression);
  return found;
};
var statementContainsDiscoveryConstruct = (statement, importInfo, schemaBuilders) => {
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.some((declaration) => declaration.initializer !== undefined && expressionContainsDiscoveryConstruct(declaration.initializer, importInfo, schemaBuilders));
  }
  if (ts.isClassDeclaration(statement)) {
    return statement.heritageClauses?.some((clause) => clause.types.some((type) => expressionContainsDiscoveryConstruct(type.expression, importInfo, schemaBuilders))) ?? false;
  }
  return false;
};
var validateNestedDiscoveryStatements = (sourceFile, filePath, importInfo, schemaBuilders) => {
  const visit = (node) => {
    if ((ts.isVariableStatement(node) || ts.isClassDeclaration(node)) && statementContainsDiscoveryConstruct(node, importInfo, schemaBuilders)) {
      throw new Error(`Nested schema declarations are not supported in '${filePath}'`);
    }
    ts.forEachChild(node, visit);
  };
  for (const statement of sourceFile.statements) {
    ts.forEachChild(statement, visit);
  }
};
var collectImportInfo = (sourceFile) => {
  const postgresModules = new Set;
  const postgresNamespaceAliases = new Set;
  const tableAliases = new Set;
  const schemaAliases = new Set;
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause === undefined) {
      continue;
    }
    const moduleSpecifier = ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : undefined;
    if (moduleSpecifier === undefined || !isPostgresModule(moduleSpecifier)) {
      continue;
    }
    postgresModules.add(moduleSpecifier);
    const bindings = statement.importClause.namedBindings;
    if (bindings === undefined) {
      continue;
    }
    if (ts.isNamespaceImport(bindings)) {
      postgresNamespaceAliases.add(bindings.name.text);
      continue;
    }
    for (const element of bindings.elements) {
      const imported = element.propertyName?.text ?? element.name.text;
      if (imported === "Table") {
        tableAliases.add(element.name.text);
      } else if (imported === "schema") {
        schemaAliases.add(element.name.text);
      }
    }
  }
  return {
    postgresModules,
    postgresNamespaceAliases,
    tableAliases,
    schemaAliases
  };
};
var discoverInFile = (filePath, contents) => {
  const sourceFile = ts.createSourceFile(filePath, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const importInfo = collectImportInfo(sourceFile);
  if (importInfo.postgresModules.size === 0 && importInfo.postgresNamespaceAliases.size === 0 && importInfo.tableAliases.size === 0 && importInfo.schemaAliases.size === 0) {
    return [];
  }
  const schemaBuilders = new Set;
  const declarations = [];
  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      if (statement.declarationList.declarations.length !== 1) {
        if (statementContainsDiscoveryConstruct(statement, importInfo, schemaBuilders)) {
          throw new Error(`Non-canonical schema declaration in '${filePath}'`);
        }
        continue;
      }
      const declaration = statement.declarationList.declarations[0];
      if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) {
        if (statementContainsDiscoveryConstruct(statement, importInfo, schemaBuilders)) {
          throw new Error(`Non-canonical schema declaration in '${filePath}'`);
        }
        continue;
      }
      const identifier = declaration.name.text;
      if (isSchemaCall(declaration.initializer, importInfo)) {
        schemaBuilders.add(identifier);
        continue;
      }
      if (isTableMakeRoot(declaration.initializer, importInfo)) {
        declarations.push({
          kind: "tableFactory",
          filePath,
          identifier,
          start: statement.getStart(sourceFile),
          end: statement.getEnd()
        });
        continue;
      }
      const schemaBuilderIdentifier = isSchemaTableRoot(declaration.initializer, schemaBuilders);
      if (schemaBuilderIdentifier !== undefined) {
        declarations.push({
          kind: "tableSchema",
          filePath,
          identifier,
          start: statement.getStart(sourceFile),
          end: statement.getEnd(),
          schemaBuilderIdentifier
        });
        continue;
      }
      if (isEnumFactoryRoot(declaration.initializer, importInfo)) {
        declarations.push({
          kind: "enumFactory",
          filePath,
          identifier,
          start: statement.getStart(sourceFile),
          end: statement.getEnd()
        });
        continue;
      }
      const enumSchemaBuilderIdentifier = isSchemaEnumRoot(declaration.initializer, schemaBuilders);
      if (enumSchemaBuilderIdentifier !== undefined) {
        declarations.push({
          kind: "enumSchema",
          filePath,
          identifier,
          start: statement.getStart(sourceFile),
          end: statement.getEnd(),
          schemaBuilderIdentifier: enumSchemaBuilderIdentifier
        });
        continue;
      }
      if (expressionContainsDiscoveryConstruct(declaration.initializer, importInfo, schemaBuilders)) {
        throw new Error(`Non-canonical schema declaration '${identifier}' in '${filePath}'`);
      }
      continue;
    }
    if (ts.isClassDeclaration(statement)) {
      if (statement.name && isTableClass(statement, importInfo)) {
        declarations.push({
          kind: "tableClass",
          filePath,
          identifier: statement.name.text,
          start: statement.getStart(sourceFile),
          end: statement.getEnd()
        });
        continue;
      }
      if (statementContainsDiscoveryConstruct(statement, importInfo, schemaBuilders)) {
        throw new Error(`Non-canonical schema declaration in '${filePath}'`);
      }
    }
  }
  validateNestedDiscoveryStatements(sourceFile, filePath, importInfo, schemaBuilders);
  return declarations;
};
var createTemporaryExportModule = async (filePath, names) => {
  const extension = extname2(filePath) || ".ts";
  const tempPath = join2(dirname3(filePath), `.__effect_qb_discovery_${basename(filePath, extension)}_${randomUUID()}${extension}`);
  const contents = await Bun.file(filePath).text();
  await Bun.write(tempPath, `${contents}
const __effect_qb_discovery_exports = { ${names.join(", ")} }
export default __effect_qb_discovery_exports
`);
  return tempPath;
};
var importDiscoveredValues = async (declarations) => {
  const byFile = new Map;
  for (const declaration of declarations) {
    const names = byFile.get(declaration.filePath) ?? [];
    names.push(declaration.identifier);
    byFile.set(declaration.filePath, names);
  }
  const values = [];
  for (const [filePath, names] of byFile) {
    const tempPath = await createTemporaryExportModule(filePath, [...new Set(names)]);
    try {
      const imported = await import(pathToFileURL2(tempPath).href);
      const exportedValues = imported.default;
      for (const name of names) {
        values.push(exportedValues?.[name]);
      }
    } finally {
      await rm(tempPath, { force: true }).catch(() => {
        return;
      });
    }
  }
  return values;
};
var scanPattern = async (cwd, pattern) => {
  const matches = [];
  for await (const match of new Bun.Glob(pattern).scan({ cwd, absolute: true, dot: true, followSymlinks: true })) {
    if (DEFAULT_SOURCE_EXTENSIONS.has(extname2(match))) {
      matches.push(resolve4(match));
    }
  }
  return matches;
};
var discoverSourceSchema = async (cwd, source) => {
  const included = new Set;
  for (const pattern of source.include) {
    for (const match of await scanPattern(cwd, pattern)) {
      included.add(match);
    }
  }
  const excluded = new Set;
  for (const pattern of source.exclude ?? []) {
    for (const match of await scanPattern(cwd, pattern)) {
      excluded.add(match);
    }
  }
  const declarations = [];
  for (const filePath of [...included].filter((file) => !excluded.has(file)).sort()) {
    const contents = await Bun.file(filePath).text();
    declarations.push(...discoverInFile(filePath, contents));
  }
  const duplicateKeys = new Map;
  for (const declaration of declarations) {
    const key = `${declaration.filePath}:${declaration.identifier}`;
    if (duplicateKeys.has(key)) {
      throw new Error(`Duplicate discovered declaration '${declaration.identifier}' in '${relative2(cwd, declaration.filePath)}'`);
    }
    duplicateKeys.set(key, key);
  }
  const values = await importDiscoveredValues(declarations);
  const bindings = [];
  const seenKeys = new Map;
  for (const [index, value] of values.entries()) {
    const declaration = declarations[index];
    if (declaration === undefined) {
      continue;
    }
    if (isTableDefinition(value)) {
      const state = value[Table.TypeId];
      const key = tableKey4(state.schemaName, state.baseName);
      const existing = seenKeys.get(key);
      if (existing) {
        throw new Error(`Duplicate discovered table identity '${key}' in '${relative2(cwd, existing.filePath)}' and '${relative2(cwd, declaration.filePath)}'`);
      }
      seenKeys.set(key, declaration);
      bindings.push({
        declaration,
        value,
        key,
        kind: "table"
      });
      continue;
    }
    if (isEnumDefinition(value)) {
      const key = enumKey4(value.schemaName, value.name);
      const existing = seenKeys.get(key);
      if (existing) {
        throw new Error(`Duplicate discovered enum identity '${key}' in '${relative2(cwd, existing.filePath)}' and '${relative2(cwd, declaration.filePath)}'`);
      }
      seenKeys.set(key, declaration);
      bindings.push({
        declaration,
        value,
        key,
        kind: "enum"
      });
    }
  }
  return {
    declarations,
    bindings,
    model: fromDiscoveredValues(values)
  };
};

// src/cli.ts
import { tableKey as tableKey5 } from "effect-qb/postgres/metadata";
var toError = (cause) => cause instanceof Error ? cause : new Error(String(cause));
var effectFromPromise = (evaluate) => Effect4.tryPromise({
  try: evaluate,
  catch: toError
});
var log = (line) => Effect4.sync(() => {
  console.log(line);
});
var logLines = (lines) => Effect4.sync(() => {
  if (lines.length > 0) {
    console.log(lines.join(`
`));
  }
});
var summarizeSelectedPlan = (label, changes) => changes.length === 0 ? [`${label}: none`] : [
  `${label}:`,
  ...changes.map((change) => `  - ${change.summary}`)
];
var selectedChanges = (plan, allowDestructive) => allowDestructive ? plan.executableChanges : plan.executableChanges.filter((change) => change.safe);
var skippedChanges = (plan, allowDestructive) => allowDestructive ? plan.manualChanges : plan.unsafeChanges;
var configOption = Flag.string("config").pipe(Flag.optional, Flag.withAlias("c"), Flag.withDescription("Path to effectdb.config.ts"));
var urlOption = Flag.string("url").pipe(Flag.optional, Flag.withDescription("Override the Postgres connection URL"));
var dryRunOption = Flag.boolean("dry-run").pipe(Flag.withDescription("Print the computed plan without writing"));
var allowDestructiveOption = Flag.boolean("allow-destructive").pipe(Flag.withDescription("Include destructive SQL instead of safe-only changes"));
var nameOption = Flag.string("name").pipe(Flag.optional, Flag.withDescription("Migration name"));
var stepsOption = Flag.integer("steps").pipe(Flag.optional, Flag.withDescription("Number of applied migrations to roll back"));
var withLoadedConfig = (explicitConfigPath, explicitUrl, f) => effectFromPromise(async () => {
  const loaded = await loadPostgresConfig(process.cwd(), Option.getOrUndefined(explicitConfigPath));
  return await f({
    cwd: loaded.cwd,
    configPath: loaded.path,
    databaseUrl: resolveDatabaseUrl(loaded.config, Option.getOrUndefined(explicitUrl)),
    config: loaded.config
  });
});
var managedMigrationTableKey = (tableName) => {
  const parts = tableName.split(".");
  return parts.length === 1 ? tableKey5(undefined, parts[0]) : tableKey5(parts[0], parts.slice(1).join("."));
};
var withoutManagedMigrationTable = (model, migrationTableName) => {
  const ignoredKey = managedMigrationTableKey(migrationTableName);
  return {
    ...model,
    tables: model.tables.filter((table) => tableKey5(table.schemaName, table.name) !== ignoredKey)
  };
};
var loadSchemaPlan = (cwd, config, databaseUrl) => (async () => {
  const discovered = filterDiscoveredSourceSchema(await discoverSourceSchema(cwd, config.source), config.filter);
  const database = withoutManagedMigrationTable(await runPostgresUrl(databaseUrl, introspectPostgresSchema(config.filter)), config.migrations.table);
  return {
    plan: planPostgresSchemaDiff(discovered.model, database),
    discovered
  };
})();
var loadMigrationState = async (loaded, databaseUrl) => {
  const files = await readMigrationFiles(migrationDirFromConfig(loaded.cwd, loaded.config.migrations.dir));
  const appliedRows = await runPostgresUrl(databaseUrl, Effect4.gen(function* () {
    yield* ensureMigrationTable(loaded.config.migrations.table);
    return yield* readAppliedMigrationRows(loaded.config.migrations.table);
  }));
  const appliedNames = new Set(appliedRows.map((row) => row.name));
  const pending = files.filter((file) => !appliedNames.has(file.name));
  return {
    files,
    appliedRows,
    appliedNames,
    pending
  };
};
var push = Command.make("push", {
  config: configOption,
  url: urlOption,
  dryRun: dryRunOption,
  allowDestructive: allowDestructiveOption
}, ({ config, url, dryRun, allowDestructive }) => Effect4.gen(function* () {
  const { plan, discovered } = yield* withLoadedConfig(config, url, async ({ cwd, config: config2, databaseUrl }) => loadSchemaPlan(cwd, config2, databaseUrl));
  const selected = selectedChanges(plan, allowDestructive);
  const skipped = skippedChanges(plan, allowDestructive);
  yield* logLines([
    `discovered ${discovered.model.tables.length} table(s) and ${discovered.model.enums.length} enum(s)`,
    ...summarizeSelectedPlan("planned changes", plan.changes)
  ]);
  if (dryRun) {
    return yield* logLines(skipped.length === 0 ? [] : summarizeSelectedPlan("skipped changes", skipped));
  }
  if (selected.length > 0) {
    yield* withLoadedConfig(config, url, ({ databaseUrl }) => runPostgresUrl(databaseUrl, applyStatements(selected.map((change) => change.sql).filter((sql) => sql !== undefined))));
    yield* log(`applied ${selected.length} statement(s)`);
  } else {
    yield* log("no executable statements selected");
  }
  if (skipped.length > 0) {
    yield* logLines(summarizeSelectedPlan("skipped changes", skipped));
  }
}));
var pull = Command.make("pull", {
  config: configOption,
  url: urlOption,
  dryRun: dryRunOption
}, ({ config, url, dryRun }) => Effect4.gen(function* () {
  const { loaded, database, discovered, plan } = yield* effectFromPromise(async () => {
    const loaded2 = await loadPostgresConfig(process.cwd(), Option.getOrUndefined(config));
    const databaseUrl = resolveDatabaseUrl(loaded2.config, Option.getOrUndefined(url));
    const discovered2 = filterDiscoveredSourceSchema(await discoverSourceSchema(loaded2.cwd, loaded2.config.source), loaded2.config.filter);
    const database2 = withoutManagedMigrationTable(await runPostgresUrl(databaseUrl, introspectPostgresSchema(loaded2.config.filter)), loaded2.config.migrations.table);
    const plan2 = await planPostgresPull(loaded2.cwd, loaded2.config.source, discovered2, database2);
    return { loaded: loaded2, database: database2, discovered: discovered2, plan: plan2 };
  });
  if (plan.updates.length === 0) {
    return yield* log("schema definitions are already up to date");
  }
  yield* logLines(summarizePullPlan(loaded.cwd, plan));
  if (!dryRun) {
    yield* effectFromPromise(() => applyPullPlan(plan));
    yield* log(`updated ${plan.updates.length} file(s)`);
  }
}));
var migrateGenerate = Command.make("generate", {
  config: configOption,
  url: urlOption,
  allowDestructive: allowDestructiveOption,
  name: nameOption
}, ({ config, url, allowDestructive, name }) => Effect4.gen(function* () {
  const { loaded, plan } = yield* effectFromPromise(async () => {
    const loaded2 = await loadPostgresConfig(process.cwd(), Option.getOrUndefined(config));
    const databaseUrl = resolveDatabaseUrl(loaded2.config, Option.getOrUndefined(url));
    const { plan: plan2 } = await loadSchemaPlan(loaded2.cwd, loaded2.config, databaseUrl);
    return { loaded: loaded2, plan: plan2 };
  });
  const selected = selectedChanges(plan, allowDestructive);
  const skipped = skippedChanges(plan, allowDestructive);
  if (selected.length === 0) {
    yield* log("no executable migration changes selected");
  } else {
    const filePath = yield* effectFromPromise(() => writeMigrationFile(migrationDirFromConfig(loaded.cwd, loaded.config.migrations.dir), Option.getOrElse(name, () => allowDestructive ? "schema_destructive" : "schema_safe"), selected));
    yield* log(`wrote ${migrationFileLabel(filePath)}`);
  }
  if (skipped.length > 0) {
    yield* logLines(summarizeSelectedPlan("skipped changes", skipped));
  }
}));
var migrateUp = Command.make("up", {
  config: configOption,
  url: urlOption
}, ({ config, url }) => Effect4.gen(function* () {
  const { loaded, databaseUrl, pending } = yield* effectFromPromise(async () => {
    const loaded2 = await loadPostgresConfig(process.cwd(), Option.getOrUndefined(config));
    const databaseUrl2 = resolveDatabaseUrl(loaded2.config, Option.getOrUndefined(url));
    const pending2 = await runPostgresUrl(databaseUrl2, Effect4.gen(function* () {
      yield* ensureMigrationTable(loaded2.config.migrations.table);
      const applied = yield* readAppliedMigrationNames(loaded2.config.migrations.table);
      return yield* Effect4.promise(() => readPendingMigrationFiles(migrationDirFromConfig(loaded2.cwd, loaded2.config.migrations.dir), applied));
    }));
    return { loaded: loaded2, databaseUrl: databaseUrl2, pending: pending2 };
  });
  if (pending.length === 0) {
    return yield* log("no pending migrations");
  }
  yield* effectFromPromise(() => runPostgresUrl(databaseUrl, Effect4.andThen(ensureMigrationTable(loaded.config.migrations.table), applyMigrationFiles(loaded.config.migrations.table, pending))));
  yield* logLines([
    `applied ${pending.length} migration(s)`,
    ...pending.map((file) => `  - ${file.name}`)
  ]);
}));
var migrateStatus = Command.make("status", {
  config: configOption,
  url: urlOption
}, ({ config, url }) => Effect4.gen(function* () {
  const { loaded, databaseUrl, appliedRows, pending } = yield* effectFromPromise(async () => {
    const loaded2 = await loadPostgresConfig(process.cwd(), Option.getOrUndefined(config));
    const databaseUrl2 = resolveDatabaseUrl(loaded2.config, Option.getOrUndefined(url));
    const state = await loadMigrationState(loaded2, databaseUrl2);
    return {
      loaded: loaded2,
      databaseUrl: databaseUrl2,
      appliedRows: state.appliedRows,
      pending: state.pending
    };
  });
  yield* logLines([
    `applied migrations (${appliedRows.length}):`,
    ...appliedRows.map((row) => `  - ${row.name}`),
    `pending migrations (${pending.length}):`,
    ...pending.map((file) => `  - ${file.name}`)
  ]);
}));
var migrateDown = Command.make("down", {
  config: configOption,
  url: urlOption,
  dryRun: dryRunOption,
  steps: stepsOption
}, ({ config, url, dryRun, steps }) => Effect4.gen(function* () {
  const { loaded, databaseUrl, selected } = yield* effectFromPromise(async () => {
    const loaded2 = await loadPostgresConfig(process.cwd(), Option.getOrUndefined(config));
    const databaseUrl2 = resolveDatabaseUrl(loaded2.config, Option.getOrUndefined(url));
    const state = await loadMigrationState(loaded2, databaseUrl2);
    const stepCount = Math.max(1, Option.getOrElse(steps, () => 1));
    const applied = [...state.appliedRows].slice(Math.max(0, state.appliedRows.length - stepCount)).reverse();
    const fileByName = new Map(state.files.map((file) => [file.name, file]));
    const selected2 = applied.map((row) => {
      const file = fileByName.get(row.name);
      if (file === undefined) {
        throw new Error(`Migration file '${row.name}' is missing from '${loaded2.config.migrations.dir}'`);
      }
      if (file.downSql === undefined) {
        throw new Error(`Migration '${row.name}' does not have a rollback section`);
      }
      return file;
    });
    return {
      loaded: loaded2,
      databaseUrl: databaseUrl2,
      selected: selected2
    };
  });
  if (selected.length === 0) {
    return yield* log("no applied migrations");
  }
  yield* logLines([
    `rollback migrations (${selected.length}):`,
    ...selected.map((file) => `  - ${file.name}`)
  ]);
  if (!dryRun) {
    yield* effectFromPromise(() => runPostgresUrl(databaseUrl, rollbackMigrationFiles(loaded.config.migrations.table, selected)));
    yield* log(`rolled back ${selected.length} migration(s)`);
  }
}));
var migrateRepair = Command.make("repair", {
  config: configOption,
  url: urlOption,
  dryRun: dryRunOption
}, ({ config, url, dryRun }) => Effect4.gen(function* () {
  const { loaded, databaseUrl, orphanNames } = yield* effectFromPromise(async () => {
    const loaded2 = await loadPostgresConfig(process.cwd(), Option.getOrUndefined(config));
    const databaseUrl2 = resolveDatabaseUrl(loaded2.config, Option.getOrUndefined(url));
    const state = await loadMigrationState(loaded2, databaseUrl2);
    const fileNames = new Set(state.files.map((file) => file.name));
    const orphanNames2 = state.appliedRows.map((row) => row.name).filter((name) => !fileNames.has(name));
    return {
      loaded: loaded2,
      databaseUrl: databaseUrl2,
      orphanNames: orphanNames2
    };
  });
  if (orphanNames.length === 0) {
    return yield* log("migration ledger is already aligned");
  }
  yield* logLines([
    `repairing ${orphanNames.length} orphaned migration record(s):`,
    ...orphanNames.map((name) => `  - ${name}`)
  ]);
  if (!dryRun) {
    yield* effectFromPromise(() => runPostgresUrl(databaseUrl, deleteAppliedMigrationNames(loaded.config.migrations.table, orphanNames)));
    yield* log(`repaired ${orphanNames.length} migration record(s)`);
  }
}));
var migrate = Command.make("migrate", {}, () => Effect4.void).pipe(Command.withSubcommands([migrateGenerate, migrateStatus, migrateUp, migrateDown, migrateRepair]));
var root = Command.make("effectdb", {}, () => Effect4.void).pipe(Command.withSubcommands([push, pull, migrate]));
var cli = Command.run(root, {
  version: "0.13.0"
});
cli.pipe(Effect4.provide(BunServices.layer), BunRuntime.runMain);
