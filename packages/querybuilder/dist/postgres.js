var __defProp = Object.defineProperty;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// src/postgres/metadata.ts
var exports_metadata = {};
__export(exports_metadata, {
  toTableModel: () => toTableModel,
  toEnumModel: () => toEnumModel,
  tableKey: () => tableKey,
  renderDdlExpressionSql: () => renderDdlExpressionSql,
  normalizeDdlExpressionSql: () => normalizeDdlExpressionSql,
  isTableDefinition: () => isTableDefinition,
  isEnumDefinition: () => isEnumDefinition,
  fromDiscoveredValues: () => fromDiscoveredValues,
  enumKey: () => enumKey,
  EnumTypeId: () => EnumTypeId
});

// src/internal/table.ts
import { pipeArguments as pipeArguments2 } from "effect/Pipeable";

// src/internal/plan.ts
var exports_plan = {};
__export(exports_plan, {
  TypeId: () => TypeId
});
var TypeId = Symbol.for("effect-qb/Plan");

// src/internal/column-state.ts
import { pipeArguments } from "effect/Pipeable";

// src/internal/expression.ts
var exports_expression = {};
__export(exports_expression, {
  TypeId: () => TypeId2
});
var TypeId2 = Symbol.for("effect-qb/Expression");

// src/internal/expression-ast.ts
var TypeId3 = Symbol.for("effect-qb/ExpressionAst");

// src/internal/column-state.ts
var ColumnTypeId = Symbol.for("effect-qb/Column");
var BoundColumnTypeId = Symbol.for("effect-qb/BoundColumn");
var ColumnProto = {
  pipe() {
    return pipeArguments(this, arguments);
  }
};
var makeColumnDefinition = (schema, metadata) => {
  const column = Object.create(ColumnProto);
  column.schema = schema;
  column.metadata = metadata;
  column[TypeId2] = {
    runtime: undefined,
    dbType: metadata.dbType,
    runtimeSchema: schema,
    nullability: metadata.nullable ? "maybe" : "never",
    dialect: metadata.dbType.dialect,
    aggregation: "scalar",
    source: undefined,
    sourceNullability: "propagate",
    dependencies: {}
  };
  column[ColumnTypeId] = {
    select: undefined,
    insert: undefined,
    update: undefined,
    dbType: metadata.dbType,
    nullable: metadata.nullable,
    hasDefault: metadata.hasDefault,
    generated: metadata.generated,
    primaryKey: metadata.primaryKey,
    unique: metadata.unique,
    references: metadata.references,
    defaultValue: metadata.defaultValue,
    generatedValue: metadata.generatedValue,
    ddlType: metadata.ddlType,
    identity: metadata.identity,
    source: undefined,
    dependencies: {}
  };
  return column;
};
var remapColumnDefinition = (column, options = {}) => {
  const schema = options.schema ?? column.schema;
  const metadata = options.metadata ?? column.metadata;
  const next = Object.create(ColumnProto);
  next.schema = schema;
  next.metadata = metadata;
  next[TypeId2] = {
    ...column[TypeId2],
    runtime: undefined,
    dbType: metadata.dbType,
    runtimeSchema: schema,
    nullability: metadata.nullable ? "maybe" : "never",
    dialect: metadata.dbType.dialect
  };
  next[ColumnTypeId] = {
    ...column[ColumnTypeId],
    select: undefined,
    insert: undefined,
    update: undefined,
    dbType: metadata.dbType,
    nullable: metadata.nullable,
    hasDefault: metadata.hasDefault,
    generated: metadata.generated,
    primaryKey: metadata.primaryKey,
    unique: metadata.unique,
    references: metadata.references,
    defaultValue: metadata.defaultValue,
    generatedValue: metadata.generatedValue,
    ddlType: metadata.ddlType,
    identity: metadata.identity
  };
  if (TypeId3 in column) {
    next[TypeId3] = column[TypeId3];
  }
  if (BoundColumnTypeId in column) {
    next[BoundColumnTypeId] = column[BoundColumnTypeId];
  }
  return next;
};
var bindColumn = (tableName, columnName, column, baseTableName, schemaName) => {
  const bound = Object.create(ColumnProto);
  bound.schema = column.schema;
  bound.metadata = column.metadata;
  bound[TypeId2] = {
    runtime: undefined,
    dbType: column.metadata.dbType,
    runtimeSchema: column.schema,
    nullability: column.metadata.nullable ? "maybe" : "never",
    dialect: column.metadata.dbType.dialect,
    aggregation: "scalar",
    source: {
      tableName,
      columnName,
      baseTableName
    },
    sourceNullability: "propagate",
    dependencies: {
      [tableName]: true
    }
  };
  bound[TypeId3] = {
    kind: "column",
    tableName,
    columnName
  };
  bound[ColumnTypeId] = column[ColumnTypeId];
  bound[BoundColumnTypeId] = {
    tableName,
    columnName,
    baseTableName,
    schemaName
  };
  return bound;
};

// src/internal/table-options.ts
var normalizeColumnList = (columns) => {
  const normalized = Array.isArray(columns) ? [...columns] : [columns];
  if (normalized.length === 0) {
    throw new Error("Table options require at least one column");
  }
  return normalized;
};
var collectInlineOptions = (fields) => {
  const options = [];
  for (const [columnName, column] of Object.entries(fields)) {
    if (column.metadata.primaryKey) {
      options.push({
        kind: "primaryKey",
        columns: [columnName]
      });
    }
    if (column.metadata.unique && !column.metadata.primaryKey) {
      options.push({
        kind: "unique",
        columns: [columnName]
      });
    }
    if (column.metadata.references) {
      const local = [columnName];
      options.push({
        kind: "foreignKey",
        columns: local,
        references: () => {
          const targetColumn = column.metadata.references.target();
          const bound = targetColumn[BoundColumnTypeId];
          return {
            tableName: bound.baseTableName,
            schemaName: bound.schemaName,
            columns: [bound.columnName]
          };
        }
      });
    }
  }
  return options;
};
var resolvePrimaryKeyColumns = (fields, declaredOptions) => {
  const inline = Object.entries(fields).filter(([, column]) => column.metadata.primaryKey).map(([key]) => key);
  const explicit = declaredOptions.filter((option) => option.kind === "primaryKey").map((option) => option.columns);
  if (explicit.length > 1) {
    throw new Error("Only one primary key declaration is allowed");
  }
  if (explicit.length === 0) {
    return inline;
  }
  const tablePrimaryKey = [...explicit[0]];
  if (inline.length > 0) {
    const same = inline.length === tablePrimaryKey.length && inline.every((column) => tablePrimaryKey.includes(column));
    if (!same) {
      throw new Error("Inline primary keys conflict with table-level primary key declaration");
    }
  }
  return tablePrimaryKey;
};
var validateOptions = (tableName, fields, options) => {
  const knownColumns = new Set(Object.keys(fields));
  for (const option of options) {
    switch (option.kind) {
      case "index":
      case "primaryKey":
      case "unique":
      case "foreignKey": {
        const columns = option.kind === "index" ? option.columns ?? [] : option.columns;
        if (columns.length === 0 && option.kind !== "index") {
          throw new Error(`Option '${option.kind}' on table '${tableName}' requires at least one column`);
        }
        for (const column of columns) {
          if (!knownColumns.has(column)) {
            throw new Error(`Unknown column '${column}' on table '${tableName}'`);
          }
        }
        if (option.kind === "foreignKey") {
          const reference = option.references();
          if (reference.columns.length !== columns.length) {
            throw new Error(`Foreign key on table '${tableName}' must reference the same number of columns`);
          }
          if (reference.knownColumns) {
            const referenced = new Set(reference.knownColumns);
            for (const column of reference.columns) {
              if (!referenced.has(column)) {
                throw new Error(`Unknown referenced column '${column}' on table '${reference.tableName}'`);
              }
            }
          }
        }
        if (option.kind === "index") {
          for (const column of option.include ?? []) {
            if (!knownColumns.has(column)) {
              throw new Error(`Unknown included column '${column}' on table '${tableName}'`);
            }
          }
          for (const key of option.keys ?? []) {
            if (key.kind === "column" && !knownColumns.has(key.column)) {
              throw new Error(`Unknown index key column '${key.column}' on table '${tableName}'`);
            }
          }
          if (option.columns === undefined && (option.keys === undefined || option.keys.length === 0)) {
            throw new Error(`Index on table '${tableName}' requires at least one column or key`);
          }
        }
        break;
      }
      case "check": {
        break;
      }
    }
  }
  for (const column of resolvePrimaryKeyColumns(fields, options)) {
    if (fields[column].metadata.nullable) {
      throw new Error(`Primary key column '${String(column)}' cannot be nullable`);
    }
  }
};

// src/internal/schema-derivation.ts
import * as VariantSchema from "effect/unstable/schema/VariantSchema";
import * as Schema from "effect/Schema";
var TableSchema = VariantSchema.make({
  variants: ["select", "insert", "update"],
  defaultVariant: "select"
});
var selectSchema = (column) => column.metadata.nullable ? Schema.NullOr(column.schema) : column.schema;
var insertSchema = (column) => {
  if (column.metadata.generated) {
    return;
  }
  const base = column.metadata.nullable ? Schema.NullOr(column.schema) : column.schema;
  return column.metadata.nullable || column.metadata.hasDefault ? Schema.optional(base) : base;
};
var updateSchema = (column, isPrimaryKey) => {
  if (column.metadata.generated || isPrimaryKey) {
    return;
  }
  const base = column.metadata.nullable ? Schema.NullOr(column.schema) : column.schema;
  return Schema.optional(base);
};
var deriveSchemas = (fields, primaryKeyColumns) => {
  const primaryKeySet = new Set(primaryKeyColumns);
  const variants = {};
  for (const [key, column] of Object.entries(fields)) {
    const config = {
      select: selectSchema(column),
      insert: undefined,
      update: undefined
    };
    const insert = insertSchema(column);
    const update = updateSchema(column, primaryKeySet.has(key));
    if (insert !== undefined) {
      config.insert = insert;
    } else {
      delete config.insert;
    }
    if (update !== undefined) {
      config.update = update;
    } else {
      delete config.update;
    }
    variants[key] = TableSchema.Field(config);
  }
  const struct = TableSchema.Struct(variants);
  return {
    select: TableSchema.extract(struct, "select"),
    insert: TableSchema.extract(struct, "insert"),
    update: TableSchema.extract(struct, "update")
  };
};

// src/internal/table.ts
var TypeId4 = Symbol.for("effect-qb/Table");
var OptionsSymbol = Symbol.for("effect-qb/Table/normalizedOptions");
var options = Symbol.for("effect-qb/Table/declaredOptions");
var CacheSymbol = Symbol.for("effect-qb/Table/cache");
var DeclaredOptionsSymbol = Symbol.for("effect-qb/Table/factoryDeclaredOptions");
var TableProto = {
  pipe() {
    return pipeArguments2(this, arguments);
  }
};
var buildArtifacts = (name, fields, declaredOptions, schemaName) => {
  const normalizedOptions = [...collectInlineOptions(fields), ...declaredOptions];
  validateFieldDialects(name, fields);
  validateOptions(name, fields, declaredOptions);
  const primaryKey = resolvePrimaryKeyColumns(fields, declaredOptions);
  const columns = Object.fromEntries(Object.entries(fields).map(([key, column]) => [key, bindColumn(name, key, column, name, schemaName)]));
  const schemas = deriveSchemas(fields, primaryKey);
  return {
    columns,
    schemas,
    normalizedOptions,
    primaryKey
  };
};
var makeTable = (name, fields, declaredOptions, baseName = name, kind = "schema", schemaName, schemaMode = "default") => {
  const resolvedSchemaName = schemaMode === "explicit" ? schemaName : "public";
  const artifacts = buildArtifacts(name, fields, declaredOptions, resolvedSchemaName);
  const dialect = resolveFieldDialect(fields);
  const table = Object.create(TableProto);
  table.name = name;
  table.columns = artifacts.columns;
  table.schemas = artifacts.schemas;
  table[TypeId4] = {
    name,
    baseName,
    schemaName: resolvedSchemaName,
    fields,
    primaryKey: artifacts.primaryKey,
    kind
  };
  table[TypeId] = {
    selection: artifacts.columns,
    required: undefined,
    available: {
      [name]: {
        name,
        mode: "required",
        baseName
      }
    },
    dialect
  };
  table[OptionsSymbol] = artifacts.normalizedOptions;
  table[DeclaredOptionsSymbol] = declaredOptions;
  for (const [key, value] of Object.entries(artifacts.columns)) {
    Object.defineProperty(table, key, {
      enumerable: true,
      value
    });
  }
  return table;
};
var extractDeclaredOptions = (declaredOptions) => declaredOptions?.map((option) => option.option) ?? [];
var validateClassOptions = (declaredOptions) => {
  for (const option of declaredOptions) {
    if (option.kind === "primaryKey") {
      throw new Error("Table.Class does not support table-level primary keys; declare primary keys inline on columns");
    }
  }
};
var resolveFieldDialect = (fields) => {
  const dialects = [...new Set(Object.values(fields).map((field) => field.metadata.dbType.dialect))];
  if (dialects.length === 0) {
    return "postgres";
  }
  if (dialects.length > 1) {
    throw new Error(`Mixed table dialects are not supported: ${dialects.join(", ")}`);
  }
  return dialects[0];
};
var validateFieldDialects = (tableName, fields) => {
  try {
    resolveFieldDialect(fields);
  } catch (error) {
    throw new Error(`Invalid dialects for table '${tableName}': ${error.message}`);
  }
};
var ensureClassArtifacts = (self) => {
  const cached = self[CacheSymbol];
  if (cached) {
    return cached;
  }
  const state = self[TypeId4];
  const declaredOptions = extractDeclaredOptions(self[options]);
  validateClassOptions(declaredOptions);
  const artifacts = buildArtifacts(state.name, state.fields, declaredOptions, state.schemaName);
  Object.defineProperty(self, CacheSymbol, {
    configurable: true,
    value: artifacts
  });
  return artifacts;
};
var appendOption = (table, option) => {
  const state = table[TypeId4];
  if (state.kind !== "schema") {
    throw new Error("Table options can only be applied to schema tables, not aliased query sources");
  }
  return makeTable(state.name, state.fields, [...table[DeclaredOptionsSymbol], option], state.baseName, state.kind, state.schemaName, "explicit");
};
var makeOption = (option) => {
  const builder = (table) => appendOption(table, option);
  builder.option = option;
  return builder;
};
var option = (spec) => makeOption(spec);
function make2(name, fields, schemaName) {
  const resolvedSchemaName = arguments.length >= 3 ? schemaName : "public";
  return makeTable(name, fields, [], name, "schema", resolvedSchemaName, arguments.length >= 3 ? "explicit" : "default");
}
var schema = (schemaName) => ({
  schemaName,
  table: (name, fields, ...options2) => makeTable(name, fields, extractDeclaredOptions(options2), name, "schema", schemaName, "explicit")
});
var alias = (table, aliasName) => {
  const state = table[TypeId4];
  const columns = Object.fromEntries(Object.entries(state.fields).map(([key, column]) => [key, bindColumn(aliasName, key, column, state.baseName, state.schemaName)]));
  const aliased = Object.create(TableProto);
  aliased.name = aliasName;
  aliased.columns = columns;
  aliased.schemas = table.schemas;
  aliased[TypeId4] = {
    name: aliasName,
    baseName: state.baseName,
    schemaName: state.schemaName,
    fields: state.fields,
    primaryKey: state.primaryKey,
    kind: "alias"
  };
  aliased[TypeId] = {
    selection: columns,
    required: undefined,
    available: {
      [aliasName]: {
        name: aliasName,
        mode: "required",
        baseName: state.baseName
      }
    },
    dialect: table[TypeId].dialect
  };
  aliased[OptionsSymbol] = table[OptionsSymbol];
  aliased[DeclaredOptionsSymbol] = table[DeclaredOptionsSymbol];
  for (const [key, value] of Object.entries(columns)) {
    Object.defineProperty(aliased, key, {
      enumerable: true,
      value
    });
  }
  return aliased;
};
function Class(name, schemaName) {
  const resolvedSchemaName = arguments.length >= 2 ? schemaName : "public";
  return (fields) => {

    class TableClassBase {
      static tableName = name;
      static get columns() {
        return ensureClassArtifacts(this).columns;
      }
      static get schemas() {
        return ensureClassArtifacts(this).schemas;
      }
      static get [TypeId4]() {
        const declaredOptions = extractDeclaredOptions(this[options]);
        validateClassOptions(declaredOptions);
        return {
          name,
          baseName: name,
          schemaName: resolvedSchemaName,
          fields,
          primaryKey: resolvePrimaryKeyColumns(fields, collectInlineOptions(fields)),
          kind: "schema"
        };
      }
      static get [TypeId]() {
        const artifacts = ensureClassArtifacts(this);
        return {
          selection: artifacts.columns,
          required: undefined,
          available: {
            [name]: {
              name,
              mode: "required",
              baseName: name
            }
          },
          dialect: resolveFieldDialect(fields)
        };
      }
      static get [OptionsSymbol]() {
        return ensureClassArtifacts(this).normalizedOptions;
      }
      static pipe() {
        return pipeArguments2(this, arguments);
      }
    }
    for (const key of Object.keys(fields)) {
      Object.defineProperty(TableClassBase, key, {
        enumerable: true,
        configurable: true,
        get() {
          return ensureClassArtifacts(this).columns[key];
        }
      });
    }
    return TableClassBase;
  };
}
var primaryKey = (columns) => makeOption({
  kind: "primaryKey",
  columns: normalizeColumnList(columns)
});
var unique = (columns) => makeOption({
  kind: "unique",
  columns: normalizeColumnList(columns)
});
var index = (columns) => makeOption({
  kind: "index",
  columns: normalizeColumnList(columns)
});
var foreignKey = (columns, target, referencedColumns) => makeOption({
  kind: "foreignKey",
  columns: normalizeColumnList(columns),
  references: () => ({
    tableName: target()[TypeId4].baseName,
    schemaName: target()[TypeId4].schemaName,
    columns: normalizeColumnList(referencedColumns),
    knownColumns: Object.keys(target()[TypeId4].fields)
  })
});
var check = (name, predicate) => makeOption({
  kind: "check",
  name,
  predicate
});

// src/internal/postgres-dialect.ts
var quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;
var renderLiteral = (value, state) => {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  state.params.push(value);
  return `$${state.params.length}`;
};
var postgresDialect = {
  name: "postgres",
  quoteIdentifier,
  renderLiteral,
  renderTableReference(tableName, baseTableName, schemaName) {
    const renderedBase = schemaName ? `${quoteIdentifier(schemaName)}.${quoteIdentifier(baseTableName)}` : quoteIdentifier(baseTableName);
    return tableName === baseTableName ? renderedBase : `${renderedBase} as ${quoteIdentifier(tableName)}`;
  },
  renderConcat(values) {
    return `(${values.join(" || ")})`;
  }
};

// src/internal/schema-expression.ts
import { parse, toSql } from "pgsql-ast-parser";
import { pipeArguments as pipeArguments3 } from "effect/Pipeable";
var TypeId5 = Symbol.for("effect-qb/SchemaExpression");
var SchemaExpressionProto = {
  pipe() {
    return pipeArguments3(this, arguments);
  }
};
var isSchemaExpression = (value) => typeof value === "object" && value !== null && (TypeId5 in value);
var fromAst = (ast) => {
  const expression = Object.create(SchemaExpressionProto);
  expression[TypeId5] = {
    dialect: "postgres",
    ast
  };
  return expression;
};
var parseExpression = (sql) => fromAst(parse(sql, "expr"));
var toAst = (expression) => expression[TypeId5].ast;
var render = (expression) => toSql.expr(expression[TypeId5].ast);
var normalize = (expression) => parseExpression(render(expression));

// src/internal/query.ts
import { pipeArguments as pipeArguments4 } from "effect/Pipeable";

// src/internal/query-ast.ts
var TypeId6 = Symbol.for("effect-qb/QueryAst");

// src/internal/query-requirements.ts
var read_query_capabilities = ["read"];
var union_query_capabilities = (...values) => [...new Set(values.flatMap((value) => value))];

// src/internal/query.ts
var ExpressionProto = {
  pipe() {
    return pipeArguments4(this, arguments);
  }
};
var PlanProto = {
  pipe() {
    return pipeArguments4(this, arguments);
  }
};
var QueryTypeId = Symbol.for("effect-qb/Query/internal");
var normalizeSources = (source) => source === undefined ? [] : Array.isArray(source) ? source : [source];
var mergeSources = (left, right) => {
  const values = [...normalizeSources(left), ...normalizeSources(right)];
  if (values.length === 0) {
    return;
  }
  if (values.length === 1) {
    return values[0];
  }
  return values;
};
var mergeDependencies = (left, right = {}) => ({
  ...left,
  ...right
});
var mergeAggregationRuntime = (left, right = "scalar") => left === "window" || right === "window" ? "window" : left === "aggregate" || right === "aggregate" ? "aggregate" : "scalar";
var mergeAggregationManyRuntime = (values) => values.reduce((current, value) => mergeAggregationRuntime(current, value[TypeId2].aggregation), "scalar");
var mergeNullabilityRuntime = (left, right = "never") => left === "always" || right === "always" ? "always" : left === "maybe" || right === "maybe" ? "maybe" : "never";
var mergeNullabilityManyRuntime = (values) => values.reduce((current, value) => mergeNullabilityRuntime(current, value[TypeId2].nullability), "never");
var mergeManySources = (values) => values.reduce((current, value) => mergeSources(current, value[TypeId2].source), undefined);
var mergeManyDependencies = (values) => values.reduce((current, value) => mergeDependencies(current, value[TypeId2].dependencies), {});
var makeExpression = (state, ast) => {
  const expression = Object.create(ExpressionProto);
  expression[TypeId2] = state;
  expression[TypeId3] = ast;
  return expression;
};
var makePlan = (state, ast, _assumptions, _capabilities, _statement, _target, _insertState) => {
  const plan = Object.create(PlanProto);
  plan[TypeId] = state;
  plan[TypeId6] = ast;
  plan[QueryTypeId] = {
    required: undefined,
    availableNames: undefined,
    grouped: undefined,
    assumptions: undefined,
    capabilities: undefined,
    statement: _statement ?? "select",
    target: _target ?? undefined,
    insertSource: _insertState ?? "ready"
  };
  return plan;
};
var getAst = (plan) => plan[TypeId6];
var getQueryState = (plan) => plan[QueryTypeId];
var extractRequiredRuntime = (selection) => {
  const required = new Set;
  const visit = (value) => {
    if (TypeId2 in value) {
      for (const tableName of Object.keys(value[TypeId2].dependencies)) {
        required.add(tableName);
      }
      return;
    }
    for (const nested of Object.values(value)) {
      visit(nested);
    }
  };
  visit(selection);
  return [...required];
};
var extractSingleSelectedExpressionRuntime = (selection) => {
  const keys = Object.keys(selection);
  if (keys.length !== 1) {
    throw new Error("scalar subqueries must select exactly one top-level expression");
  }
  const record = selection;
  const value = record[keys[0]];
  if (value === null || typeof value !== "object" || !(TypeId2 in value)) {
    throw new Error("scalar subqueries must select a scalar expression");
  }
  return value;
};
var currentRequiredList = (required) => Array.isArray(required) ? [...required] : required === undefined ? [] : [required];

// src/internal/json/path.ts
var SegmentTypeId = Symbol.for("effect-qb/JsonPathSegment");
var TypeId7 = Symbol.for("effect-qb/JsonPath");
var makeSegment = (segment) => segment;
var key = (value) => makeSegment({
  [SegmentTypeId]: {
    kind: "key"
  },
  kind: "key",
  key: value
});
var index2 = (value) => makeSegment({
  [SegmentTypeId]: {
    kind: "index"
  },
  kind: "index",
  index: value
});
var wildcard = () => makeSegment({
  [SegmentTypeId]: {
    kind: "wildcard"
  },
  kind: "wildcard"
});
var slice = (start, end) => makeSegment({
  [SegmentTypeId]: {
    kind: "slice"
  },
  kind: "slice",
  start,
  end
});
var descend = () => makeSegment({
  [SegmentTypeId]: {
    kind: "descend"
  },
  kind: "descend"
});
var path = (...segments) => ({
  [TypeId7]: {
    segments
  },
  segments
});

// src/internal/projection-alias.ts
var TypeId8 = Symbol.for("effect-qb/ProjectionAlias");

// src/internal/projections.ts
var aliasFromPath = (path2) => path2.join("__");
var isExpression = (value) => typeof value === "object" && value !== null && (TypeId2 in value);
var projectionAliasOf = (expression) => (TypeId8 in expression) ? expression[TypeId8].alias : undefined;
var pathKeyOf = (path2) => JSON.stringify(path2);
var formatProjectionPath = (path2) => path2.join(".");
var isPrefixPath = (left, right) => left.length < right.length && left.every((segment, index3) => segment === right[index3]);
var flattenSelection = (selection, path2 = []) => {
  const fields = [];
  for (const [key2, value] of Object.entries(selection)) {
    const nextPath = [...path2, key2];
    if (isExpression(value)) {
      fields.push({
        path: nextPath,
        expression: value,
        alias: projectionAliasOf(value) ?? aliasFromPath(nextPath)
      });
      continue;
    }
    fields.push(...flattenSelection(value, nextPath));
  }
  return fields;
};
var validateProjections = (projections) => {
  const seen = new Set;
  const pathKeys = new Set;
  for (const projection of projections) {
    if (seen.has(projection.alias)) {
      throw new Error(`Duplicate projection alias: ${projection.alias}`);
    }
    seen.add(projection.alias);
    const pathKey = pathKeyOf(projection.path);
    if (pathKeys.has(pathKey)) {
      throw new Error(`Duplicate projection path: ${formatProjectionPath(projection.path)}`);
    }
    pathKeys.add(pathKey);
  }
  for (let index3 = 0;index3 < projections.length; index3++) {
    const current = projections[index3];
    for (let compareIndex = index3 + 1;compareIndex < projections.length; compareIndex++) {
      const other = projections[compareIndex];
      if (isPrefixPath(current.path, other.path) || isPrefixPath(other.path, current.path)) {
        throw new Error(`Conflicting projection paths: ${formatProjectionPath(current.path)} conflicts with ${formatProjectionPath(other.path)}`);
      }
    }
  }
};

// src/internal/grouping-key.ts
var literalGroupingKey = (value) => {
  if (value instanceof Date) {
    return `date:${value.toISOString()}`;
  }
  if (value === null) {
    return "null";
  }
  switch (typeof value) {
    case "string":
      return `string:${JSON.stringify(value)}`;
    case "number":
      return `number:${value}`;
    case "boolean":
      return `boolean:${value}`;
    default:
      return `literal:${JSON.stringify(value)}`;
  }
};
var groupingKeyOfExpression = (expression) => {
  const ast = expression[TypeId3];
  switch (ast.kind) {
    case "column":
      return `column:${ast.tableName}.${ast.columnName}`;
    case "literal":
      return `literal:${literalGroupingKey(ast.value)}`;
    case "cast":
      return `cast(${groupingKeyOfExpression(ast.value)} as ${ast.target.dialect}:${ast.target.kind})`;
    case "isNull":
    case "isNotNull":
    case "not":
    case "upper":
    case "lower":
    case "count":
    case "max":
    case "min":
      return `${ast.kind}(${groupingKeyOfExpression(ast.value)})`;
    case "eq":
    case "neq":
    case "lt":
    case "lte":
    case "gt":
    case "gte":
    case "like":
    case "ilike":
    case "isDistinctFrom":
    case "isNotDistinctFrom":
      return `${ast.kind}(${groupingKeyOfExpression(ast.left)},${groupingKeyOfExpression(ast.right)})`;
    case "and":
    case "or":
    case "coalesce":
    case "concat":
    case "in":
    case "notIn":
    case "between":
      return `${ast.kind}(${ast.values.map(groupingKeyOfExpression).join(",")})`;
    case "case":
      return `case(${ast.branches.map((branch) => `when:${groupingKeyOfExpression(branch.when)}=>${groupingKeyOfExpression(branch.then)}`).join("|")};else:${groupingKeyOfExpression(ast.else)})`;
    default:
      throw new Error("Unsupported expression for grouping key generation");
  }
};
var dedupeGroupedExpressions = (values) => {
  const seen = new Set;
  return values.filter((value) => {
    const key2 = groupingKeyOfExpression(value);
    if (seen.has(key2)) {
      return false;
    }
    seen.add(key2);
    return true;
  });
};

// src/internal/aggregation-validation.ts
var isExpression2 = (value) => typeof value === "object" && value !== null && (TypeId2 in value);
var selectionHasAggregate = (selection) => {
  if (isExpression2(selection)) {
    return selection[TypeId2].aggregation === "aggregate";
  }
  return Object.values(selection).some((value) => selectionHasAggregate(value));
};
var isGroupedSelectionValid = (selection, groupedExpressions) => {
  if (isExpression2(selection)) {
    const aggregation = selection[TypeId2].aggregation;
    if (aggregation === "aggregate") {
      return true;
    }
    if (aggregation === "window") {
      return false;
    }
    if (Object.keys(selection[TypeId2].dependencies).length === 0) {
      return true;
    }
    return groupedExpressions.has(groupingKeyOfExpression(selection));
  }
  return Object.values(selection).every((value) => isGroupedSelectionValid(value, groupedExpressions));
};
var validateAggregationSelection = (selection, grouped) => {
  const groupedExpressions = new Set(grouped.map(groupingKeyOfExpression));
  const hasAggregate = selectionHasAggregate(selection);
  const isValid = hasAggregate || grouped.length > 0 ? isGroupedSelectionValid(selection, groupedExpressions) : true;
  if (!isValid) {
    throw new Error("Invalid grouped selection: scalar expressions must be covered by groupBy(...) when aggregates are present");
  }
};

// src/internal/sql-expression-renderer.ts
var renderDbType = (dialect, dbType) => {
  if (dialect.name === "mysql" && dbType.dialect === "mysql" && dbType.kind === "uuid") {
    return "char(36)";
  }
  return dbType.kind;
};
var renderCastType = (dialect, dbType) => {
  if (dialect.name !== "mysql") {
    return dbType.kind;
  }
  switch (dbType.kind) {
    case "text":
      return "char";
    case "uuid":
      return "char(36)";
    case "numeric":
      return "decimal";
    case "timestamp":
      return "datetime";
    case "bool":
    case "boolean":
      return "boolean";
    case "json":
      return "json";
    default:
      return dbType.kind;
  }
};
var renderDdlExpression = (expression, state, dialect) => isSchemaExpression(expression) ? render(expression) : renderExpression(expression, state, dialect);
var renderColumnDefinition = (dialect, state, columnName, column) => {
  const clauses = [
    dialect.quoteIdentifier(columnName),
    column.metadata.ddlType ?? renderDbType(dialect, column.metadata.dbType)
  ];
  if (column.metadata.identity) {
    clauses.push(`generated ${column.metadata.identity.generation === "byDefault" ? "by default" : "always"} as identity`);
  } else if (column.metadata.generatedValue) {
    clauses.push(`generated always as (${renderDdlExpression(column.metadata.generatedValue, state, dialect)}) stored`);
  } else if (column.metadata.defaultValue) {
    clauses.push(`default ${renderDdlExpression(column.metadata.defaultValue, state, dialect)}`);
  }
  if (!column.metadata.nullable) {
    clauses.push("not null");
  }
  return clauses.join(" ");
};
var renderCreateTableSql = (targetSource, state, dialect, ifNotExists) => {
  const table = targetSource.source;
  const fields = table[TypeId4].fields;
  const definitions = Object.entries(fields).map(([columnName, column]) => renderColumnDefinition(dialect, state, columnName, column));
  for (const option2 of table[OptionsSymbol]) {
    switch (option2.kind) {
      case "primaryKey":
        definitions.push(`${option2.name ? `constraint ${dialect.quoteIdentifier(option2.name)} ` : ""}primary key (${option2.columns.map((column) => dialect.quoteIdentifier(column)).join(", ")})${option2.deferrable ? ` deferrable${option2.initiallyDeferred ? " initially deferred" : ""}` : ""}`);
        break;
      case "unique":
        definitions.push(`${option2.name ? `constraint ${dialect.quoteIdentifier(option2.name)} ` : ""}unique${option2.nullsNotDistinct ? " nulls not distinct" : ""} (${option2.columns.map((column) => dialect.quoteIdentifier(column)).join(", ")})${option2.deferrable ? ` deferrable${option2.initiallyDeferred ? " initially deferred" : ""}` : ""}`);
        break;
      case "foreignKey": {
        const reference = option2.references();
        definitions.push(`${option2.name ? `constraint ${dialect.quoteIdentifier(option2.name)} ` : ""}foreign key (${option2.columns.map((column) => dialect.quoteIdentifier(column)).join(", ")}) references ${dialect.renderTableReference(reference.tableName, reference.tableName, reference.schemaName)} (${reference.columns.map((column) => dialect.quoteIdentifier(column)).join(", ")})${option2.onDelete ? ` on delete ${option2.onDelete.replace(/[A-Z]/g, (value) => ` ${value.toLowerCase()}`).trim()}` : ""}${option2.onUpdate ? ` on update ${option2.onUpdate.replace(/[A-Z]/g, (value) => ` ${value.toLowerCase()}`).trim()}` : ""}${option2.deferrable ? ` deferrable${option2.initiallyDeferred ? " initially deferred" : ""}` : ""}`);
        break;
      }
      case "check":
        definitions.push(`constraint ${dialect.quoteIdentifier(option2.name)} check (${renderDdlExpression(option2.predicate, state, dialect)})${option2.noInherit ? " no inherit" : ""}`);
        break;
      case "index":
        break;
    }
  }
  return `create table${ifNotExists ? " if not exists" : ""} ${renderSourceReference(targetSource.source, targetSource.tableName, targetSource.baseTableName, state, dialect)} (${definitions.join(", ")})`;
};
var renderCreateIndexSql = (targetSource, ddl, state, dialect) => {
  const maybeIfNotExists = dialect.name === "postgres" && ddl.ifNotExists ? " if not exists" : "";
  return `create${ddl.unique ? " unique" : ""} index${maybeIfNotExists} ${dialect.quoteIdentifier(ddl.name)} on ${renderSourceReference(targetSource.source, targetSource.tableName, targetSource.baseTableName, state, dialect)} (${ddl.columns.map((column) => dialect.quoteIdentifier(column)).join(", ")})`;
};
var renderDropIndexSql = (targetSource, ddl, state, dialect) => dialect.name === "postgres" ? `drop index${ddl.ifExists ? " if exists" : ""} ${dialect.quoteIdentifier(ddl.name)}` : `drop index ${dialect.quoteIdentifier(ddl.name)} on ${renderSourceReference(targetSource.source, targetSource.tableName, targetSource.baseTableName, state, dialect)}`;
var isExpression3 = (value) => value !== null && typeof value === "object" && (TypeId2 in value);
var isJsonDbType = (dbType) => dbType.kind === "jsonb" || dbType.kind === "json" || ("variant" in dbType) && dbType.variant === "json";
var isJsonExpression = (value) => isExpression3(value) && isJsonDbType(value[TypeId2].dbType);
var unsupportedJsonFeature = (dialect, feature) => {
  const error = new Error(`Unsupported JSON feature for ${dialect.name}: ${feature}`);
  Object.assign(error, {
    tag: `@${dialect.name}/unsupported/json-feature`,
    dialect: dialect.name,
    feature
  });
  throw error;
};
var extractJsonBase = (node) => node.value ?? node.base ?? node.input ?? node.left ?? node.target;
var isJsonPathValue = (value) => value !== null && typeof value === "object" && (TypeId7 in value);
var extractJsonPathSegments = (node) => {
  const path2 = node.path ?? node.segments ?? node.keys;
  if (isJsonPathValue(path2)) {
    return path2.segments;
  }
  if (Array.isArray(path2)) {
    return path2;
  }
  if ("key" in node) {
    return [key(String(node.key))];
  }
  if ("segment" in node) {
    const segment = node.segment;
    if (typeof segment === "string") {
      return [key(segment)];
    }
    if (typeof segment === "number") {
      return [index2(segment)];
    }
    if (segment !== null && typeof segment === "object" && SegmentTypeId in segment) {
      return [segment];
    }
    return [];
  }
  if ("right" in node && isJsonPathValue(node.right)) {
    return node.right.segments;
  }
  return [];
};
var extractJsonValue = (node) => node.newValue ?? node.insert ?? node.right;
var renderJsonPathSegment = (segment) => {
  if (typeof segment === "string") {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(segment) ? `.${segment}` : `."${segment.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
  }
  if (typeof segment === "number") {
    return `[${segment}]`;
  }
  switch (segment.kind) {
    case "key":
      return /^[A-Za-z_][A-Za-z0-9_]*$/.test(segment.key) ? `.${segment.key}` : `."${segment.key.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
    case "index":
      return `[${segment.index}]`;
    case "wildcard":
      return "[*]";
    case "slice":
      return `[${segment.start ?? 0} to ${segment.end ?? "last"}]`;
    case "descend":
      return ".**";
    default:
      throw new Error("Unsupported JSON path segment");
  }
};
var renderJsonPathStringLiteral = (segments) => {
  let path2 = "$";
  for (const segment of segments) {
    path2 += renderJsonPathSegment(segment);
  }
  return path2;
};
var renderMySqlJsonPath = (segments, state, dialect) => dialect.renderLiteral(renderJsonPathStringLiteral(segments), state);
var renderPostgresJsonPathArray = (segments, state, dialect) => `array[${segments.map((segment) => {
  if (typeof segment === "string") {
    return dialect.renderLiteral(segment, state);
  }
  if (typeof segment === "number") {
    return dialect.renderLiteral(String(segment), state);
  }
  switch (segment.kind) {
    case "key":
      return dialect.renderLiteral(segment.key, state);
    case "index":
      return dialect.renderLiteral(String(segment.index), state);
    default:
      throw new Error("Postgres JSON traversal requires exact key/index segments");
  }
}).join(", ")}]`;
var renderPostgresTextLiteral = (value, state, dialect) => `cast(${dialect.renderLiteral(value, state)} as text)`;
var renderPostgresJsonAccessStep = (segment, textMode, state, dialect) => {
  switch (segment.kind) {
    case "key":
      return `${textMode ? "->>" : "->"} ${dialect.renderLiteral(segment.key, state)}`;
    case "index":
      return `${textMode ? "->>" : "->"} ${dialect.renderLiteral(String(segment.index), state)}`;
    default:
      throw new Error("Postgres exact JSON access requires key/index segments");
  }
};
var renderPostgresJsonValue = (value, state, dialect) => {
  if (!isExpression3(value)) {
    throw new Error("Expected a JSON expression");
  }
  const rendered = renderExpression(value, state, dialect);
  return value[TypeId2].dbType.kind === "jsonb" ? rendered : `cast(${rendered} as jsonb)`;
};
var renderPostgresJsonKind = (value) => value[TypeId2].dbType.kind === "jsonb" ? "jsonb" : "json";
var renderJsonOpaquePath = (value, state, dialect) => {
  if (isJsonPathValue(value)) {
    return dialect.renderLiteral(renderJsonPathStringLiteral(value.segments), state);
  }
  if (typeof value === "string") {
    return dialect.renderLiteral(value, state);
  }
  if (isExpression3(value)) {
    return renderExpression(value, state, dialect);
  }
  throw new Error("Unsupported SQL/JSON path input");
};
var renderFunctionCall = (name, args, state, dialect) => {
  if (name === "array") {
    return `ARRAY[${args.map((arg) => renderExpression(arg, state, dialect)).join(", ")}]`;
  }
  if (name === "extract" && args.length === 2) {
    const field = args[0];
    const source = args[1];
    if (field === undefined) {
      throw new Error("Unsupported SQL extract expression");
    }
    if (source === undefined) {
      throw new Error("Unsupported SQL extract expression");
    }
    const fieldRuntime = isExpression3(field) && field[TypeId2].dbType.kind === "text" && typeof field[TypeId2].runtime === "string" ? field[TypeId2].runtime : undefined;
    const renderedField = fieldRuntime ?? renderExpression(field, state, dialect);
    return `extract(${renderedField} from ${renderExpression(source, state, dialect)})`;
  }
  const renderedArgs = args.map((arg) => renderExpression(arg, state, dialect)).join(", ");
  if (args.length === 0) {
    switch (name) {
      case "current_date":
      case "current_time":
      case "current_timestamp":
      case "localtime":
      case "localtimestamp":
        return name;
      default:
        return `${name}()`;
    }
  }
  return `${name}(${renderedArgs})`;
};
var renderJsonExpression = (expression, ast, state, dialect) => {
  const kind = typeof ast.kind === "string" ? ast.kind : undefined;
  if (!kind) {
    return;
  }
  const base = extractJsonBase(ast);
  const segments = extractJsonPathSegments(ast);
  const exact = segments.every((segment) => segment.kind === "key" || segment.kind === "index");
  const postgresExpressionKind = dialect.name === "postgres" && isJsonExpression(expression) ? renderPostgresJsonKind(expression) : undefined;
  const postgresBaseKind = dialect.name === "postgres" && isJsonExpression(base) ? renderPostgresJsonKind(base) : undefined;
  switch (kind) {
    case "jsonGet":
    case "jsonPath":
    case "jsonAccess":
    case "jsonTraverse":
    case "jsonGetText":
    case "jsonPathText":
    case "jsonAccessText":
    case "jsonTraverseText": {
      if (!isExpression3(base) || segments.length === 0) {
        return;
      }
      const baseSql = renderExpression(base, state, dialect);
      const textMode = kind.endsWith("Text") || ast.text === true || ast.asText === true;
      if (dialect.name === "postgres") {
        if (exact) {
          return segments.length === 1 ? `(${baseSql} ${renderPostgresJsonAccessStep(segments[0], textMode, state, dialect)})` : `(${baseSql} ${textMode ? "#>>" : "#>"} ${renderPostgresJsonPathArray(segments, state, dialect)})`;
        }
        const jsonPathLiteral = dialect.renderLiteral(renderJsonPathStringLiteral(segments), state);
        const queried = `jsonb_path_query_first(${renderPostgresJsonValue(base, state, dialect)}, ${jsonPathLiteral})`;
        return textMode ? `(${queried} #>> '{}')` : queried;
      }
      if (dialect.name === "mysql") {
        const extracted = `json_extract(${baseSql}, ${renderMySqlJsonPath(segments, state, dialect)})`;
        return textMode ? `json_unquote(${extracted})` : extracted;
      }
      return;
    }
    case "jsonHasKey":
    case "jsonKeyExists":
    case "jsonHasAnyKeys":
    case "jsonHasAllKeys": {
      if (!isExpression3(base)) {
        return;
      }
      const baseSql = dialect.name === "postgres" ? renderPostgresJsonValue(base, state, dialect) : renderExpression(base, state, dialect);
      const keys = segments;
      if (keys.length === 0) {
        return;
      }
      if (dialect.name === "postgres") {
        if (kind === "jsonHasAnyKeys") {
          return `(${baseSql} ?| array[${keys.map((key2) => renderPostgresTextLiteral(String(key2), state, dialect)).join(", ")}])`;
        }
        if (kind === "jsonHasAllKeys") {
          return `(${baseSql} ?& array[${keys.map((key2) => renderPostgresTextLiteral(String(key2), state, dialect)).join(", ")}])`;
        }
        return `(${baseSql} ? ${renderPostgresTextLiteral(String(keys[0]), state, dialect)})`;
      }
      if (dialect.name === "mysql") {
        const mode = kind === "jsonHasAllKeys" ? "all" : "one";
        const paths = keys.map((segment) => renderMySqlJsonPath([segment], state, dialect)).join(", ");
        return `json_contains_path(${baseSql}, ${dialect.renderLiteral(mode, state)}, ${paths})`;
      }
      return;
    }
    case "jsonConcat":
    case "jsonMerge": {
      if (!isExpression3(ast.left) || !isExpression3(ast.right)) {
        return;
      }
      if (dialect.name === "postgres") {
        return `(${renderPostgresJsonValue(ast.left, state, dialect)} || ${renderPostgresJsonValue(ast.right, state, dialect)})`;
      }
      if (dialect.name === "mysql") {
        return `json_merge_preserve(${renderExpression(ast.left, state, dialect)}, ${renderExpression(ast.right, state, dialect)})`;
      }
      return;
    }
    case "jsonBuildObject": {
      const entries = Array.isArray(ast.entries) ? ast.entries : [];
      const renderedEntries = entries.flatMap((entry) => [
        dialect.renderLiteral(entry.key, state),
        renderExpression(entry.value, state, dialect)
      ]);
      if (dialect.name === "postgres") {
        return `${postgresExpressionKind === "jsonb" ? "jsonb" : "json"}_build_object(${renderedEntries.join(", ")})`;
      }
      if (dialect.name === "mysql") {
        return `json_object(${renderedEntries.join(", ")})`;
      }
      return;
    }
    case "jsonBuildArray": {
      const values = Array.isArray(ast.values) ? ast.values : [];
      const renderedValues = values.map((value) => renderExpression(value, state, dialect)).join(", ");
      if (dialect.name === "postgres") {
        return `${postgresExpressionKind === "jsonb" ? "jsonb" : "json"}_build_array(${renderedValues})`;
      }
      if (dialect.name === "mysql") {
        return `json_array(${renderedValues})`;
      }
      return;
    }
    case "jsonToJson":
      if (!isExpression3(base)) {
        return;
      }
      if (dialect.name === "postgres") {
        return `to_json(${renderExpression(base, state, dialect)})`;
      }
      if (dialect.name === "mysql") {
        return `cast(${renderExpression(base, state, dialect)} as json)`;
      }
      return;
    case "jsonToJsonb":
      if (!isExpression3(base)) {
        return;
      }
      if (dialect.name === "postgres") {
        return `to_jsonb(${renderExpression(base, state, dialect)})`;
      }
      if (dialect.name === "mysql") {
        return `cast(${renderExpression(base, state, dialect)} as json)`;
      }
      return;
    case "jsonTypeOf":
      if (!isExpression3(base)) {
        return;
      }
      if (dialect.name === "postgres") {
        const baseSql = renderExpression(base, state, dialect);
        return `${postgresBaseKind === "jsonb" ? "jsonb" : "json"}_typeof(${baseSql})`;
      }
      if (dialect.name === "mysql") {
        return `json_type(${renderExpression(base, state, dialect)})`;
      }
      return;
    case "jsonLength":
      if (!isExpression3(base)) {
        return;
      }
      if (dialect.name === "postgres") {
        const baseSql = renderExpression(base, state, dialect);
        const typeOf = `${postgresBaseKind === "jsonb" ? "jsonb" : "json"}_typeof`;
        const arrayLength = `${postgresBaseKind === "jsonb" ? "jsonb" : "json"}_array_length`;
        const objectKeys = `${postgresBaseKind === "jsonb" ? "jsonb" : "json"}_object_keys`;
        return `(case when ${typeOf}(${baseSql}) = 'array' then ${arrayLength}(${baseSql}) when ${typeOf}(${baseSql}) = 'object' then (select count(*)::int from ${objectKeys}(${baseSql})) else null end)`;
      }
      if (dialect.name === "mysql") {
        return `json_length(${renderExpression(base, state, dialect)})`;
      }
      return;
    case "jsonKeys":
      if (!isExpression3(base)) {
        return;
      }
      if (dialect.name === "postgres") {
        const baseSql = renderExpression(base, state, dialect);
        const typeOf = `${postgresBaseKind === "jsonb" ? "jsonb" : "json"}_typeof`;
        const objectKeys = `${postgresBaseKind === "jsonb" ? "jsonb" : "json"}_object_keys`;
        return `(case when ${typeOf}(${baseSql}) = 'object' then array(select ${objectKeys}(${baseSql})) else null end)`;
      }
      if (dialect.name === "mysql") {
        return `json_keys(${renderExpression(base, state, dialect)})`;
      }
      return;
    case "jsonStripNulls":
      if (!isExpression3(base)) {
        return;
      }
      if (dialect.name === "postgres") {
        return `${postgresBaseKind === "jsonb" ? "jsonb" : "json"}_strip_nulls(${renderExpression(base, state, dialect)})`;
      }
      unsupportedJsonFeature(dialect, "jsonStripNulls");
      return;
    case "jsonDelete":
    case "jsonDeletePath":
    case "jsonRemove": {
      if (!isExpression3(base) || segments.length === 0) {
        return;
      }
      if (dialect.name === "postgres") {
        const baseSql = renderPostgresJsonValue(base, state, dialect);
        if (segments.length === 1 && (segments[0].kind === "key" || segments[0].kind === "index")) {
          const segment = segments[0];
          return `(${baseSql} - ${segment.kind === "key" ? dialect.renderLiteral(segment.key, state) : dialect.renderLiteral(String(segment.index), state)})`;
        }
        return `(${baseSql} #- ${renderPostgresJsonPathArray(segments, state, dialect)})`;
      }
      if (dialect.name === "mysql") {
        return `json_remove(${renderExpression(base, state, dialect)}, ${segments.map((segment) => renderMySqlJsonPath([segment], state, dialect)).join(", ")})`;
      }
      return;
    }
    case "jsonSet":
    case "jsonInsert": {
      if (!isExpression3(base) || segments.length === 0) {
        return;
      }
      const nextValue = extractJsonValue(ast);
      if (!isExpression3(nextValue)) {
        return;
      }
      const createMissing = ast.createMissing === true;
      const insertAfter = ast.insertAfter === true;
      if (dialect.name === "postgres") {
        const functionName = kind === "jsonInsert" ? "jsonb_insert" : "jsonb_set";
        const extra = kind === "jsonInsert" ? `, ${insertAfter ? "true" : "false"}` : `, ${createMissing ? "true" : "false"}`;
        return `${functionName}(${renderPostgresJsonValue(base, state, dialect)}, ${renderPostgresJsonPathArray(segments, state, dialect)}, ${renderPostgresJsonValue(nextValue, state, dialect)}${extra})`;
      }
      if (dialect.name === "mysql") {
        const functionName = kind === "jsonInsert" ? "json_insert" : "json_set";
        return `${functionName}(${renderExpression(base, state, dialect)}, ${renderMySqlJsonPath(segments, state, dialect)}, ${renderExpression(nextValue, state, dialect)})`;
      }
      return;
    }
    case "jsonPathExists": {
      if (!isExpression3(base)) {
        return;
      }
      const path2 = ast.path ?? ast.query ?? ast.right;
      if (path2 === undefined) {
        return;
      }
      if (dialect.name === "postgres") {
        return `(${renderPostgresJsonValue(base, state, dialect)} @? ${renderJsonOpaquePath(path2, state, dialect)})`;
      }
      if (dialect.name === "mysql") {
        return `json_contains_path(${renderExpression(base, state, dialect)}, ${dialect.renderLiteral("one", state)}, ${renderJsonOpaquePath(path2, state, dialect)})`;
      }
      return;
    }
    case "jsonPathMatch": {
      if (!isExpression3(base)) {
        return;
      }
      const path2 = ast.path ?? ast.query ?? ast.right;
      if (path2 === undefined) {
        return;
      }
      if (dialect.name === "postgres") {
        return `(${renderPostgresJsonValue(base, state, dialect)} @@ ${renderJsonOpaquePath(path2, state, dialect)})`;
      }
      unsupportedJsonFeature(dialect, "jsonPathMatch");
    }
  }
  return;
};
var selectionProjections = (selection) => flattenSelection(selection).map(({ path: path2, alias: alias2 }) => ({
  path: path2,
  alias: alias2
}));
var renderMutationAssignment = (entry, state, dialect) => {
  const column = entry.tableName && dialect.name === "mysql" ? `${dialect.quoteIdentifier(entry.tableName)}.${dialect.quoteIdentifier(entry.columnName)}` : dialect.quoteIdentifier(entry.columnName);
  return `${column} = ${renderExpression(entry.value, state, dialect)}`;
};
var renderJoinSourcesForMutation = (joins, state, dialect) => joins.map((join) => renderSourceReference(join.source, join.tableName, join.baseTableName, state, dialect)).join(", ");
var renderFromSources = (sources, state, dialect) => sources.map((source) => renderSourceReference(source.source, source.tableName, source.baseTableName, state, dialect)).join(", ");
var renderJoinPredicatesForMutation = (joins, state, dialect) => joins.flatMap((join) => join.kind === "cross" || !join.on ? [] : [renderExpression(join.on, state, dialect)]);
var renderDeleteTargets = (targets, dialect) => targets.map((target) => dialect.quoteIdentifier(target.tableName)).join(", ");
var renderMysqlMutationLock = (lock, statement) => {
  if (!lock) {
    return "";
  }
  switch (lock.mode) {
    case "lowPriority":
      return " low_priority";
    case "ignore":
      return " ignore";
    case "quick":
      return statement === "delete" ? " quick" : "";
    default:
      return "";
  }
};
var renderTransactionClause = (clause, dialect) => {
  switch (clause.kind) {
    case "transaction": {
      const modes = [];
      if (clause.isolationLevel) {
        modes.push(`isolation level ${clause.isolationLevel}`);
      }
      if (clause.readOnly === true) {
        modes.push("read only");
      }
      return modes.length > 0 ? `start transaction ${modes.join(", ")}` : "start transaction";
    }
    case "commit":
      return "commit";
    case "rollback":
      return "rollback";
    case "savepoint":
      return `savepoint ${dialect.quoteIdentifier(clause.name)}`;
    case "rollbackTo":
      return `rollback to savepoint ${dialect.quoteIdentifier(clause.name)}`;
    case "releaseSavepoint":
      return `release savepoint ${dialect.quoteIdentifier(clause.name)}`;
  }
  return "";
};
var renderSelectionList = (selection, state, dialect, validateAggregation) => {
  if (validateAggregation) {
    validateAggregationSelection(selection, []);
  }
  const flattened = flattenSelection(selection);
  const projections = selectionProjections(selection);
  const sql = flattened.map(({ expression, alias: alias2 }) => `${renderExpression(expression, state, dialect)} as ${dialect.quoteIdentifier(alias2)}`).join(", ");
  return {
    sql,
    projections
  };
};
var renderQueryAst = (ast, state, dialect) => {
  let sql = "";
  let projections = [];
  switch (ast.kind) {
    case "select": {
      validateAggregationSelection(ast.select, ast.groupBy);
      const rendered = renderSelectionList(ast.select, state, dialect, false);
      projections = rendered.projections;
      const clauses = [
        ast.distinctOn && ast.distinctOn.length > 0 ? `select distinct on (${ast.distinctOn.map((value) => renderExpression(value, state, dialect)).join(", ")}) ${rendered.sql}` : `select${ast.distinct ? " distinct" : ""} ${rendered.sql}`
      ];
      if (ast.from) {
        clauses.push(`from ${renderSourceReference(ast.from.source, ast.from.tableName, ast.from.baseTableName, state, dialect)}`);
      }
      for (const join of ast.joins) {
        const source = renderSourceReference(join.source, join.tableName, join.baseTableName, state, dialect);
        clauses.push(join.kind === "cross" ? `cross join ${source}` : `${join.kind} join ${source} on ${renderExpression(join.on, state, dialect)}`);
      }
      if (ast.where.length > 0) {
        clauses.push(`where ${ast.where.map((entry) => renderExpression(entry.predicate, state, dialect)).join(" and ")}`);
      }
      if (ast.groupBy.length > 0) {
        clauses.push(`group by ${ast.groupBy.map((value) => renderExpression(value, state, dialect)).join(", ")}`);
      }
      if (ast.having.length > 0) {
        clauses.push(`having ${ast.having.map((entry) => renderExpression(entry.predicate, state, dialect)).join(" and ")}`);
      }
      if (ast.orderBy.length > 0) {
        clauses.push(`order by ${ast.orderBy.map((entry) => `${renderExpression(entry.value, state, dialect)} ${entry.direction}`).join(", ")}`);
      }
      if (ast.limit) {
        clauses.push(`limit ${renderExpression(ast.limit, state, dialect)}`);
      }
      if (ast.offset) {
        clauses.push(`offset ${renderExpression(ast.offset, state, dialect)}`);
      }
      if (ast.lock) {
        clauses.push(`${ast.lock.mode === "update" ? "for update" : "for share"}${ast.lock.nowait ? " nowait" : ""}${ast.lock.skipLocked ? " skip locked" : ""}`);
      }
      sql = clauses.join(" ");
      break;
    }
    case "set": {
      const setAst = ast;
      const base = renderQueryAst(getAst(setAst.setBase), state, dialect);
      projections = selectionProjections(setAst.select);
      sql = [
        `(${base.sql})`,
        ...(setAst.setOperations ?? []).map((entry) => {
          const rendered = renderQueryAst(getAst(entry.query), state, dialect);
          return `${entry.kind}${entry.all ? " all" : ""} (${rendered.sql})`;
        })
      ].join(" ");
      break;
    }
    case "insert": {
      const insertAst = ast;
      const targetSource = insertAst.into;
      const target = renderSourceReference(targetSource.source, targetSource.tableName, targetSource.baseTableName, state, dialect);
      sql = `insert into ${target}`;
      if (insertAst.insertSource?.kind === "values") {
        const columns = insertAst.insertSource.columns.map((column) => dialect.quoteIdentifier(column)).join(", ");
        const rows = insertAst.insertSource.rows.map((row) => `(${row.values.map((entry) => renderExpression(entry.value, state, dialect)).join(", ")})`).join(", ");
        sql += ` (${columns}) values ${rows}`;
      } else if (insertAst.insertSource?.kind === "query") {
        const columns = insertAst.insertSource.columns.map((column) => dialect.quoteIdentifier(column)).join(", ");
        const renderedQuery = renderQueryAst(getAst(insertAst.insertSource.query), state, dialect);
        sql += ` (${columns}) ${renderedQuery.sql}`;
      } else if (insertAst.insertSource?.kind === "unnest") {
        const unnestSource = insertAst.insertSource;
        const columns = unnestSource.columns.map((column) => dialect.quoteIdentifier(column)).join(", ");
        if (dialect.name === "postgres") {
          const table = targetSource.source;
          const fields = table[TypeId4].fields;
          const rendered = unnestSource.values.map((entry) => `cast(${dialect.renderLiteral(entry.values, state)} as ${renderCastType(dialect, fields[entry.columnName].metadata.dbType)}[])`).join(", ");
          sql += ` (${columns}) select * from unnest(${rendered})`;
        } else {
          const rowCount = unnestSource.values[0]?.values.length ?? 0;
          const rows = Array.from({ length: rowCount }, (_, index3) => `(${unnestSource.values.map((entry) => dialect.renderLiteral(entry.values[index3], state)).join(", ")})`).join(", ");
          sql += ` (${columns}) values ${rows}`;
        }
      } else {
        const columns = (insertAst.values ?? []).map((entry) => dialect.quoteIdentifier(entry.columnName)).join(", ");
        const values = (insertAst.values ?? []).map((entry) => renderExpression(entry.value, state, dialect)).join(", ");
        if ((insertAst.values ?? []).length > 0) {
          sql += ` (${columns}) values (${values})`;
        } else {
          sql += " default values";
        }
      }
      if (insertAst.conflict) {
        const updateValues = (insertAst.conflict.values ?? []).map((entry) => `${dialect.quoteIdentifier(entry.columnName)} = ${renderExpression(entry.value, state, dialect)}`).join(", ");
        if (dialect.name === "postgres") {
          const targetSql = insertAst.conflict.target?.kind === "constraint" ? ` on conflict on constraint ${dialect.quoteIdentifier(insertAst.conflict.target.name)}` : insertAst.conflict.target?.kind === "columns" ? ` on conflict (${insertAst.conflict.target.columns.map((column) => dialect.quoteIdentifier(column)).join(", ")})${insertAst.conflict.target.where ? ` where ${renderExpression(insertAst.conflict.target.where, state, dialect)}` : ""}` : " on conflict";
          sql += targetSql;
          sql += insertAst.conflict.action === "doNothing" ? " do nothing" : ` do update set ${updateValues}${insertAst.conflict.where ? ` where ${renderExpression(insertAst.conflict.where, state, dialect)}` : ""}`;
        } else if (insertAst.conflict.action === "doNothing") {
          sql = sql.replace(/^insert/, "insert ignore");
        } else {
          sql += ` on duplicate key update ${updateValues}`;
        }
      }
      const returning = renderSelectionList(insertAst.select, state, dialect, false);
      projections = returning.projections;
      if (returning.sql.length > 0) {
        sql += ` returning ${returning.sql}`;
      }
      break;
    }
    case "update": {
      const updateAst = ast;
      const targetSource = updateAst.target;
      const target = renderSourceReference(targetSource.source, targetSource.tableName, targetSource.baseTableName, state, dialect);
      const targets = updateAst.targets ?? [targetSource];
      const fromSources = updateAst.fromSources ?? [];
      const assignments = updateAst.set.map((entry) => renderMutationAssignment(entry, state, dialect)).join(", ");
      if (dialect.name === "mysql") {
        const modifiers = renderMysqlMutationLock(updateAst.lock, "update");
        const extraSources = renderFromSources(fromSources, state, dialect);
        const joinSources = updateAst.joins.map((join) => join.kind === "cross" ? `cross join ${renderSourceReference(join.source, join.tableName, join.baseTableName, state, dialect)}` : `${join.kind} join ${renderSourceReference(join.source, join.tableName, join.baseTableName, state, dialect)} on ${renderExpression(join.on, state, dialect)}`).join(" ");
        const targetList = [
          ...targets.map((entry) => renderSourceReference(entry.source, entry.tableName, entry.baseTableName, state, dialect)),
          ...extraSources.length > 0 ? [extraSources] : []
        ].join(", ");
        sql = `update${modifiers} ${targetList}${joinSources.length > 0 ? ` ${joinSources}` : ""} set ${assignments}`;
      } else {
        sql = `update ${target} set ${assignments}`;
        const mutationSources = [
          ...fromSources.length > 0 ? [renderFromSources(fromSources, state, dialect)] : [],
          ...updateAst.joins.length > 0 ? [renderJoinSourcesForMutation(updateAst.joins, state, dialect)] : []
        ].filter((part) => part.length > 0);
        if (mutationSources.length > 0) {
          sql += ` from ${mutationSources.join(", ")}`;
        }
      }
      const whereParts = [
        ...dialect.name === "postgres" ? renderJoinPredicatesForMutation(updateAst.joins, state, dialect) : [],
        ...updateAst.where.map((entry) => renderExpression(entry.predicate, state, dialect))
      ];
      if (whereParts.length > 0) {
        sql += ` where ${whereParts.join(" and ")}`;
      }
      if (dialect.name === "mysql" && updateAst.orderBy.length > 0) {
        sql += ` order by ${updateAst.orderBy.map((entry) => `${renderExpression(entry.value, state, dialect)} ${entry.direction}`).join(", ")}`;
      }
      if (dialect.name === "mysql" && updateAst.limit) {
        sql += ` limit ${renderExpression(updateAst.limit, state, dialect)}`;
      }
      const returning = renderSelectionList(updateAst.select, state, dialect, false);
      projections = returning.projections;
      if (returning.sql.length > 0) {
        sql += ` returning ${returning.sql}`;
      }
      break;
    }
    case "delete": {
      const deleteAst = ast;
      const targetSource = deleteAst.target;
      const target = renderSourceReference(targetSource.source, targetSource.tableName, targetSource.baseTableName, state, dialect);
      const targets = deleteAst.targets ?? [targetSource];
      if (dialect.name === "mysql") {
        const modifiers = renderMysqlMutationLock(deleteAst.lock, "delete");
        const hasJoinedSources = deleteAst.joins.length > 0 || targets.length > 1;
        const targetList = renderDeleteTargets(targets, dialect);
        const fromSources = targets.map((entry) => renderSourceReference(entry.source, entry.tableName, entry.baseTableName, state, dialect)).join(", ");
        const joinSources = deleteAst.joins.map((join) => join.kind === "cross" ? `cross join ${renderSourceReference(join.source, join.tableName, join.baseTableName, state, dialect)}` : `${join.kind} join ${renderSourceReference(join.source, join.tableName, join.baseTableName, state, dialect)} on ${renderExpression(join.on, state, dialect)}`).join(" ");
        sql = hasJoinedSources ? `delete${modifiers} ${targetList} from ${fromSources}${joinSources.length > 0 ? ` ${joinSources}` : ""}` : `delete${modifiers} from ${fromSources}`;
      } else {
        sql = `delete from ${target}`;
        if (deleteAst.joins.length > 0) {
          sql += ` using ${renderJoinSourcesForMutation(deleteAst.joins, state, dialect)}`;
        }
      }
      const whereParts = [
        ...dialect.name === "postgres" ? renderJoinPredicatesForMutation(deleteAst.joins, state, dialect) : [],
        ...deleteAst.where.map((entry) => renderExpression(entry.predicate, state, dialect))
      ];
      if (whereParts.length > 0) {
        sql += ` where ${whereParts.join(" and ")}`;
      }
      if (dialect.name === "mysql" && deleteAst.orderBy.length > 0) {
        sql += ` order by ${deleteAst.orderBy.map((entry) => `${renderExpression(entry.value, state, dialect)} ${entry.direction}`).join(", ")}`;
      }
      if (dialect.name === "mysql" && deleteAst.limit) {
        sql += ` limit ${renderExpression(deleteAst.limit, state, dialect)}`;
      }
      const returning = renderSelectionList(deleteAst.select, state, dialect, false);
      projections = returning.projections;
      if (returning.sql.length > 0) {
        sql += ` returning ${returning.sql}`;
      }
      break;
    }
    case "truncate": {
      const truncateAst = ast;
      const targetSource = truncateAst.target;
      sql = `truncate table ${renderSourceReference(targetSource.source, targetSource.tableName, targetSource.baseTableName, state, dialect)}`;
      if (truncateAst.truncate?.restartIdentity) {
        sql += " restart identity";
      }
      if (truncateAst.truncate?.cascade) {
        sql += " cascade";
      }
      break;
    }
    case "merge": {
      if (dialect.name !== "postgres") {
        throw new Error(`Unsupported merge statement for ${dialect.name}`);
      }
      const mergeAst = ast;
      const targetSource = mergeAst.target;
      const usingSource = mergeAst.using;
      const merge = mergeAst.merge;
      sql = `merge into ${renderSourceReference(targetSource.source, targetSource.tableName, targetSource.baseTableName, state, dialect)} using ${renderSourceReference(usingSource.source, usingSource.tableName, usingSource.baseTableName, state, dialect)} on ${renderExpression(merge.on, state, dialect)}`;
      if (merge.whenMatched) {
        sql += " when matched";
        if (merge.whenMatched.predicate) {
          sql += ` and ${renderExpression(merge.whenMatched.predicate, state, dialect)}`;
        }
        if (merge.whenMatched.kind === "delete") {
          sql += " then delete";
        } else {
          sql += ` then update set ${merge.whenMatched.values.map((entry) => `${dialect.quoteIdentifier(entry.columnName)} = ${renderExpression(entry.value, state, dialect)}`).join(", ")}`;
        }
      }
      if (merge.whenNotMatched) {
        sql += " when not matched";
        if (merge.whenNotMatched.predicate) {
          sql += ` and ${renderExpression(merge.whenNotMatched.predicate, state, dialect)}`;
        }
        sql += ` then insert (${merge.whenNotMatched.values.map((entry) => dialect.quoteIdentifier(entry.columnName)).join(", ")}) values (${merge.whenNotMatched.values.map((entry) => renderExpression(entry.value, state, dialect)).join(", ")})`;
      }
      break;
    }
    case "transaction":
    case "commit":
    case "rollback":
    case "savepoint":
    case "rollbackTo":
    case "releaseSavepoint": {
      sql = renderTransactionClause(ast.transaction, dialect);
      break;
    }
    case "createTable": {
      const createTableAst = ast;
      sql = renderCreateTableSql(createTableAst.target, state, dialect, createTableAst.ddl?.kind === "createTable" && createTableAst.ddl.ifNotExists);
      break;
    }
    case "dropTable": {
      const dropTableAst = ast;
      const ifExists = dropTableAst.ddl?.kind === "dropTable" && dropTableAst.ddl.ifExists;
      sql = `drop table${ifExists ? " if exists" : ""} ${renderSourceReference(dropTableAst.target.source, dropTableAst.target.tableName, dropTableAst.target.baseTableName, state, dialect)}`;
      break;
    }
    case "createIndex": {
      const createIndexAst = ast;
      sql = renderCreateIndexSql(createIndexAst.target, createIndexAst.ddl, state, dialect);
      break;
    }
    case "dropIndex": {
      const dropIndexAst = ast;
      sql = renderDropIndexSql(dropIndexAst.target, dropIndexAst.ddl, state, dialect);
      break;
    }
  }
  if (state.ctes.length === 0) {
    return {
      sql,
      projections
    };
  }
  return {
    sql: `with${state.ctes.some((entry) => entry.recursive) ? " recursive" : ""} ${state.ctes.map((entry) => `${dialect.quoteIdentifier(entry.name)} as (${entry.sql})`).join(", ")} ${sql}`,
    projections
  };
};
var renderSourceReference = (source, tableName, baseTableName, state, dialect) => {
  const renderSelectRows = (rows, columnNames) => {
    const renderedRows = rows.map((row) => `select ${columnNames.map((columnName) => `${renderExpression(row[columnName], state, dialect)} as ${dialect.quoteIdentifier(columnName)}`).join(", ")}`);
    return `(${renderedRows.join(" union all ")}) as ${dialect.quoteIdentifier(tableName)}(${columnNames.map((columnName) => dialect.quoteIdentifier(columnName)).join(", ")})`;
  };
  const renderUnnestRows = (arrays, columnNames) => {
    const rowCount = arrays[columnNames[0]].length;
    const rows = Array.from({ length: rowCount }, (_, index3) => Object.fromEntries(columnNames.map((columnName) => [columnName, arrays[columnName][index3]])));
    return renderSelectRows(rows, columnNames);
  };
  if (typeof source === "object" && source !== null && "kind" in source && source.kind === "cte") {
    const cte = source;
    if (!state.cteNames.has(cte.name)) {
      state.cteNames.add(cte.name);
      const rendered = renderQueryAst(getAst(cte.plan), state, dialect);
      state.ctes.push({
        name: cte.name,
        sql: rendered.sql,
        recursive: cte.recursive
      });
    }
    return dialect.quoteIdentifier(cte.name);
  }
  if (typeof source === "object" && source !== null && "kind" in source && source.kind === "derived") {
    const derived = source;
    if (!state.cteNames.has(derived.name)) {}
    return `(${renderQueryAst(getAst(derived.plan), state, dialect).sql}) as ${dialect.quoteIdentifier(derived.name)}`;
  }
  if (typeof source === "object" && source !== null && "kind" in source && source.kind === "lateral") {
    const lateral = source;
    return `lateral (${renderQueryAst(getAst(lateral.plan), state, dialect).sql}) as ${dialect.quoteIdentifier(lateral.name)}`;
  }
  if (typeof source === "object" && source !== null && source.kind === "values") {
    const values = source;
    return renderSelectRows(values.rows, Object.keys(values.columns));
  }
  if (typeof source === "object" && source !== null && source.kind === "unnest") {
    const unnest = source;
    return renderUnnestRows(unnest.arrays, Object.keys(unnest.columns));
  }
  if (typeof source === "object" && source !== null && source.kind === "tableFunction") {
    const tableFunction = source;
    if (dialect.name !== "postgres") {
      throw new Error("Unsupported table function source for SQL rendering");
    }
    const columnNames = Object.keys(tableFunction.columns);
    return `${tableFunction.functionName}(${tableFunction.args.map((arg) => renderExpression(arg, state, dialect)).join(", ")}) as ${dialect.quoteIdentifier(tableFunction.name)}(${columnNames.map((columnName) => dialect.quoteIdentifier(columnName)).join(", ")})`;
  }
  const schemaName = typeof source === "object" && source !== null && TypeId4 in source ? source[TypeId4].schemaName : undefined;
  return dialect.renderTableReference(tableName, baseTableName, schemaName);
};
var renderExpression = (expression, state, dialect) => {
  const rawAst = expression[TypeId3];
  const jsonSql = renderJsonExpression(expression, rawAst, state, dialect);
  if (jsonSql !== undefined) {
    return jsonSql;
  }
  const ast = rawAst;
  const renderComparisonOperator = (operator) => operator === "eq" ? "=" : operator === "neq" ? "<>" : operator === "lt" ? "<" : operator === "lte" ? "<=" : operator === "gt" ? ">" : ">=";
  switch (ast.kind) {
    case "column":
      return ast.tableName.length === 0 ? dialect.quoteIdentifier(ast.columnName) : `${dialect.quoteIdentifier(ast.tableName)}.${dialect.quoteIdentifier(ast.columnName)}`;
    case "literal":
      return dialect.renderLiteral(ast.value, state);
    case "excluded":
      return dialect.name === "mysql" ? `values(${dialect.quoteIdentifier(ast.columnName)})` : `excluded.${dialect.quoteIdentifier(ast.columnName)}`;
    case "cast":
      return `cast(${renderExpression(ast.value, state, dialect)} as ${renderCastType(dialect, ast.target)})`;
    case "function":
      return renderFunctionCall(ast.name, Array.isArray(ast.args) ? ast.args : [], state, dialect);
    case "eq":
      return `(${renderExpression(ast.left, state, dialect)} = ${renderExpression(ast.right, state, dialect)})`;
    case "neq":
      return `(${renderExpression(ast.left, state, dialect)} <> ${renderExpression(ast.right, state, dialect)})`;
    case "lt":
      return `(${renderExpression(ast.left, state, dialect)} < ${renderExpression(ast.right, state, dialect)})`;
    case "lte":
      return `(${renderExpression(ast.left, state, dialect)} <= ${renderExpression(ast.right, state, dialect)})`;
    case "gt":
      return `(${renderExpression(ast.left, state, dialect)} > ${renderExpression(ast.right, state, dialect)})`;
    case "gte":
      return `(${renderExpression(ast.left, state, dialect)} >= ${renderExpression(ast.right, state, dialect)})`;
    case "like":
      return `(${renderExpression(ast.left, state, dialect)} like ${renderExpression(ast.right, state, dialect)})`;
    case "ilike":
      return dialect.name === "postgres" ? `(${renderExpression(ast.left, state, dialect)} ilike ${renderExpression(ast.right, state, dialect)})` : `(lower(${renderExpression(ast.left, state, dialect)}) like lower(${renderExpression(ast.right, state, dialect)}))`;
    case "regexMatch":
      return dialect.name === "postgres" ? `(${renderExpression(ast.left, state, dialect)} ~ ${renderExpression(ast.right, state, dialect)})` : `(${renderExpression(ast.left, state, dialect)} regexp ${renderExpression(ast.right, state, dialect)})`;
    case "regexIMatch":
      return dialect.name === "postgres" ? `(${renderExpression(ast.left, state, dialect)} ~* ${renderExpression(ast.right, state, dialect)})` : `(${renderExpression(ast.left, state, dialect)} regexp ${renderExpression(ast.right, state, dialect)})`;
    case "regexNotMatch":
      return dialect.name === "postgres" ? `(${renderExpression(ast.left, state, dialect)} !~ ${renderExpression(ast.right, state, dialect)})` : `(${renderExpression(ast.left, state, dialect)} not regexp ${renderExpression(ast.right, state, dialect)})`;
    case "regexNotIMatch":
      return dialect.name === "postgres" ? `(${renderExpression(ast.left, state, dialect)} !~* ${renderExpression(ast.right, state, dialect)})` : `(${renderExpression(ast.left, state, dialect)} not regexp ${renderExpression(ast.right, state, dialect)})`;
    case "isDistinctFrom":
      return dialect.name === "mysql" ? `(not (${renderExpression(ast.left, state, dialect)} <=> ${renderExpression(ast.right, state, dialect)}))` : `(${renderExpression(ast.left, state, dialect)} is distinct from ${renderExpression(ast.right, state, dialect)})`;
    case "isNotDistinctFrom":
      return dialect.name === "mysql" ? `(${renderExpression(ast.left, state, dialect)} <=> ${renderExpression(ast.right, state, dialect)})` : `(${renderExpression(ast.left, state, dialect)} is not distinct from ${renderExpression(ast.right, state, dialect)})`;
    case "contains":
      if (dialect.name === "postgres") {
        const left = isJsonExpression(ast.left) ? renderPostgresJsonValue(ast.left, state, dialect) : renderExpression(ast.left, state, dialect);
        const right = isJsonExpression(ast.right) ? renderPostgresJsonValue(ast.right, state, dialect) : renderExpression(ast.right, state, dialect);
        return `(${left} @> ${right})`;
      }
      if (dialect.name === "mysql" && isJsonExpression(ast.left) && isJsonExpression(ast.right)) {
        return `json_contains(${renderExpression(ast.left, state, dialect)}, ${renderExpression(ast.right, state, dialect)})`;
      }
      throw new Error("Unsupported container operator for SQL rendering");
    case "containedBy":
      if (dialect.name === "postgres") {
        const left = isJsonExpression(ast.left) ? renderPostgresJsonValue(ast.left, state, dialect) : renderExpression(ast.left, state, dialect);
        const right = isJsonExpression(ast.right) ? renderPostgresJsonValue(ast.right, state, dialect) : renderExpression(ast.right, state, dialect);
        return `(${left} <@ ${right})`;
      }
      if (dialect.name === "mysql" && isJsonExpression(ast.left) && isJsonExpression(ast.right)) {
        return `json_contains(${renderExpression(ast.right, state, dialect)}, ${renderExpression(ast.left, state, dialect)})`;
      }
      throw new Error("Unsupported container operator for SQL rendering");
    case "overlaps":
      if (dialect.name === "postgres") {
        const left = isJsonExpression(ast.left) ? renderPostgresJsonValue(ast.left, state, dialect) : renderExpression(ast.left, state, dialect);
        const right = isJsonExpression(ast.right) ? renderPostgresJsonValue(ast.right, state, dialect) : renderExpression(ast.right, state, dialect);
        return `(${left} && ${right})`;
      }
      if (dialect.name === "mysql" && isJsonExpression(ast.left) && isJsonExpression(ast.right)) {
        return `json_overlaps(${renderExpression(ast.left, state, dialect)}, ${renderExpression(ast.right, state, dialect)})`;
      }
      throw new Error("Unsupported container operator for SQL rendering");
    case "isNull":
      return `(${renderExpression(ast.value, state, dialect)} is null)`;
    case "isNotNull":
      return `(${renderExpression(ast.value, state, dialect)} is not null)`;
    case "not":
      return `(not ${renderExpression(ast.value, state, dialect)})`;
    case "upper":
      return `upper(${renderExpression(ast.value, state, dialect)})`;
    case "lower":
      return `lower(${renderExpression(ast.value, state, dialect)})`;
    case "count":
      return `count(${renderExpression(ast.value, state, dialect)})`;
    case "max":
      return `max(${renderExpression(ast.value, state, dialect)})`;
    case "min":
      return `min(${renderExpression(ast.value, state, dialect)})`;
    case "and":
      return `(${ast.values.map((value) => renderExpression(value, state, dialect)).join(" and ")})`;
    case "or":
      return `(${ast.values.map((value) => renderExpression(value, state, dialect)).join(" or ")})`;
    case "coalesce":
      return `coalesce(${ast.values.map((value) => renderExpression(value, state, dialect)).join(", ")})`;
    case "in":
      return `(${renderExpression(ast.values[0], state, dialect)} in (${ast.values.slice(1).map((value) => renderExpression(value, state, dialect)).join(", ")}))`;
    case "notIn":
      return `(${renderExpression(ast.values[0], state, dialect)} not in (${ast.values.slice(1).map((value) => renderExpression(value, state, dialect)).join(", ")}))`;
    case "between":
      return `(${renderExpression(ast.values[0], state, dialect)} between ${renderExpression(ast.values[1], state, dialect)} and ${renderExpression(ast.values[2], state, dialect)})`;
    case "concat":
      return dialect.renderConcat(ast.values.map((value) => renderExpression(value, state, dialect)));
    case "case":
      return `case ${ast.branches.map((branch) => `when ${renderExpression(branch.when, state, dialect)} then ${renderExpression(branch.then, state, dialect)}`).join(" ")} else ${renderExpression(ast.else, state, dialect)} end`;
    case "exists":
      return `exists (${renderQueryAst(getAst(ast.plan), state, dialect).sql})`;
    case "scalarSubquery":
      return `(${renderQueryAst(getAst(ast.plan), state, dialect).sql})`;
    case "inSubquery":
      return `(${renderExpression(ast.left, state, dialect)} in (${renderQueryAst(getAst(ast.plan), state, dialect).sql}))`;
    case "comparisonAny":
      return `(${renderExpression(ast.left, state, dialect)} ${renderComparisonOperator(ast.operator)} any (${renderQueryAst(getAst(ast.plan), state, dialect).sql}))`;
    case "comparisonAll":
      return `(${renderExpression(ast.left, state, dialect)} ${renderComparisonOperator(ast.operator)} all (${renderQueryAst(getAst(ast.plan), state, dialect).sql}))`;
    case "window": {
      if (!Array.isArray(ast.partitionBy) || !Array.isArray(ast.orderBy) || typeof ast.function !== "string") {
        break;
      }
      const clauses = [];
      if (ast.partitionBy.length > 0) {
        clauses.push(`partition by ${ast.partitionBy.map((value) => renderExpression(value, state, dialect)).join(", ")}`);
      }
      if (ast.orderBy.length > 0) {
        clauses.push(`order by ${ast.orderBy.map((entry) => `${renderExpression(entry.value, state, dialect)} ${entry.direction}`).join(", ")}`);
      }
      const specification = clauses.join(" ");
      switch (ast.function) {
        case "rowNumber":
          return `row_number() over (${specification})`;
        case "rank":
          return `rank() over (${specification})`;
        case "denseRank":
          return `dense_rank() over (${specification})`;
        case "over":
          return `${renderExpression(ast.value, state, dialect)} over (${specification})`;
      }
      break;
    }
  }
  throw new Error("Unsupported expression for SQL rendering");
};

// src/internal/schema-ddl.ts
import { parse as parse2, toSql as toSql2 } from "pgsql-ast-parser";
var escapeString = (value) => `'${value.replaceAll("'", "''")}'`;
var inlineLiteralDialect = {
  ...postgresDialect,
  renderLiteral(value) {
    if (value === null) {
      return "null";
    }
    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }
    if (typeof value === "number" || typeof value === "bigint") {
      return String(value);
    }
    if (value instanceof Date) {
      return escapeString(value.toISOString());
    }
    return escapeString(String(value));
  }
};
var renderDdlExpressionSql = (expression) => isSchemaExpression(expression) ? render(expression) : renderExpression(expression, {
  params: [],
  ctes: [],
  cteNames: new Set
}, inlineLiteralDialect);
var isExpressionRecord = (value) => typeof value === "object" && value !== null;
var isAnyArrayCall = (value) => isExpressionRecord(value) && value.type === "call" && isExpressionRecord(value.function) && typeof value.function.name === "string" && value.function.name.toLowerCase() === "any" && Array.isArray(value.args) && value.args.length === 1 && isExpressionRecord(value.args[0]) && value.args[0].type === "array" && Array.isArray(value.args[0].expressions);
var canonicalizeExpressionNode = (value) => {
  if (Array.isArray(value)) {
    return value.map(canonicalizeExpressionNode);
  }
  if (!isExpressionRecord(value)) {
    return value;
  }
  const normalized = {};
  for (const [key2, child] of Object.entries(value)) {
    normalized[key2] = canonicalizeExpressionNode(child);
  }
  if (normalized.type === "binary" && typeof normalized.op === "string" && normalized.op.toLowerCase() === "=" && isAnyArrayCall(normalized.right)) {
    return {
      ...normalized,
      op: "IN",
      right: {
        type: "list",
        expressions: normalized.right.args[0].expressions
      }
    };
  }
  return normalized;
};
var canonicalizeDdlExpressionAst = (expression) => canonicalizeExpressionNode(expression);
var normalizeDdlExpressionSql = (expression) => {
  const rendered = renderDdlExpressionSql(expression);
  try {
    return toSql2.expr(canonicalizeDdlExpressionAst(parse2(rendered, "expr")));
  } catch {
    return rendered.trim();
  }
};

// src/postgres/schema-management.ts
import { pipeArguments as pipeArguments5 } from "effect/Pipeable";
var EnumTypeId = Symbol.for("effect-qb/SchemaManagement/Enum");
var EnumProto = {
  pipe() {
    return pipeArguments5(this, arguments);
  }
};
var enumType = (name, values, schemaName) => {
  const definition = Object.create(EnumProto);
  definition.name = name;
  definition.values = values;
  definition.schemaName = schemaName;
  definition[EnumTypeId] = {
    kind: "enum",
    name,
    values,
    schemaName
  };
  return definition;
};

// src/internal/postgres-schema-model.ts
var isTableDefinition = (value) => value !== null && (typeof value === "object" || typeof value === "function") && (TypeId4 in value);
var isEnumDefinition = (value) => typeof value === "object" && value !== null && (EnumTypeId in value);
var toTableModel = (table) => {
  const state = table[TypeId4];
  const fields = state.fields;
  const columns = Object.entries(fields).map(([name, column]) => ({
    name,
    ddlType: column.metadata.ddlType ?? column.metadata.dbType.kind,
    dbTypeKind: column.metadata.dbType.kind,
    typeKind: undefined,
    typeSchema: undefined,
    nullable: column.metadata.nullable,
    hasDefault: column.metadata.hasDefault,
    generated: column.metadata.generated,
    defaultSql: column.metadata.defaultValue === undefined ? undefined : normalizeDdlExpressionSql(column.metadata.defaultValue),
    generatedSql: column.metadata.generatedValue === undefined ? undefined : normalizeDdlExpressionSql(column.metadata.generatedValue),
    identity: column.metadata.identity,
    column
  }));
  return {
    kind: "table",
    schemaName: state.schemaName,
    name: state.baseName,
    columns,
    options: table[OptionsSymbol],
    table
  };
};
var toEnumModel = (definition) => ({
  kind: "enum",
  schemaName: definition.schemaName,
  name: definition.name,
  values: [...definition.values]
});
var fromDiscoveredValues = (values) => ({
  dialect: "postgres",
  enums: values.filter(isEnumDefinition).map(toEnumModel),
  tables: values.filter(isTableDefinition).map(toTableModel)
});
var tableKey = (schemaName, name) => `${schemaName ?? "public"}.${name}`;
var enumKey = (schemaName, name) => `${schemaName ?? "public"}.${name}`;
// src/postgres/column.ts
var exports_column = {};
__export(exports_column, {
  xml: () => xml,
  varchar: () => varchar,
  varbit: () => varbit,
  uuid: () => uuid,
  unique: () => unique2,
  timetz: () => timetz,
  timestamptz: () => timestamptz,
  timestamp: () => timestamp,
  time: () => time,
  text: () => text,
  schema: () => schema2,
  regclass: () => regclass,
  references: () => references,
  primaryKey: () => primaryKey2,
  pg_lsn: () => pg_lsn,
  oid: () => oid,
  number: () => number,
  nullable: () => nullable,
  name: () => name,
  jsonb: () => jsonb,
  json: () => json,
  interval: () => interval,
  int8: () => int8,
  int2: () => int2,
  int: () => int,
  identityByDefault: () => identityByDefault,
  identityAlways: () => identityAlways,
  generated: () => generated,
  float8: () => float8,
  float4: () => float4,
  default: () => default_,
  ddlType: () => ddlType,
  date: () => date,
  custom: () => custom,
  char: () => char,
  bytea: () => bytea,
  boolean: () => boolean,
  bit: () => bit,
  array: () => array
});

// src/internal/column.ts
import * as Schema3 from "effect/Schema";

// src/internal/runtime-value.ts
import * as Schema2 from "effect/Schema";
var brandString = (pattern, brand2) => Schema2.String.check(Schema2.isPattern(pattern)).pipe(Schema2.brand(brand2));
var LocalDateStringSchema = brandString(/^\d{4}-\d{2}-\d{2}$/, "LocalDateString");
var LocalTimeStringSchema = brandString(/^\d{2}:\d{2}:\d{2}(?:\.\d+)?$/, "LocalTimeString");
var OffsetTimeStringSchema = brandString(/^\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/, "OffsetTimeString");
var LocalDateTimeStringSchema = brandString(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/, "LocalDateTimeString");
var InstantStringSchema = brandString(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/, "InstantString");
var YearStringSchema = brandString(/^\d{4}$/, "YearString");
var BigIntStringSchema = brandString(/^-?\d+$/, "BigIntString");
var DecimalStringSchema = brandString(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/, "DecimalString");
var JsonValueSchema = Schema2.suspend(() => Schema2.Union([
  Schema2.String,
  Schema2.Number,
  Schema2.Boolean,
  Schema2.Null,
  Schema2.Array(JsonValueSchema),
  Schema2.Record(Schema2.String, JsonValueSchema)
]));
var JsonPrimitiveSchema = Schema2.Union([
  Schema2.String,
  Schema2.Number,
  Schema2.Boolean,
  Schema2.Null
]);

// src/internal/column.ts
var UuidSchema = Schema3.String.check(Schema3.isUUID());
var mapColumn = (column, metadata) => remapColumnDefinition(column, {
  metadata
});
var primitive = (schema2, dbType) => makeColumnDefinition(schema2, {
  dbType,
  nullable: false,
  hasDefault: false,
  generated: false,
  primaryKey: false,
  unique: false,
  references: undefined
});
var typeFactory = (dialect) => (kind) => ({
  dialect,
  kind
});
var postgresType = typeFactory("postgres");
var renderNumericDdlType = (kind, options2) => {
  if (options2 === undefined || options2.precision === undefined) {
    return;
  }
  return options2.scale === undefined ? `${kind}(${options2.precision})` : `${kind}(${options2.precision},${options2.scale})`;
};
var makeColumnModule = (dialect, kinds) => {
  const dialectType = typeFactory(dialect);
  return {
    custom: (schema2, dbType) => makeColumnDefinition(schema2, {
      dbType,
      nullable: false,
      hasDefault: false,
      generated: false,
      primaryKey: false,
      unique: false,
      references: undefined,
      ddlType: undefined,
      identity: undefined
    }),
    uuid: () => primitive(UuidSchema, dialectType(kinds.uuid)),
    text: () => primitive(Schema3.String, dialectType(kinds.text)),
    int: () => primitive(Schema3.Int, dialectType(kinds.int)),
    number: (options2) => makeColumnDefinition(DecimalStringSchema, {
      dbType: dialectType(kinds.number),
      nullable: false,
      hasDefault: false,
      generated: false,
      primaryKey: false,
      unique: false,
      references: undefined,
      ddlType: renderNumericDdlType(kinds.number, options2),
      identity: undefined
    }),
    boolean: () => primitive(Schema3.Boolean, dialectType(kinds.boolean)),
    date: () => primitive(LocalDateStringSchema, dialectType(kinds.date)),
    timestamp: () => primitive(LocalDateTimeStringSchema, dialectType(kinds.timestamp)),
    json: (schema2) => makeColumnDefinition(schema2, {
      dbType: {
        ...dialectType(kinds.json),
        variant: "json"
      },
      nullable: false,
      hasDefault: false,
      generated: false,
      primaryKey: false,
      unique: false,
      references: undefined,
      ddlType: undefined,
      identity: undefined
    })
  };
};
var postgresBase = makeColumnModule("postgres", {
  uuid: "uuid",
  text: "text",
  int: "int4",
  number: "numeric",
  boolean: "bool",
  date: "date",
  timestamp: "timestamp",
  json: "json"
});
var postgres = {
  ...postgresBase,
  int2: () => primitive(Schema3.Int, postgresType("int2")),
  int8: () => primitive(BigIntStringSchema, postgresType("int8")),
  float4: () => primitive(Schema3.Number, postgresType("float4")),
  float8: () => primitive(Schema3.Number, postgresType("float8")),
  char: (length = 1) => makeColumnDefinition(Schema3.String, {
    dbType: postgresType("char"),
    nullable: false,
    hasDefault: false,
    generated: false,
    primaryKey: false,
    unique: false,
    references: undefined,
    ddlType: `char(${length})`,
    identity: undefined
  }),
  varchar: (length) => makeColumnDefinition(Schema3.String, {
    dbType: postgresType("varchar"),
    nullable: false,
    hasDefault: false,
    generated: false,
    primaryKey: false,
    unique: false,
    references: undefined,
    ddlType: length === undefined ? "varchar" : `varchar(${length})`,
    identity: undefined
  }),
  time: () => primitive(LocalTimeStringSchema, postgresType("time")),
  timetz: () => primitive(OffsetTimeStringSchema, postgresType("timetz")),
  timestamptz: () => primitive(InstantStringSchema, postgresType("timestamptz")),
  interval: () => primitive(Schema3.String, postgresType("interval")),
  bytea: () => primitive(Schema3.Uint8Array, postgresType("bytea")),
  name: () => primitive(Schema3.String, postgresType("name")),
  oid: () => primitive(Schema3.Int, postgresType("oid")),
  regclass: () => primitive(Schema3.String, postgresType("regclass")),
  bit: () => primitive(Schema3.String, postgresType("bit")),
  varbit: () => primitive(Schema3.String, postgresType("varbit")),
  xml: () => primitive(Schema3.String, postgresType("xml")),
  pg_lsn: () => primitive(Schema3.String, postgresType("pg_lsn")),
  jsonb: (schema2) => makeColumnDefinition(schema2, {
    dbType: {
      ...postgresType("jsonb"),
      variant: "json"
    },
    nullable: false,
    hasDefault: false,
    generated: false,
    primaryKey: false,
    unique: false,
    references: undefined,
    ddlType: undefined,
    identity: undefined
  })
};
var mysql = makeColumnModule("mysql", {
  uuid: "uuid",
  text: "text",
  int: "int",
  number: "decimal",
  boolean: "boolean",
  date: "date",
  timestamp: "timestamp",
  json: "json"
});
var uuid = postgres.uuid;
var text = postgres.text;
var int = postgres.int;
var int2 = postgres.int2;
var int8 = postgres.int8;
var number = postgres.number;
var float4 = postgres.float4;
var float8 = postgres.float8;
var boolean = postgres.boolean;
var date = postgres.date;
var timestamp = postgres.timestamp;
var time = postgres.time;
var timetz = postgres.timetz;
var timestamptz = postgres.timestamptz;
var char = postgres.char;
var varchar = postgres.varchar;
var interval = postgres.interval;
var bytea = postgres.bytea;
var name = postgres.name;
var oid = postgres.oid;
var regclass = postgres.regclass;
var bit = postgres.bit;
var varbit = postgres.varbit;
var xml = postgres.xml;
var pg_lsn = postgres.pg_lsn;
var json = postgres.json;
var jsonb = postgres.jsonb;
var custom = postgres.custom;
var schema2 = (nextSchema) => (column) => remapColumnDefinition(column, {
  schema: nextSchema
});
var nullable = (column) => mapColumn(column, {
  ...column.metadata,
  nullable: true
});
var primaryKey2 = (column) => mapColumn(column, {
  ...column.metadata,
  nullable: false,
  primaryKey: true,
  unique: true
});
var unique2 = (column) => mapColumn(column, {
  ...column.metadata,
  unique: true
});
var default_ = (value) => (column) => mapColumn(column, {
  ...column.metadata,
  hasDefault: true,
  defaultValue: value,
  generatedValue: undefined,
  identity: undefined
});
var generated = (value) => (column) => mapColumn(column, {
  ...column.metadata,
  generated: true,
  hasDefault: false,
  defaultValue: undefined,
  generatedValue: value,
  identity: undefined
});
var ddlType = (sqlType) => (column) => mapColumn(column, {
  ...column.metadata,
  ddlType: sqlType
});
var array = (options2) => (column) => remapColumnDefinition(column, {
  schema: Schema3.Array(options2?.nullableElements ? Schema3.NullOr(column.schema) : column.schema),
  metadata: {
    ...column.metadata,
    dbType: {
      dialect: column.metadata.dbType.dialect,
      kind: `${column.metadata.dbType.kind}[]`,
      element: column.metadata.dbType
    },
    ddlType: `${column.metadata.ddlType ?? column.metadata.dbType.kind}[]`
  }
});
var identityByDefault = (column) => mapColumn(column, {
  ...column.metadata,
  hasDefault: true,
  generated: false,
  defaultValue: undefined,
  generatedValue: undefined,
  identity: {
    generation: "byDefault"
  }
});
var identityAlways = (column) => mapColumn(column, {
  ...column.metadata,
  hasDefault: false,
  generated: true,
  defaultValue: undefined,
  generatedValue: undefined,
  identity: {
    generation: "always"
  }
});
var references = (target) => (column) => mapColumn(column, {
  ...column.metadata,
  references: { target }
});
// src/postgres/datatypes/index.ts
var exports_datatypes = {};
__export(exports_datatypes, {
  postgresDatatypes: () => postgresDatatypes,
  postgresDatatypeKinds: () => postgresDatatypeKinds,
  postgresDatatypeFamilies: () => postgresDatatypeFamilies
});

// src/internal/datatypes/define.ts
var makeDatatypeModule = (dialect, kinds, aliases) => {
  const module = {
    custom: (kind) => ({
      dialect,
      kind
    })
  };
  for (const kind of Object.keys(kinds)) {
    module[kind] = () => ({
      dialect,
      kind
    });
  }
  for (const [alias2, kind] of Object.entries(aliases ?? {})) {
    module[alias2] = () => ({
      dialect,
      kind
    });
  }
  return module;
};

// src/postgres/datatypes/spec.ts
var postgresDatatypeFamilies = {
  text: {
    compareGroup: "text",
    castTargets: [
      "text",
      "numeric",
      "boolean",
      "date",
      "time",
      "timestamp",
      "interval",
      "binary",
      "uuid",
      "json",
      "xml",
      "bit",
      "oid",
      "identifier",
      "network",
      "spatial",
      "textsearch",
      "range",
      "multirange",
      "array",
      "money",
      "null"
    ],
    traits: {
      textual: true,
      ordered: true
    }
  },
  numeric: {
    compareGroup: "numeric",
    castTargets: ["numeric", "text", "boolean", "date", "time", "timestamp", "interval", "uuid", "bit", "oid", "money"],
    traits: {
      ordered: true
    }
  },
  boolean: {
    compareGroup: "boolean",
    castTargets: ["boolean", "text", "numeric"],
    traits: {}
  },
  date: {
    compareGroup: "date",
    castTargets: ["date", "timestamp", "text"],
    traits: {
      ordered: true
    }
  },
  time: {
    compareGroup: "time",
    castTargets: ["time", "timestamp", "text"],
    traits: {
      ordered: true
    }
  },
  timestamp: {
    compareGroup: "timestamp",
    castTargets: ["timestamp", "date", "text"],
    traits: {
      ordered: true
    }
  },
  interval: {
    compareGroup: "interval",
    castTargets: ["interval", "text"],
    traits: {
      ordered: true
    }
  },
  binary: {
    compareGroup: "binary",
    castTargets: ["binary", "text"],
    traits: {}
  },
  uuid: {
    compareGroup: "uuid",
    castTargets: ["uuid", "text"],
    traits: {
      ordered: true
    }
  },
  json: {
    compareGroup: "json",
    castTargets: ["json", "text"],
    traits: {}
  },
  xml: {
    compareGroup: "xml",
    castTargets: ["xml", "text"],
    traits: {}
  },
  bit: {
    compareGroup: "bit",
    castTargets: ["bit", "text", "numeric"],
    traits: {}
  },
  oid: {
    compareGroup: "oid",
    castTargets: ["oid", "text", "numeric"],
    traits: {
      ordered: true
    }
  },
  identifier: {
    compareGroup: "identifier",
    castTargets: ["identifier", "text"],
    traits: {}
  },
  network: {
    compareGroup: "network",
    castTargets: ["network", "text"],
    traits: {}
  },
  spatial: {
    compareGroup: "spatial",
    castTargets: ["spatial", "text"],
    traits: {}
  },
  textsearch: {
    compareGroup: "textsearch",
    castTargets: ["textsearch", "text"],
    traits: {}
  },
  range: {
    compareGroup: "range",
    castTargets: ["range", "text"],
    traits: {}
  },
  multirange: {
    compareGroup: "multirange",
    castTargets: ["multirange", "text"],
    traits: {}
  },
  enum: {
    compareGroup: "enum",
    castTargets: ["enum", "text"],
    traits: {
      textual: true,
      ordered: true
    }
  },
  record: {
    compareGroup: "record",
    castTargets: ["record", "text"],
    traits: {}
  },
  array: {
    compareGroup: "array",
    castTargets: ["array", "text"],
    traits: {}
  },
  money: {
    compareGroup: "money",
    castTargets: ["money", "text", "numeric"],
    traits: {
      ordered: true
    }
  },
  null: {
    compareGroup: "null",
    castTargets: [
      "text",
      "numeric",
      "boolean",
      "date",
      "time",
      "timestamp",
      "interval",
      "binary",
      "uuid",
      "json",
      "xml",
      "bit",
      "oid",
      "identifier",
      "network",
      "spatial",
      "textsearch",
      "range",
      "multirange",
      "array",
      "money",
      "null"
    ],
    traits: {}
  }
};
var postgresDatatypeKinds = {
  text: { family: "text", runtime: "string" },
  varchar: { family: "text", runtime: "string" },
  char: { family: "text", runtime: "string" },
  citext: { family: "text", runtime: "string" },
  name: { family: "text", runtime: "string" },
  uuid: { family: "uuid", runtime: "string" },
  int2: { family: "numeric", runtime: "number" },
  int4: { family: "numeric", runtime: "number" },
  int8: { family: "numeric", runtime: "bigintString" },
  numeric: { family: "numeric", runtime: "decimalString" },
  float4: { family: "numeric", runtime: "number" },
  float8: { family: "numeric", runtime: "number" },
  money: { family: "money", runtime: "number" },
  bool: { family: "boolean", runtime: "boolean" },
  date: { family: "date", runtime: "localDate" },
  time: { family: "time", runtime: "localTime" },
  timetz: { family: "time", runtime: "offsetTime" },
  timestamp: { family: "timestamp", runtime: "localDateTime" },
  timestamptz: { family: "timestamp", runtime: "instant" },
  interval: { family: "interval", runtime: "string" },
  bytea: { family: "binary", runtime: "bytes" },
  json: { family: "json", runtime: "json" },
  jsonb: { family: "json", runtime: "json" },
  xml: { family: "xml", runtime: "string" },
  bit: { family: "bit", runtime: "string" },
  varbit: { family: "bit", runtime: "string" },
  oid: { family: "oid", runtime: "number" },
  xid: { family: "oid", runtime: "number" },
  xid8: { family: "oid", runtime: "bigintString" },
  cid: { family: "oid", runtime: "number" },
  tid: { family: "identifier", runtime: "string" },
  regclass: { family: "identifier", runtime: "string" },
  regtype: { family: "identifier", runtime: "string" },
  regproc: { family: "identifier", runtime: "string" },
  regprocedure: { family: "identifier", runtime: "string" },
  regoper: { family: "identifier", runtime: "string" },
  regoperator: { family: "identifier", runtime: "string" },
  regconfig: { family: "identifier", runtime: "string" },
  regdictionary: { family: "identifier", runtime: "string" },
  pg_lsn: { family: "identifier", runtime: "string" },
  txid_snapshot: { family: "identifier", runtime: "string" },
  inet: { family: "network", runtime: "string" },
  cidr: { family: "network", runtime: "string" },
  macaddr: { family: "network", runtime: "string" },
  macaddr8: { family: "network", runtime: "string" },
  point: { family: "spatial", runtime: "unknown" },
  line: { family: "spatial", runtime: "unknown" },
  lseg: { family: "spatial", runtime: "unknown" },
  box: { family: "spatial", runtime: "unknown" },
  path: { family: "spatial", runtime: "unknown" },
  polygon: { family: "spatial", runtime: "unknown" },
  circle: { family: "spatial", runtime: "unknown" },
  tsvector: { family: "textsearch", runtime: "string" },
  tsquery: { family: "textsearch", runtime: "string" },
  int4range: { family: "range", runtime: "unknown" },
  int8range: { family: "range", runtime: "unknown" },
  numrange: { family: "range", runtime: "unknown" },
  tsrange: { family: "range", runtime: "unknown" },
  tstzrange: { family: "range", runtime: "unknown" },
  daterange: { family: "range", runtime: "unknown" },
  int4multirange: { family: "multirange", runtime: "unknown" },
  int8multirange: { family: "multirange", runtime: "unknown" },
  nummultirange: { family: "multirange", runtime: "unknown" },
  tsmultirange: { family: "multirange", runtime: "unknown" },
  tstzmultirange: { family: "multirange", runtime: "unknown" },
  datemultirange: { family: "multirange", runtime: "unknown" }
};

// src/postgres/datatypes/index.ts
var postgresDatatypes = makeDatatypeModule("postgres", postgresDatatypeKinds, {
  boolean: "bool"
});
// src/postgres/errors/index.ts
var exports_errors = {};
__export(exports_errors, {
  requirements_of_postgres_error: () => requirements_of_postgres_error,
  postgres_requirements_by_class_code: () => postgres_requirements_by_class_code,
  postgresErrorTypes: () => postgresErrorTypes,
  postgresErrorSemanticFields: () => postgresErrorSemanticFields,
  postgresErrorConditions: () => postgresErrorConditions,
  postgresErrorClasses: () => postgresErrorClasses,
  postgresErrorCatalog: () => postgresErrorCatalog,
  normalizePostgresDriverError: () => normalizePostgresDriverError,
  narrowPostgresDriverErrorForReadQuery: () => narrowPostgresDriverErrorForReadQuery,
  isPostgresSqlStateCode: () => isPostgresSqlStateCode,
  isPostgresErrorLike: () => isPostgresErrorLike,
  hasSqlState: () => hasSqlState,
  getPostgresErrorDescriptor: () => getPostgresErrorDescriptor
});

// src/postgres/errors/catalog.ts
var postgresErrorClasses = {
  "00": "Successful Completion",
  "01": "Warning",
  "02": "No Data (this is also a warning class per the SQL standard)",
  "03": "SQL Statement Not Yet Complete",
  "08": "Connection Exception",
  "09": "Triggered Action Exception",
  "0A": "Feature Not Supported",
  "0B": "Invalid Transaction Initiation",
  "0F": "Locator Exception",
  "0L": "Invalid Grantor",
  "0P": "Invalid Role Specification",
  "0Z": "Diagnostics Exception",
  "10": "XQuery Error",
  "20": "Case Not Found",
  "21": "Cardinality Violation",
  "22": "Data Exception",
  "23": "Integrity Constraint Violation",
  "24": "Invalid Cursor State",
  "25": "Invalid Transaction State",
  "26": "Invalid SQL Statement Name",
  "27": "Triggered Data Change Violation",
  "28": "Invalid Authorization Specification",
  "2B": "Dependent Privilege Descriptors Still Exist",
  "2D": "Invalid Transaction Termination",
  "2F": "SQL Routine Exception",
  "34": "Invalid Cursor Name",
  "38": "External Routine Exception",
  "39": "External Routine Invocation Exception",
  "3B": "Savepoint Exception",
  "3D": "Invalid Catalog Name",
  "3F": "Invalid Schema Name",
  "40": "Transaction Rollback",
  "42": "Syntax Error or Access Rule Violation",
  "44": "WITH CHECK OPTION Violation",
  "53": "Insufficient Resources",
  "54": "Program Limit Exceeded",
  "55": "Object Not In Prerequisite State",
  "57": "Operator Intervention",
  "58": "System Error (errors external to PostgreSQL itself)",
  F0: "Configuration File Error",
  HV: "Foreign Data Wrapper Error (SQL/MED)",
  P0: "PL/pgSQL Error",
  XX: "Internal Error"
};
var postgresErrorTypes = {
  "00": "successful-completion",
  "01": "warning",
  "02": "no-data",
  "03": "sql-statement-not-yet-complete",
  "08": "connection-exception",
  "09": "triggered-action-exception",
  "0A": "feature-not-supported",
  "0B": "invalid-transaction-initiation",
  "0F": "locator-exception",
  "0L": "invalid-grantor",
  "0P": "invalid-role-specification",
  "0Z": "diagnostics-exception",
  "10": "xquery-error",
  "20": "case-not-found",
  "21": "cardinality-violation",
  "22": "data-exception",
  "23": "integrity-constraint-violation",
  "24": "invalid-cursor-state",
  "25": "invalid-transaction-state",
  "26": "invalid-sql-statement-name",
  "27": "triggered-data-change-violation",
  "28": "invalid-authorization-specification",
  "2B": "dependent-privilege-descriptors-still-exist",
  "2D": "invalid-transaction-termination",
  "2F": "sql-routine-exception",
  "34": "invalid-cursor-name",
  "38": "external-routine-exception",
  "39": "external-routine-invocation-exception",
  "3B": "savepoint-exception",
  "3D": "invalid-catalog-name",
  "3F": "invalid-schema-name",
  "40": "transaction-rollback",
  "42": "syntax-error-or-access-rule-violation",
  "44": "with-check-option-violation",
  "53": "insufficient-resources",
  "54": "program-limit-exceeded",
  "55": "object-not-in-prerequisite-state",
  "57": "operator-intervention",
  "58": "system-error",
  F0: "configuration-file-error",
  HV: "foreign-data-wrapper-error",
  P0: "pl-pgsql-error",
  XX: "internal-error"
};
var postgresErrorConditions = {
  "00000": "successful_completion",
  "01000": "warning",
  "0100C": "dynamic_result_sets_returned",
  "01008": "implicit_zero_bit_padding",
  "01003": "null_value_eliminated_in_set_function",
  "01007": "privilege_not_granted",
  "01006": "privilege_not_revoked",
  "01004": "string_data_right_truncation",
  "01P01": "deprecated_feature",
  "02000": "no_data",
  "02001": "no_additional_dynamic_result_sets_returned",
  "03000": "sql_statement_not_yet_complete",
  "08000": "connection_exception",
  "08003": "connection_does_not_exist",
  "08006": "connection_failure",
  "08001": "sqlclient_unable_to_establish_sqlconnection",
  "08004": "sqlserver_rejected_establishment_of_sqlconnection",
  "08007": "transaction_resolution_unknown",
  "08P01": "protocol_violation",
  "09000": "triggered_action_exception",
  "0A000": "feature_not_supported",
  "0B000": "invalid_transaction_initiation",
  "0F000": "locator_exception",
  "0F001": "invalid_locator_specification",
  "0L000": "invalid_grantor",
  "0LP01": "invalid_grant_operation",
  "0P000": "invalid_role_specification",
  "0Z000": "diagnostics_exception",
  "0Z002": "stacked_diagnostics_accessed_without_active_handler",
  "10608": "invalid_argument_for_xquery",
  "20000": "case_not_found",
  "21000": "cardinality_violation",
  "22000": "data_exception",
  "2202E": "array_subscript_error",
  "22021": "character_not_in_repertoire",
  "22008": "datetime_field_overflow",
  "22012": "division_by_zero",
  "22005": "error_in_assignment",
  "2200B": "escape_character_conflict",
  "22022": "indicator_overflow",
  "22015": "interval_field_overflow",
  "2201E": "invalid_argument_for_logarithm",
  "22014": "invalid_argument_for_ntile_function",
  "22016": "invalid_argument_for_nth_value_function",
  "2201F": "invalid_argument_for_power_function",
  "2201G": "invalid_argument_for_width_bucket_function",
  "22018": "invalid_character_value_for_cast",
  "22007": "invalid_datetime_format",
  "22019": "invalid_escape_character",
  "2200D": "invalid_escape_octet",
  "22025": "invalid_escape_sequence",
  "22P06": "nonstandard_use_of_escape_character",
  "22010": "invalid_indicator_parameter_value",
  "22023": "invalid_parameter_value",
  "22013": "invalid_preceding_or_following_size",
  "2201B": "invalid_regular_expression",
  "2201W": "invalid_row_count_in_limit_clause",
  "2201X": "invalid_row_count_in_result_offset_clause",
  "2202H": "invalid_tablesample_argument",
  "2202G": "invalid_tablesample_repeat",
  "22009": "invalid_time_zone_displacement_value",
  "2200C": "invalid_use_of_escape_character",
  "2200G": "most_specific_type_mismatch",
  "22004": "null_value_not_allowed",
  "22002": "null_value_no_indicator_parameter",
  "22003": "numeric_value_out_of_range",
  "2200H": "sequence_generator_limit_exceeded",
  "22026": "string_data_length_mismatch",
  "22001": "string_data_right_truncation",
  "22011": "substring_error",
  "22027": "trim_error",
  "22024": "unterminated_c_string",
  "2200F": "zero_length_character_string",
  "22P01": "floating_point_exception",
  "22P02": "invalid_text_representation",
  "22P03": "invalid_binary_representation",
  "22P04": "bad_copy_file_format",
  "22P05": "untranslatable_character",
  "2200L": "not_an_xml_document",
  "2200M": "invalid_xml_document",
  "2200N": "invalid_xml_content",
  "2200S": "invalid_xml_comment",
  "2200T": "invalid_xml_processing_instruction",
  "22030": "duplicate_json_object_key_value",
  "22031": "invalid_argument_for_sql_json_datetime_function",
  "22032": "invalid_json_text",
  "22033": "invalid_sql_json_subscript",
  "22034": "more_than_one_sql_json_item",
  "22035": "no_sql_json_item",
  "22036": "non_numeric_sql_json_item",
  "22037": "non_unique_keys_in_a_json_object",
  "22038": "singleton_sql_json_item_required",
  "22039": "sql_json_array_not_found",
  "2203A": "sql_json_member_not_found",
  "2203B": "sql_json_number_not_found",
  "2203C": "sql_json_object_not_found",
  "2203D": "too_many_json_array_elements",
  "2203E": "too_many_json_object_members",
  "2203F": "sql_json_scalar_required",
  "2203G": "sql_json_item_cannot_be_cast_to_target_type",
  "23000": "integrity_constraint_violation",
  "23001": "restrict_violation",
  "23502": "not_null_violation",
  "23503": "foreign_key_violation",
  "23505": "unique_violation",
  "23514": "check_violation",
  "23P01": "exclusion_violation",
  "24000": "invalid_cursor_state",
  "25000": "invalid_transaction_state",
  "25001": "active_sql_transaction",
  "25002": "branch_transaction_already_active",
  "25008": "held_cursor_requires_same_isolation_level",
  "25003": "inappropriate_access_mode_for_branch_transaction",
  "25004": "inappropriate_isolation_level_for_branch_transaction",
  "25005": "no_active_sql_transaction_for_branch_transaction",
  "25006": "read_only_sql_transaction",
  "25007": "schema_and_data_statement_mixing_not_supported",
  "25P01": "no_active_sql_transaction",
  "25P02": "in_failed_sql_transaction",
  "25P03": "idle_in_transaction_session_timeout",
  "25P04": "transaction_timeout",
  "26000": "invalid_sql_statement_name",
  "27000": "triggered_data_change_violation",
  "28000": "invalid_authorization_specification",
  "28P01": "invalid_password",
  "2B000": "dependent_privilege_descriptors_still_exist",
  "2BP01": "dependent_objects_still_exist",
  "2D000": "invalid_transaction_termination",
  "2F000": "sql_routine_exception",
  "2F005": "function_executed_no_return_statement",
  "2F002": "modifying_sql_data_not_permitted",
  "2F003": "prohibited_sql_statement_attempted",
  "2F004": "reading_sql_data_not_permitted",
  "34000": "invalid_cursor_name",
  "38000": "external_routine_exception",
  "38001": "containing_sql_not_permitted",
  "38002": "modifying_sql_data_not_permitted",
  "38003": "prohibited_sql_statement_attempted",
  "38004": "reading_sql_data_not_permitted",
  "39000": "external_routine_invocation_exception",
  "39001": "invalid_sqlstate_returned",
  "39004": "null_value_not_allowed",
  "39P01": "trigger_protocol_violated",
  "39P02": "srf_protocol_violated",
  "39P03": "event_trigger_protocol_violated",
  "3B000": "savepoint_exception",
  "3B001": "invalid_savepoint_specification",
  "3D000": "invalid_catalog_name",
  "3F000": "invalid_schema_name",
  "40000": "transaction_rollback",
  "40002": "transaction_integrity_constraint_violation",
  "40001": "serialization_failure",
  "40003": "statement_completion_unknown",
  "40P01": "deadlock_detected",
  "42000": "syntax_error_or_access_rule_violation",
  "42601": "syntax_error",
  "42501": "insufficient_privilege",
  "42846": "cannot_coerce",
  "42803": "grouping_error",
  "42P20": "windowing_error",
  "42P19": "invalid_recursion",
  "42830": "invalid_foreign_key",
  "42602": "invalid_name",
  "42622": "name_too_long",
  "42939": "reserved_name",
  "42804": "datatype_mismatch",
  "42P18": "indeterminate_datatype",
  "42P21": "collation_mismatch",
  "42P22": "indeterminate_collation",
  "42809": "wrong_object_type",
  "428C9": "generated_always",
  "42703": "undefined_column",
  "42883": "undefined_function",
  "42P01": "undefined_table",
  "42P02": "undefined_parameter",
  "42704": "undefined_object",
  "42701": "duplicate_column",
  "42P03": "duplicate_cursor",
  "42P04": "duplicate_database",
  "42723": "duplicate_function",
  "42P05": "duplicate_prepared_statement",
  "42P06": "duplicate_schema",
  "42P07": "duplicate_table",
  "42712": "duplicate_alias",
  "42710": "duplicate_object",
  "42702": "ambiguous_column",
  "42725": "ambiguous_function",
  "42P08": "ambiguous_parameter",
  "42P09": "ambiguous_alias",
  "42P10": "invalid_column_reference",
  "42611": "invalid_column_definition",
  "42P11": "invalid_cursor_definition",
  "42P12": "invalid_database_definition",
  "42P13": "invalid_function_definition",
  "42P14": "invalid_prepared_statement_definition",
  "42P15": "invalid_schema_definition",
  "42P16": "invalid_table_definition",
  "42P17": "invalid_object_definition",
  "44000": "with_check_option_violation",
  "53000": "insufficient_resources",
  "53100": "disk_full",
  "53200": "out_of_memory",
  "53300": "too_many_connections",
  "53400": "configuration_limit_exceeded",
  "54000": "program_limit_exceeded",
  "54001": "statement_too_complex",
  "54011": "too_many_columns",
  "54023": "too_many_arguments",
  "55000": "object_not_in_prerequisite_state",
  "55006": "object_in_use",
  "55P02": "cant_change_runtime_param",
  "55P03": "lock_not_available",
  "55P04": "unsafe_new_enum_value_usage",
  "57000": "operator_intervention",
  "57014": "query_canceled",
  "57P01": "admin_shutdown",
  "57P02": "crash_shutdown",
  "57P03": "cannot_connect_now",
  "57P04": "database_dropped",
  "57P05": "idle_session_timeout",
  "58000": "system_error",
  "58030": "io_error",
  "58P01": "undefined_file",
  "58P02": "duplicate_file",
  "58P03": "file_name_too_long",
  F0000: "config_file_error",
  F0001: "lock_file_exists",
  HV000: "fdw_error",
  HV005: "fdw_column_name_not_found",
  HV002: "fdw_dynamic_parameter_value_needed",
  HV010: "fdw_function_sequence_error",
  HV021: "fdw_inconsistent_descriptor_information",
  HV024: "fdw_invalid_attribute_value",
  HV007: "fdw_invalid_column_name",
  HV008: "fdw_invalid_column_number",
  HV004: "fdw_invalid_data_type",
  HV006: "fdw_invalid_data_type_descriptors",
  HV091: "fdw_invalid_descriptor_field_identifier",
  HV00B: "fdw_invalid_handle",
  HV00C: "fdw_invalid_option_index",
  HV00D: "fdw_invalid_option_name",
  HV090: "fdw_invalid_string_length_or_buffer_length",
  HV00A: "fdw_invalid_string_format",
  HV009: "fdw_invalid_use_of_null_pointer",
  HV014: "fdw_too_many_handles",
  HV001: "fdw_out_of_memory",
  HV00P: "fdw_no_schemas",
  HV00J: "fdw_option_name_not_found",
  HV00K: "fdw_reply_handle",
  HV00Q: "fdw_schema_not_found",
  HV00R: "fdw_table_not_found",
  HV00L: "fdw_unable_to_create_execution",
  HV00M: "fdw_unable_to_create_reply",
  HV00N: "fdw_unable_to_establish_connection",
  P0000: "plpgsql_error",
  P0001: "raise_exception",
  P0002: "no_data_found",
  P0003: "too_many_rows",
  P0004: "assert_failure",
  XX000: "internal_error",
  XX001: "data_corrupted",
  XX002: "index_corrupted"
};
var semanticFieldOverrides = {
  "23502": ["schemaName", "tableName", "columnName", "detail"],
  "23503": ["schemaName", "tableName", "constraintName", "detail"],
  "23505": ["schemaName", "tableName", "constraintName", "detail"],
  "23514": ["schemaName", "tableName", "constraintName", "detail"],
  "23P01": ["schemaName", "tableName", "constraintName", "detail"],
  "3D000": ["schemaName", "detail"],
  "3F000": ["schemaName", "detail"],
  "42P01": ["schemaName", "tableName", "position"],
  "42703": ["schemaName", "tableName", "columnName", "position"],
  "42704": ["detail", "position"],
  "42883": ["dataTypeName", "position", "hint"],
  "42P02": ["position", "detail"],
  "42601": ["position", "detail", "hint"]
};
var inferSemanticFields = (code, condition) => {
  const override = semanticFieldOverrides[code];
  if (override) {
    return override;
  }
  const fields = new Set;
  if (condition.includes("schema"))
    fields.add("schemaName");
  if (condition.includes("table") || condition.includes("relation"))
    fields.add("tableName");
  if (condition.includes("column"))
    fields.add("columnName");
  if (condition.includes("datatype") || condition.includes("data_type") || condition.includes("cast"))
    fields.add("dataTypeName");
  if (condition.includes("constraint") || condition.includes("foreign_key") || condition.includes("unique") || condition.includes("check_") || condition.includes("exclusion"))
    fields.add("constraintName");
  if (condition.includes("syntax") || condition.includes("parse") || condition.includes("parameter") || condition.includes("function") || condition.includes("operator") || condition.includes("statement"))
    fields.add("position");
  if (condition.includes("privilege") || condition.includes("permission") || condition.includes("authorization"))
    fields.add("hint");
  if (code.startsWith("08") || code.startsWith("53") || code.startsWith("57") || code.startsWith("58") || code.startsWith("XX")) {
    fields.add("detail");
  }
  return [...fields];
};
var toTag = (code, condition) => `@postgres/${postgresErrorTypes[code.slice(0, 2)]}/${condition.replaceAll("_", "-")}`;
var postgresErrorCatalog = Object.freeze(Object.fromEntries(Object.entries(postgresErrorConditions).map(([code, condition]) => {
  const classCode = code.slice(0, 2);
  return [code, {
    code,
    condition,
    classCode,
    className: postgresErrorClasses[classCode],
    tag: toTag(code, condition),
    primaryFields: inferSemanticFields(code, condition)
  }];
})));
var isPostgresSqlStateCode = (value) => (value in postgresErrorCatalog);
var getPostgresErrorDescriptor = (code) => postgresErrorCatalog[code];
// src/postgres/errors/fields.ts
var postgresErrorSemanticFields = [
  "severity",
  "severityNonLocalized",
  "detail",
  "hint",
  "position",
  "internalPosition",
  "internalQuery",
  "where",
  "schemaName",
  "tableName",
  "columnName",
  "dataTypeName",
  "constraintName",
  "file",
  "line",
  "routine"
];
// src/postgres/errors/normalize.ts
var isRecord = (value) => typeof value === "object" && value !== null;
var asString = (value) => typeof value === "string" ? value : undefined;
var asNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return;
};
var normalizeFields = (error) => ({
  severity: asString(error.severity),
  severityNonLocalized: asString(error.severityNonLocalized),
  detail: asString(error.detail),
  hint: asString(error.hint),
  position: asNumber(error.position),
  internalPosition: asNumber(error.internalPosition),
  internalQuery: asString(error.internalQuery),
  where: asString(error.where),
  schemaName: asString(error.schemaName) ?? asString(error.schema),
  tableName: asString(error.tableName) ?? asString(error.table),
  columnName: asString(error.columnName) ?? asString(error.column),
  dataTypeName: asString(error.dataTypeName) ?? asString(error.dataType),
  constraintName: asString(error.constraintName) ?? asString(error.constraint),
  file: asString(error.file),
  line: asNumber(error.line),
  routine: asString(error.routine)
});
var sqlStatePattern = /^[0-9A-Z]{5}$/;
var isPostgresErrorLike = (value) => isRecord(value) && (typeof value.code === "string" && sqlStatePattern.test(value.code) || typeof value.severity === "string" || typeof value.message === "string" || typeof value.messagePrimary === "string");
var errorMessageOf = (error) => error.message ?? error.messagePrimary ?? "Postgres driver error";
var makeKnownPostgresError = (code, raw, query) => {
  const descriptor = getPostgresErrorDescriptor(code);
  return {
    _tag: descriptor.tag,
    code,
    condition: descriptor.condition,
    classCode: descriptor.classCode,
    className: descriptor.className,
    message: errorMessageOf(raw),
    primaryFields: descriptor.primaryFields,
    query,
    raw,
    ...normalizeFields(raw)
  };
};
var normalizePostgresDriverError = (cause, query) => {
  const context = query === undefined ? undefined : ("sql" in query) ? { sql: query.sql, params: query.params } : query;
  if (!isPostgresErrorLike(cause)) {
    return {
      _tag: "@postgres/unknown/driver",
      message: cause instanceof Error ? cause.message : "Unknown Postgres driver failure",
      query: context,
      cause
    };
  }
  if (cause.code && isPostgresSqlStateCode(cause.code)) {
    return makeKnownPostgresError(cause.code, cause, context);
  }
  if (typeof cause.code === "string" && sqlStatePattern.test(cause.code)) {
    const classCode = cause.code.slice(0, 2);
    return {
      _tag: "@postgres/unknown/sqlstate",
      code: cause.code,
      classCode,
      className: classCode in postgresErrorClasses ? postgresErrorClasses[classCode] : undefined,
      message: errorMessageOf(cause),
      query: context,
      raw: cause,
      ...normalizeFields(cause)
    };
  }
  return {
    _tag: "@postgres/unknown/driver",
    message: errorMessageOf(cause),
    query: context,
    cause
  };
};
var hasSqlState = (error, code) => ("code" in error) && error.code === code;
// src/postgres/errors/requirements.ts
var postgres_requirements_by_class_code = {
  "23": ["write"],
  "27": ["write"],
  "44": ["write"]
};
var lookup_postgres_requirements = (classCode) => (classCode in postgres_requirements_by_class_code) ? postgres_requirements_by_class_code[classCode] : [];
var requirements_of_postgres_error = (error) => ("classCode" in error) ? lookup_postgres_requirements(error.classCode) : [];
var narrowPostgresDriverErrorForReadQuery = (error) => {
  const requiredCapabilities = requirements_of_postgres_error(error);
  if (requiredCapabilities.length === 0) {
    return error;
  }
  return {
    _tag: "@postgres/unknown/query-requirements",
    message: "Postgres driver error requires query capabilities not provided by this plan",
    query: error.query,
    requiredCapabilities,
    actualCapabilities: read_query_capabilities,
    cause: error
  };
};
// src/postgres/function/index.ts
var exports_function = {};
__export(exports_function, {
  window: () => exports_window,
  uuidGenerateV4: () => uuidGenerateV4,
  upper: () => upper,
  temporal: () => exports_temporal,
  string: () => exports_string,
  rowNumber: () => rowNumber,
  rank: () => rank,
  over: () => over,
  now: () => now,
  nextVal: () => nextVal,
  min: () => min,
  max: () => max,
  lower: () => lower,
  localTimestamp: () => localTimestamp,
  localTime: () => localTime,
  jsonb: () => jsonb2,
  json: () => json2,
  denseRank: () => denseRank,
  currentTimestamp: () => currentTimestamp,
  currentTime: () => currentTime,
  currentDate: () => currentDate,
  count: () => count,
  core: () => exports_core,
  concat: () => concat,
  coalesce: () => coalesce,
  call: () => call,
  aggregate: () => exports_aggregate
});

// src/postgres/function/core.ts
var exports_core = {};
__export(exports_core, {
  uuidGenerateV4: () => uuidGenerateV4,
  nextVal: () => nextVal,
  coalesce: () => coalesce,
  call: () => call
});

// src/internal/query-factory.ts
import { pipeArguments as pipeArguments7 } from "effect/Pipeable";
import * as Schema4 from "effect/Schema";

// src/internal/derived-table.ts
import { pipeArguments as pipeArguments6 } from "effect/Pipeable";
var DerivedProto = {
  pipe() {
    return pipeArguments6(this, arguments);
  }
};
var setPath = (target, path2, value) => {
  let current = target;
  for (let index3 = 0;index3 < path2.length - 1; index3++) {
    const segment = path2[index3];
    const existing = current[segment];
    if (typeof existing === "object" && existing !== null && !Array.isArray(existing)) {
      current = existing;
      continue;
    }
    const next = {};
    current[segment] = next;
    current = next;
  }
  current[path2[path2.length - 1]] = value;
};
var pathAlias = (path2) => path2.join("__");
var reboundedColumns = (plan, alias2) => {
  const ast = getAst(plan);
  const selection = {};
  for (const projection of flattenSelection(ast.select)) {
    const expectedAlias = pathAlias(projection.path);
    if (projection.alias !== expectedAlias) {
      throw new Error(`Derived subqueries currently require path-based output aliases; expected '${expectedAlias}' for path '${projection.path.join(".")}'`);
    }
    const expression = projection.expression;
    setPath(selection, projection.path, makeExpression({
      runtime: undefined,
      dbType: expression[TypeId2].dbType,
      runtimeSchema: expression[TypeId2].runtimeSchema,
      nullability: expression[TypeId2].nullability,
      dialect: expression[TypeId2].dialect,
      aggregation: "scalar",
      source: {
        tableName: alias2,
        columnName: projection.alias,
        baseTableName: alias2
      },
      sourceNullability: "propagate",
      dependencies: {
        [alias2]: true
      }
    }, {
      kind: "column",
      tableName: alias2,
      columnName: projection.alias
    }));
  }
  return selection;
};
var makeDerivedSource = (plan, alias2) => {
  const columns = reboundedColumns(plan, alias2);
  const derived = Object.create(DerivedProto);
  Object.assign(derived, columns);
  derived.kind = "derived";
  derived.name = alias2;
  derived.baseName = alias2;
  derived.dialect = plan[TypeId].dialect;
  derived.plan = plan;
  derived.required = undefined;
  derived.columns = columns;
  return derived;
};
var makeCteSource = (plan, alias2, recursive = false) => {
  const columns = reboundedColumns(plan, alias2);
  const cte = Object.create(DerivedProto);
  Object.assign(cte, columns);
  cte.kind = "cte";
  cte.name = alias2;
  cte.baseName = alias2;
  cte.dialect = plan[TypeId].dialect;
  cte.plan = plan;
  cte.recursive = recursive;
  cte.required = undefined;
  cte.columns = columns;
  return cte;
};
var makeLateralSource = (plan, alias2) => {
  const columns = reboundedColumns(plan, alias2);
  const lateral = Object.create(DerivedProto);
  Object.assign(lateral, columns);
  lateral.kind = "lateral";
  lateral.name = alias2;
  lateral.baseName = alias2;
  lateral.dialect = plan[TypeId].dialect;
  lateral.plan = plan;
  lateral.required = undefined;
  lateral.columns = columns;
  return lateral;
};

// src/internal/query-factory.ts
function makeDialectQuery(profile) {
  const ValuesInputProto = {
    pipe() {
      return pipeArguments7(this, arguments);
    }
  };
  const literalSchemaOf = (value) => {
    if (value === null || value instanceof Date) {
      return;
    }
    return Schema4.Literal(value);
  };
  const literal = (value) => makeExpression({
    runtime: undefined,
    dbType: value === null ? profile.nullDb : value instanceof Date ? profile.timestampDb : typeof value === "string" ? profile.textDb : typeof value === "number" ? profile.numericDb : profile.boolDb,
    runtimeSchema: literalSchemaOf(value),
    nullability: value === null ? "always" : "never",
    dialect: profile.dialect,
    aggregation: "scalar",
    source: undefined,
    sourceNullability: "propagate",
    dependencies: {}
  }, {
    kind: "literal",
    value
  });
  const column = (name2, dbType, nullable2 = false) => makeExpression({
    runtime: undefined,
    dbType,
    nullability: nullable2 ? "maybe" : "never",
    dialect: profile.dialect,
    aggregation: "scalar",
    source: undefined,
    sourceNullability: "resolved",
    dependencies: {}
  }, {
    kind: "column",
    tableName: "",
    columnName: name2
  });
  const toDialectExpression = (value) => {
    if (value !== null && typeof value === "object" && TypeId2 in value) {
      return value;
    }
    return literal(value);
  };
  const toDialectStringExpression = (value) => typeof value === "string" ? literal(value) : value;
  const toDialectNumericExpression = (value) => typeof value === "number" ? literal(value) : value;
  const extractRequiredFromDialectInputRuntime = (value) => {
    const expression = toDialectExpression(value);
    return Object.keys(expression[TypeId2].dependencies);
  };
  const normalizeWindowSpec = (spec) => {
    const partitionBy = [...spec?.partitionBy ?? []];
    const orderBy2 = (spec?.orderBy ?? []).map((term) => ({
      value: term.value,
      direction: term.direction ?? "asc"
    }));
    return {
      partitionBy,
      orderBy: orderBy2
    };
  };
  const mergeWindowExpressions = (value, partitionBy, orderBy2) => value === undefined ? [...partitionBy, ...orderBy2.map((term) => term.value)] : [value, ...partitionBy, ...orderBy2.map((term) => term.value)];
  const extractRequiredFromDialectNumericInputRuntime = (value) => {
    const expression = toDialectNumericExpression(value);
    return Object.keys(expression[TypeId2].dependencies);
  };
  const buildBinaryPredicate = (left, right, kind, nullability = "maybe", sourceNullability = "propagate") => {
    const leftExpression = toDialectExpression(left);
    const rightExpression = toDialectExpression(right);
    return makeExpression({
      runtime: true,
      dbType: profile.boolDb,
      nullability,
      dialect: leftExpression[TypeId2].dialect ?? rightExpression[TypeId2].dialect,
      aggregation: mergeAggregationRuntime(leftExpression[TypeId2].aggregation, rightExpression[TypeId2].aggregation),
      source: mergeSources(leftExpression[TypeId2].source, rightExpression[TypeId2].source),
      sourceNullability,
      dependencies: mergeDependencies(leftExpression[TypeId2].dependencies, rightExpression[TypeId2].dependencies)
    }, {
      kind,
      left: leftExpression,
      right: rightExpression
    });
  };
  const buildVariadicPredicate = (values2, kind) => {
    const expressions = values2.map((value) => toDialectExpression(value));
    return makeExpression({
      runtime: true,
      dbType: profile.boolDb,
      nullability: "maybe",
      dialect: expressions.find((value) => value[TypeId2].dialect !== undefined)?.[TypeId2].dialect ?? profile.dialect,
      aggregation: mergeAggregationManyRuntime(expressions),
      source: mergeManySources(expressions),
      sourceNullability: "propagate",
      dependencies: mergeManyDependencies(expressions)
    }, {
      kind,
      values: expressions
    });
  };
  const eq = (...args) => {
    const [left, right] = args;
    return buildBinaryPredicate(left, right, "eq");
  };
  const neq = (...args) => {
    const [left, right] = args;
    return buildBinaryPredicate(left, right, "neq");
  };
  const lt = (...args) => {
    const [left, right] = args;
    return buildBinaryPredicate(left, right, "lt");
  };
  const lte = (...args) => {
    const [left, right] = args;
    return buildBinaryPredicate(left, right, "lte");
  };
  const gt = (...args) => {
    const [left, right] = args;
    return buildBinaryPredicate(left, right, "gt");
  };
  const gte = (...args) => {
    const [left, right] = args;
    return buildBinaryPredicate(left, right, "gte");
  };
  const like = (...args) => {
    const [left, right] = args;
    return buildBinaryPredicate(left, right, "like");
  };
  const ilike = (...args) => {
    const [left, right] = args;
    return buildBinaryPredicate(left, right, "ilike");
  };
  const regexMatch = (...args) => {
    const [left, right] = args;
    return buildBinaryPredicate(left, right, "regexMatch");
  };
  const regexIMatch = (...args) => {
    const [left, right] = args;
    return buildBinaryPredicate(left, right, "regexIMatch");
  };
  const regexNotMatch = (...args) => {
    const [left, right] = args;
    return buildBinaryPredicate(left, right, "regexNotMatch");
  };
  const regexNotIMatch = (...args) => {
    const [left, right] = args;
    return buildBinaryPredicate(left, right, "regexNotIMatch");
  };
  const isDistinctFrom = (...args) => {
    const [left, right] = args;
    return buildBinaryPredicate(left, right, "isDistinctFrom", "never", "resolved");
  };
  const isNotDistinctFrom = (...args) => {
    const [left, right] = args;
    return buildBinaryPredicate(left, right, "isNotDistinctFrom", "never", "resolved");
  };
  const isNull = (value) => {
    const expression = toDialectExpression(value);
    return makeExpression({
      runtime: true,
      dbType: profile.boolDb,
      nullability: "never",
      dialect: expression[TypeId2].dialect,
      aggregation: expression[TypeId2].aggregation,
      source: expression[TypeId2].source,
      sourceNullability: "resolved",
      dependencies: expression[TypeId2].dependencies
    }, {
      kind: "isNull",
      value: expression
    });
  };
  const isNotNull = (value) => {
    const expression = toDialectExpression(value);
    return makeExpression({
      runtime: true,
      dbType: profile.boolDb,
      nullability: "never",
      dialect: expression[TypeId2].dialect,
      aggregation: expression[TypeId2].aggregation,
      source: expression[TypeId2].source,
      sourceNullability: "resolved",
      dependencies: expression[TypeId2].dependencies
    }, {
      kind: "isNotNull",
      value: expression
    });
  };
  const upper = (value) => {
    const expression = toDialectStringExpression(value);
    return makeExpression({
      runtime: "",
      dbType: profile.textDb,
      nullability: expression[TypeId2].nullability,
      dialect: expression[TypeId2].dialect,
      aggregation: expression[TypeId2].aggregation,
      source: expression[TypeId2].source,
      sourceNullability: "propagate",
      dependencies: expression[TypeId2].dependencies
    }, {
      kind: "upper",
      value: expression
    });
  };
  const lower = (value) => {
    const expression = toDialectStringExpression(value);
    return makeExpression({
      runtime: "",
      dbType: profile.textDb,
      nullability: expression[TypeId2].nullability,
      dialect: expression[TypeId2].dialect,
      aggregation: expression[TypeId2].aggregation,
      source: expression[TypeId2].source,
      sourceNullability: "propagate",
      dependencies: expression[TypeId2].dependencies
    }, {
      kind: "lower",
      value: expression
    });
  };
  const cast = (value, target) => {
    const expression = toDialectExpression(value);
    return makeExpression({
      runtime: undefined,
      dbType: target,
      runtimeSchema: undefined,
      nullability: expression[TypeId2].nullability,
      dialect: expression[TypeId2].dialect,
      aggregation: expression[TypeId2].aggregation,
      source: expression[TypeId2].source,
      sourceNullability: expression[TypeId2].sourceNullability,
      dependencies: expression[TypeId2].dependencies
    }, {
      kind: "cast",
      value: expression,
      target
    });
  };
  const array2 = (element) => ({
    dialect: profile.dialect,
    kind: `${element.kind}[]`,
    element
  });
  const range = (kind, subtype) => ({
    dialect: profile.dialect,
    kind,
    subtype
  });
  const multirange = (kind, subtype) => ({
    dialect: profile.dialect,
    kind,
    subtype
  });
  const record = (kind, fields2) => ({
    dialect: profile.dialect,
    kind,
    fields: fields2
  });
  const domain = (kind, base) => ({
    dialect: profile.dialect,
    kind,
    base
  });
  const enum_ = (kind) => ({
    dialect: profile.dialect,
    kind,
    variant: "enum"
  });
  const set = (kind) => ({
    dialect: profile.dialect,
    kind,
    variant: "set"
  });
  const custom2 = (kind) => ({
    dialect: profile.dialect,
    kind
  });
  const type = {
    ...profile.type,
    array: array2,
    range,
    multirange,
    record,
    domain,
    enum: enum_,
    set,
    custom: custom2
  };
  const makeJsonDb = (kind) => ({
    dialect: profile.dialect,
    kind,
    variant: "json"
  });
  const jsonDb = makeJsonDb("json");
  const jsonbDb = makeJsonDb(profile.dialect === "postgres" ? "jsonb" : "json");
  const isExpressionValue = (value) => value !== null && typeof value === "object" && (TypeId2 in value);
  const isJsonExpressionValue = (value) => isExpressionValue(value) && (() => {
    const dbType = value[TypeId2].dbType;
    return dbType.variant === "json" || dbType.kind === "json" || dbType.kind === "jsonb";
  })();
  const isJsonPathValue2 = (value) => value !== null && typeof value === "object" && (TypeId7 in value);
  const normalizeJsonPathInput = (value) => isJsonPathValue2(value) ? value.segments : [value];
  const isExactJsonSegmentValue = (segment) => segment.kind === "key" || segment.kind === "index";
  const isExactJsonPathValue = (segments) => segments.every(isExactJsonSegmentValue);
  const buildJsonNodeExpression = (expressions, state, ast) => makeExpression({
    runtime: state.runtime,
    dbType: state.dbType,
    nullability: state.nullability,
    dialect: expressions.find((expression) => expression[TypeId2].dialect !== undefined)?.[TypeId2].dialect ?? profile.dialect,
    aggregation: mergeAggregationManyRuntime(expressions),
    source: mergeManySources(expressions),
    sourceNullability: state.sourceNullability ?? "propagate",
    dependencies: mergeManyDependencies(expressions)
  }, ast);
  const jsonDbTypeOf = (base) => base[TypeId2].dbType;
  const resolveJsonMergeDbType = (...values2) => profile.dialect === "postgres" || values2.some((value) => value[TypeId2].dbType.kind === "jsonb") ? jsonbDb : jsonDb;
  const makeJsonLiteralExpression = (value, dbType = jsonDb) => makeExpression({
    runtime: value,
    dbType,
    nullability: value === null ? "always" : "never",
    dialect: profile.dialect,
    aggregation: "scalar",
    source: undefined,
    sourceNullability: "resolved",
    dependencies: {}
  }, {
    kind: "literal",
    value
  });
  const wrapJsonExpression = (value, kind, dbType) => buildJsonNodeExpression([value], {
    runtime: undefined,
    dbType,
    nullability: value[TypeId2].nullability,
    sourceNullability: value[TypeId2].sourceNullability
  }, {
    kind,
    value
  });
  const toJsonValueExpression = (value, kind = "jsonToJson", dbType = jsonDb) => {
    if (isJsonExpressionValue(value)) {
      return value;
    }
    if (isExpressionValue(value)) {
      return wrapJsonExpression(value, kind, dbType);
    }
    return makeJsonLiteralExpression(value, dbType);
  };
  const jsonQueryExpression = (query) => toDialectStringExpression(query);
  const jsonGet = (base, target) => {
    const segments = normalizeJsonPathInput(target);
    const kind = isJsonPathValue2(target) ? isExactJsonPathValue(segments) ? "jsonPath" : "jsonTraverse" : isExactJsonSegmentValue(target) ? "jsonGet" : "jsonAccess";
    return buildJsonNodeExpression([base], {
      runtime: undefined,
      dbType: jsonDbTypeOf(base),
      nullability: undefined
    }, {
      kind,
      base,
      segments
    });
  };
  const jsonText = (base, target) => {
    const segments = normalizeJsonPathInput(target);
    const kind = isJsonPathValue2(target) ? isExactJsonPathValue(segments) ? "jsonPathText" : "jsonTraverseText" : isExactJsonSegmentValue(target) ? "jsonGetText" : "jsonAccessText";
    return buildJsonNodeExpression([base], {
      runtime: undefined,
      dbType: profile.textDb,
      nullability: undefined
    }, {
      kind,
      base,
      segments
    });
  };
  const jsonAccess = (base, target) => {
    const segments = normalizeJsonPathInput(target);
    return buildJsonNodeExpression([base], {
      runtime: undefined,
      dbType: jsonDbTypeOf(base),
      nullability: undefined
    }, {
      kind: isJsonPathValue2(target) || segments.length > 1 ? "jsonTraverse" : "jsonAccess",
      base,
      segments
    });
  };
  const jsonTraverse = (base, target) => {
    const segments = normalizeJsonPathInput(target);
    return buildJsonNodeExpression([base], {
      runtime: undefined,
      dbType: jsonDbTypeOf(base),
      nullability: undefined
    }, {
      kind: "jsonTraverse",
      base,
      segments
    });
  };
  const jsonAccessText = (base, target) => {
    const segments = normalizeJsonPathInput(target);
    return buildJsonNodeExpression([base], {
      runtime: undefined,
      dbType: profile.textDb,
      nullability: undefined
    }, {
      kind: isJsonPathValue2(target) || segments.length > 1 ? "jsonTraverseText" : "jsonAccessText",
      base,
      segments
    });
  };
  const jsonTraverseText = (base, target) => {
    const segments = normalizeJsonPathInput(target);
    return buildJsonNodeExpression([base], {
      runtime: undefined,
      dbType: profile.textDb,
      nullability: undefined
    }, {
      kind: "jsonTraverseText",
      base,
      segments
    });
  };
  const jsonContains = (left, right) => buildBinaryPredicate(left, toJsonValueExpression(right), "contains");
  const jsonContainedBy = (left, right) => buildBinaryPredicate(left, toJsonValueExpression(right), "containedBy");
  const jsonHasKey = (base, key2) => buildJsonNodeExpression([base], {
    runtime: true,
    dbType: profile.boolDb,
    nullability: "never",
    sourceNullability: "resolved"
  }, {
    kind: "jsonHasKey",
    base,
    keys: [key2]
  });
  const jsonHasAnyKeys = (base, ...keys) => buildJsonNodeExpression([base], {
    runtime: true,
    dbType: profile.boolDb,
    nullability: "never",
    sourceNullability: "resolved"
  }, {
    kind: "jsonHasAnyKeys",
    base,
    keys
  });
  const jsonHasAllKeys = (base, ...keys) => buildJsonNodeExpression([base], {
    runtime: true,
    dbType: profile.boolDb,
    nullability: "never",
    sourceNullability: "resolved"
  }, {
    kind: "jsonHasAllKeys",
    base,
    keys
  });
  const jsonDelete = (base, target) => {
    const segments = normalizeJsonPathInput(target);
    return buildJsonNodeExpression([base], {
      runtime: undefined,
      dbType: jsonDbTypeOf(base),
      nullability: undefined
    }, {
      kind: isJsonPathValue2(target) ? "jsonDeletePath" : "jsonDelete",
      base,
      segments
    });
  };
  const jsonRemove = (base, target) => {
    const segments = normalizeJsonPathInput(target);
    return buildJsonNodeExpression([base], {
      runtime: undefined,
      dbType: jsonDbTypeOf(base),
      nullability: undefined
    }, {
      kind: "jsonRemove",
      base,
      segments
    });
  };
  const jsonSet = (base, target, next, options2 = {}) => {
    const segments = normalizeJsonPathInput(target);
    const newValue = toJsonValueExpression(next);
    return buildJsonNodeExpression([base, newValue], {
      runtime: undefined,
      dbType: jsonDbTypeOf(base),
      nullability: undefined
    }, {
      kind: "jsonSet",
      base,
      segments,
      newValue,
      createMissing: options2.createMissing ?? true
    });
  };
  const jsonInsert = (base, target, next, options2 = {}) => {
    const segments = normalizeJsonPathInput(target);
    const insert2 = toJsonValueExpression(next);
    const insertAfter = options2.insertAfter ?? false;
    return buildJsonNodeExpression([base, insert2], {
      runtime: undefined,
      dbType: jsonDbTypeOf(base),
      nullability: undefined
    }, {
      kind: "jsonInsert",
      base,
      segments,
      insert: insert2,
      insertAfter
    });
  };
  const jsonConcatAs = (dbType) => (left, right) => {
    const leftExpression = toJsonValueExpression(left);
    const rightExpression = toJsonValueExpression(right);
    return buildJsonNodeExpression([leftExpression, rightExpression], {
      runtime: undefined,
      dbType,
      nullability: "maybe"
    }, {
      kind: "jsonConcat",
      left: leftExpression,
      right: rightExpression
    });
  };
  const jsonMergeAs = (dbType) => (left, right) => {
    const leftExpression = toJsonValueExpression(left);
    const rightExpression = toJsonValueExpression(right);
    return buildJsonNodeExpression([leftExpression, rightExpression], {
      runtime: undefined,
      dbType,
      nullability: "maybe"
    }, {
      kind: "jsonMerge",
      left: leftExpression,
      right: rightExpression
    });
  };
  const jsonConcat = jsonConcatAs(resolveJsonMergeDbType());
  const jsonMerge = jsonMergeAs(resolveJsonMergeDbType());
  const jsonKeyExists = (base, key2) => buildJsonNodeExpression([base], {
    runtime: true,
    dbType: profile.boolDb,
    nullability: "never",
    sourceNullability: "resolved"
  }, {
    kind: "jsonKeyExists",
    base,
    keys: [key2]
  });
  const jsonBuildObjectAs = (dbType) => (shape) => {
    const entries = Object.entries(shape).map(([key2, value]) => ({
      key: key2,
      value: toJsonValueExpression(value)
    }));
    return buildJsonNodeExpression(entries.map((entry) => entry.value), {
      runtime: {},
      dbType,
      nullability: "never",
      sourceNullability: "resolved"
    }, {
      kind: "jsonBuildObject",
      entries
    });
  };
  const jsonBuildArrayAs = (dbType) => (...values2) => {
    const expressions = values2.map((value) => toJsonValueExpression(value));
    return buildJsonNodeExpression(expressions, {
      runtime: [],
      dbType,
      nullability: "never",
      sourceNullability: "resolved"
    }, {
      kind: "jsonBuildArray",
      values: expressions
    });
  };
  const jsonBuildObject = jsonBuildObjectAs(jsonDb);
  const jsonBuildArray = jsonBuildArrayAs(jsonDb);
  const jsonbBuildObject = jsonBuildObjectAs(jsonbDb);
  const jsonbBuildArray = jsonBuildArrayAs(jsonbDb);
  const jsonToJson = (value) => toJsonValueExpression(value, "jsonToJson", jsonDb);
  const jsonToJsonb = (value) => toJsonValueExpression(value, "jsonToJsonb", jsonbDb);
  const jsonTypeOf = (base) => buildJsonNodeExpression([base], {
    runtime: undefined,
    dbType: profile.textDb,
    nullability: base[TypeId2].nullability
  }, {
    kind: "jsonTypeOf",
    value: base
  });
  const jsonLength = (base) => buildJsonNodeExpression([base], {
    runtime: undefined,
    dbType: profile.numericDb,
    nullability: undefined
  }, {
    kind: "jsonLength",
    value: base
  });
  const jsonKeys = (base) => buildJsonNodeExpression([base], {
    runtime: undefined,
    dbType: jsonDb,
    nullability: undefined
  }, {
    kind: "jsonKeys",
    value: base
  });
  const jsonPathExists = (base, query) => {
    if (isJsonPathValue2(query)) {
      return buildJsonNodeExpression([base], {
        runtime: true,
        dbType: profile.boolDb,
        nullability: "never",
        sourceNullability: "resolved"
      }, {
        kind: "jsonPathExists",
        base,
        query
      });
    }
    const queryExpression = jsonQueryExpression(query);
    return buildJsonNodeExpression([base, queryExpression], {
      runtime: true,
      dbType: profile.boolDb,
      nullability: "never",
      sourceNullability: "resolved"
    }, {
      kind: "jsonPathExists",
      base,
      query: queryExpression
    });
  };
  const jsonStripNulls = (base) => buildJsonNodeExpression([base], {
    runtime: undefined,
    dbType: jsonDbTypeOf(base),
    nullability: undefined
  }, {
    kind: "jsonStripNulls",
    value: base
  });
  const jsonPathMatch = (base, query) => {
    if (isJsonPathValue2(query)) {
      return buildJsonNodeExpression([base], {
        runtime: true,
        dbType: profile.boolDb,
        nullability: "never",
        sourceNullability: "resolved"
      }, {
        kind: "jsonPathMatch",
        base,
        query
      });
    }
    const queryExpression = jsonQueryExpression(query);
    return buildJsonNodeExpression([base, queryExpression], {
      runtime: true,
      dbType: profile.boolDb,
      nullability: "never",
      sourceNullability: "resolved"
    }, {
      kind: "jsonPathMatch",
      base,
      query: queryExpression
    });
  };
  const json2 = {
    key,
    index: index2,
    wildcard,
    slice,
    descend,
    path,
    get: jsonGet,
    access: jsonAccess,
    traverse: jsonTraverse,
    text: jsonText,
    accessText: jsonAccessText,
    traverseText: jsonTraverseText,
    contains: jsonContains,
    containedBy: jsonContainedBy,
    hasKey: jsonHasKey,
    keyExists: jsonKeyExists,
    hasAnyKeys: jsonHasAnyKeys,
    hasAllKeys: jsonHasAllKeys,
    delete: jsonDelete,
    remove: jsonRemove,
    set: jsonSet,
    insert: jsonInsert,
    concat: jsonConcat,
    merge: jsonMerge,
    buildObject: jsonBuildObject,
    buildArray: jsonBuildArray,
    toJson: jsonToJson,
    toJsonb: jsonToJsonb,
    typeOf: jsonTypeOf,
    length: jsonLength,
    keys: jsonKeys,
    stripNulls: jsonStripNulls,
    pathExists: jsonPathExists,
    pathMatch: jsonPathMatch
  };
  const jsonb2 = {
    key,
    index: index2,
    wildcard,
    slice,
    descend,
    path,
    get: jsonGet,
    access: jsonAccess,
    traverse: jsonTraverse,
    text: jsonText,
    accessText: jsonAccessText,
    traverseText: jsonTraverseText,
    contains: jsonContains,
    containedBy: jsonContainedBy,
    hasKey: jsonHasKey,
    keyExists: jsonKeyExists,
    hasAnyKeys: jsonHasAnyKeys,
    hasAllKeys: jsonHasAllKeys,
    delete: jsonDelete,
    remove: jsonRemove,
    set: jsonSet,
    insert: jsonInsert,
    concat: jsonConcatAs(jsonbDb),
    merge: jsonMergeAs(jsonbDb),
    buildObject: jsonbBuildObject,
    buildArray: jsonbBuildArray,
    toJsonb: jsonToJsonb,
    typeOf: jsonTypeOf,
    length: jsonLength,
    keys: jsonKeys,
    stripNulls: jsonStripNulls,
    pathExists: jsonPathExists,
    pathMatch: jsonPathMatch
  };
  const and = (...values2) => {
    const expressions = values2.map((value) => toDialectExpression(value));
    return makeExpression({
      runtime: true,
      dbType: profile.boolDb,
      nullability: mergeNullabilityManyRuntime(expressions),
      dialect: expressions.find((value) => value[TypeId2].dialect !== undefined)?.[TypeId2].dialect ?? profile.dialect,
      aggregation: mergeAggregationManyRuntime(expressions),
      source: mergeManySources(expressions),
      sourceNullability: "propagate",
      dependencies: mergeManyDependencies(expressions)
    }, {
      kind: "and",
      values: expressions
    });
  };
  const or = (...values2) => {
    const expressions = values2.map((value) => toDialectExpression(value));
    return makeExpression({
      runtime: true,
      dbType: profile.boolDb,
      nullability: mergeNullabilityManyRuntime(expressions),
      dialect: expressions.find((value) => value[TypeId2].dialect !== undefined)?.[TypeId2].dialect ?? profile.dialect,
      aggregation: mergeAggregationManyRuntime(expressions),
      source: mergeManySources(expressions),
      sourceNullability: "propagate",
      dependencies: mergeManyDependencies(expressions)
    }, {
      kind: "or",
      values: expressions
    });
  };
  const not = (value) => {
    const expression = toDialectExpression(value);
    return makeExpression({
      runtime: true,
      dbType: profile.boolDb,
      nullability: expression[TypeId2].nullability,
      dialect: expression[TypeId2].dialect,
      aggregation: expression[TypeId2].aggregation,
      source: expression[TypeId2].source,
      sourceNullability: "propagate",
      dependencies: expression[TypeId2].dependencies
    }, {
      kind: "not",
      value: expression
    });
  };
  const in_ = (head, ...tail) => buildVariadicPredicate([head, ...tail], "in");
  const notIn = (head, ...tail) => buildVariadicPredicate([head, ...tail], "notIn");
  const between = (...values2) => buildVariadicPredicate(values2, "between");
  const contains = (...args) => {
    const [left, right] = args;
    return buildBinaryPredicate(left, right, "contains");
  };
  const containedBy = (...args) => {
    const [left, right] = args;
    return buildBinaryPredicate(left, right, "containedBy");
  };
  const overlaps = (...args) => {
    const [left, right] = args;
    return buildBinaryPredicate(left, right, "overlaps");
  };
  const concat = (...values2) => {
    const expressions = values2.map((value) => toDialectStringExpression(value));
    return makeExpression({
      runtime: "",
      dbType: profile.textDb,
      nullability: mergeNullabilityManyRuntime(expressions),
      dialect: expressions.find((value) => value[TypeId2].dialect !== undefined)?.[TypeId2].dialect ?? profile.dialect,
      aggregation: mergeAggregationManyRuntime(expressions),
      source: mergeManySources(expressions),
      sourceNullability: "propagate",
      dependencies: mergeManyDependencies(expressions)
    }, {
      kind: "concat",
      values: expressions
    });
  };
  const all_ = (...values2) => and(...values2);
  const any_ = (...values2) => or(...values2);
  const count = (value) => {
    const expression = toDialectExpression(value);
    return makeExpression({
      runtime: 0,
      dbType: profile.numericDb,
      nullability: "never",
      dialect: expression[TypeId2].dialect,
      aggregation: "aggregate",
      source: expression[TypeId2].source,
      sourceNullability: "resolved",
      dependencies: expression[TypeId2].dependencies
    }, {
      kind: "count",
      value: expression
    });
  };
  const exists = (plan) => {
    const dependencies = Object.fromEntries(currentRequiredList(plan[TypeId].required).map((name2) => [name2, true]));
    return makeExpression({
      runtime: true,
      dbType: profile.boolDb,
      nullability: "never",
      dialect: profile.dialect,
      aggregation: "scalar",
      source: undefined,
      sourceNullability: "resolved",
      dependencies
    }, {
      kind: "exists",
      plan
    });
  };
  const scalar = (plan) => {
    const dependencies = Object.fromEntries(currentRequiredList(plan[TypeId].required).map((name2) => [name2, true]));
    const expression = extractSingleSelectedExpressionRuntime(plan[TypeId].selection);
    return makeExpression({
      runtime: undefined,
      dbType: expression[TypeId2].dbType,
      nullability: "maybe",
      dialect: profile.dialect,
      aggregation: "scalar",
      source: undefined,
      sourceNullability: "resolved",
      dependencies
    }, {
      kind: "scalarSubquery",
      plan
    });
  };
  const inSubquery = (left, plan) => {
    const leftExpression = toDialectExpression(left);
    const dependencies = Object.fromEntries(currentRequiredList(plan[TypeId].required).map((name2) => [name2, true]));
    return makeExpression({
      runtime: true,
      dbType: profile.boolDb,
      nullability: "maybe",
      dialect: leftExpression[TypeId2].dialect ?? profile.dialect,
      aggregation: leftExpression[TypeId2].aggregation,
      source: leftExpression[TypeId2].source,
      sourceNullability: "propagate",
      dependencies: mergeDependencies(leftExpression[TypeId2].dependencies, dependencies)
    }, {
      kind: "inSubquery",
      left: leftExpression,
      plan
    });
  };
  const quantifiedComparison = (left, plan, operator, quantifier) => {
    const leftExpression = toDialectExpression(left);
    const dependencies = Object.fromEntries(currentRequiredList(plan[TypeId].required).map((name2) => [name2, true]));
    return makeExpression({
      runtime: true,
      dbType: profile.boolDb,
      nullability: "maybe",
      dialect: leftExpression[TypeId2].dialect ?? profile.dialect,
      aggregation: leftExpression[TypeId2].aggregation,
      source: leftExpression[TypeId2].source,
      sourceNullability: "propagate",
      dependencies: mergeDependencies(leftExpression[TypeId2].dependencies, dependencies)
    }, renderQuantifiedComparisonAst(leftExpression, plan, operator, quantifier));
  };
  const compareAny = (left, plan, operator) => quantifiedComparison(left, plan, operator, "any");
  const compareAll = (left, plan, operator) => quantifiedComparison(left, plan, operator, "all");
  const over = (value, spec = {}) => {
    const normalized = normalizeWindowSpec(spec);
    const expressions = mergeWindowExpressions(value, normalized.partitionBy, normalized.orderBy);
    return makeExpression({
      runtime: undefined,
      dbType: value[TypeId2].dbType,
      nullability: value[TypeId2].nullability,
      dialect: expressions.find((expression) => expression[TypeId2].dialect !== undefined)?.[TypeId2].dialect ?? profile.dialect,
      aggregation: "window",
      source: mergeManySources(expressions),
      sourceNullability: "resolved",
      dependencies: mergeManyDependencies(expressions)
    }, {
      kind: "window",
      function: "over",
      value,
      partitionBy: normalized.partitionBy,
      orderBy: normalized.orderBy
    });
  };
  const buildNumberWindow = (kind, spec) => {
    const normalized = normalizeWindowSpec(spec);
    const expressions = mergeWindowExpressions(undefined, normalized.partitionBy, normalized.orderBy);
    return makeExpression({
      runtime: 0,
      dbType: profile.numericDb,
      nullability: "never",
      dialect: expressions.find((expression) => expression[TypeId2].dialect !== undefined)?.[TypeId2].dialect ?? profile.dialect,
      aggregation: "window",
      source: mergeManySources(expressions),
      sourceNullability: "resolved",
      dependencies: mergeManyDependencies(expressions)
    }, {
      kind: "window",
      function: kind,
      partitionBy: normalized.partitionBy,
      orderBy: normalized.orderBy
    });
  };
  const rowNumber = (spec) => buildNumberWindow("rowNumber", spec);
  const rank = (spec) => buildNumberWindow("rank", spec);
  const denseRank = (spec) => buildNumberWindow("denseRank", spec);
  const max = (value) => makeExpression({
    runtime: undefined,
    dbType: value[TypeId2].dbType,
    nullability: "maybe",
    dialect: value[TypeId2].dialect,
    aggregation: "aggregate",
    source: value[TypeId2].source,
    sourceNullability: "resolved",
    dependencies: value[TypeId2].dependencies
  }, {
    kind: "max",
    value
  });
  const min = (value) => makeExpression({
    runtime: undefined,
    dbType: value[TypeId2].dbType,
    nullability: "maybe",
    dialect: value[TypeId2].dialect,
    aggregation: "aggregate",
    source: value[TypeId2].source,
    sourceNullability: "resolved",
    dependencies: value[TypeId2].dependencies
  }, {
    kind: "min",
    value
  });
  const resolveCoalesceNullabilityRuntime = (values2) => values2.some((value) => value[TypeId2].nullability === "never") ? "never" : values2.some((value) => value[TypeId2].nullability === "maybe") ? "maybe" : "always";
  const coalesce = (...values2) => {
    const expressions = values2.map((value) => toDialectExpression(value));
    const representative = expressions.find((value) => value[TypeId2].nullability !== "always") ?? expressions[0];
    return makeExpression({
      runtime: undefined,
      dbType: representative[TypeId2].dbType,
      nullability: resolveCoalesceNullabilityRuntime(expressions),
      dialect: expressions.find((value) => value[TypeId2].dialect !== undefined)?.[TypeId2].dialect ?? profile.dialect,
      aggregation: mergeAggregationManyRuntime(expressions),
      source: mergeManySources(expressions),
      sourceNullability: "resolved",
      dependencies: mergeManyDependencies(expressions)
    }, {
      kind: "coalesce",
      values: expressions
    });
  };
  const call = (name2, ...args) => {
    const expressions = args.map((value) => toDialectExpression(value));
    return makeExpression({
      runtime: undefined,
      dbType: profile.textDb,
      nullability: "maybe",
      dialect: expressions.find((value) => value[TypeId2].dialect !== undefined)?.[TypeId2].dialect ?? profile.dialect,
      aggregation: mergeAggregationManyRuntime(expressions),
      source: mergeManySources(expressions),
      sourceNullability: "resolved",
      dependencies: mergeManyDependencies(expressions)
    }, {
      kind: "function",
      name: name2,
      args: expressions
    });
  };
  const uuidGenerateV4 = () => makeExpression({
    runtime: undefined,
    dbType: { dialect: "postgres", kind: "uuid" },
    nullability: "never",
    dialect: profile.dialect,
    aggregation: "scalar",
    source: undefined,
    sourceNullability: "resolved",
    dependencies: {}
  }, {
    kind: "function",
    name: "uuid_generate_v4",
    args: []
  });
  const nextVal = (value) => makeExpression({
    runtime: undefined,
    dbType: { dialect: "postgres", kind: "int8" },
    nullability: "never",
    dialect: profile.dialect,
    aggregation: "scalar",
    source: undefined,
    sourceNullability: "resolved",
    dependencies: {}
  }, {
    kind: "function",
    name: "nextval",
    args: [toDialectExpression(value)]
  });
  const resolveCaseNullabilityRuntime = (values2) => {
    let sawNever = false;
    let sawMaybe = false;
    let sawAlways = false;
    for (const value of values2) {
      switch (value[TypeId2].nullability) {
        case "never":
          sawNever = true;
          break;
        case "maybe":
          sawMaybe = true;
          break;
        case "always":
          sawAlways = true;
          break;
      }
    }
    return sawNever ? sawMaybe || sawAlways ? "maybe" : "never" : sawMaybe ? "maybe" : "always";
  };
  const finalizeCase = (branches, fallback) => {
    const resultExpressions = [...branches.map((branch) => branch.then), fallback];
    const allExpressions = [...branches.flatMap((branch) => [branch.when, branch.then]), fallback];
    const representative = resultExpressions.find((value) => value[TypeId2].nullability !== "always") ?? fallback;
    return makeExpression({
      runtime: undefined,
      dbType: representative[TypeId2].dbType,
      nullability: resolveCaseNullabilityRuntime(resultExpressions),
      dialect: allExpressions.find((value) => value[TypeId2].dialect !== undefined)?.[TypeId2].dialect ?? profile.dialect,
      aggregation: mergeAggregationManyRuntime(allExpressions),
      source: mergeManySources(allExpressions),
      sourceNullability: "resolved",
      dependencies: mergeManyDependencies(allExpressions)
    }, {
      kind: "case",
      branches: branches.map((branch) => ({
        when: branch.when,
        then: branch.then
      })),
      else: fallback
    });
  };
  const case_ = () => {
    const build = (branches) => ({
      when(predicate, result) {
        return build([
          ...branches,
          {
            when: toDialectExpression(predicate),
            then: toDialectExpression(result)
          }
        ]);
      },
      else(fallback) {
        return finalizeCase(branches, toDialectExpression(fallback));
      }
    });
    return {
      when(predicate, result) {
        return build([{
          when: toDialectExpression(predicate),
          then: toDialectExpression(result)
        }]);
      }
    };
  };
  const match = (value) => {
    const subject = toDialectExpression(value);
    const build = (branches) => ({
      when(compare, result) {
        return build([
          ...branches,
          {
            when: buildBinaryPredicate(subject, compare, "eq"),
            then: toDialectExpression(result)
          }
        ]);
      },
      else(fallback) {
        return finalizeCase(branches, toDialectExpression(fallback));
      }
    });
    return {
      when(compare, result) {
        const predicate = buildBinaryPredicate(subject, compare, "eq");
        return build([{
          when: predicate,
          then: toDialectExpression(result)
        }]);
      }
    };
  };
  const excluded = (value) => {
    const ast = value[TypeId3];
    if (ast.kind !== "column") {
      throw new Error("excluded(...) only accepts bound table columns");
    }
    return makeExpression({
      runtime: undefined,
      dbType: value[TypeId2].dbType,
      runtimeSchema: value[TypeId2].runtimeSchema,
      nullability: value[TypeId2].nullability,
      dialect: profile.dialect,
      aggregation: "scalar",
      source: undefined,
      sourceNullability: "resolved",
      dependencies: {}
    }, {
      kind: "excluded",
      columnName: ast.columnName
    });
  };
  const toMutationValueExpression = (value, column2) => {
    if (value !== null && typeof value === "object" && TypeId2 in value) {
      return value;
    }
    return makeExpression({
      runtime: value,
      dbType: column2[TypeId2].dbType,
      nullability: value === null ? "always" : "never",
      dialect: column2[TypeId2].dialect,
      aggregation: "scalar",
      source: undefined,
      sourceNullability: "propagate",
      dependencies: {}
    }, {
      kind: "literal",
      value
    });
  };
  const renderQuantifiedComparisonAst = (left, plan, operator, quantifier) => ({
    kind: quantifier === "any" ? "comparisonAny" : "comparisonAll",
    operator,
    left,
    plan
  });
  const renderComparisonOperator = (operator) => operator === "eq" ? "=" : operator === "neq" ? "<>" : operator === "lt" ? "<" : operator === "lte" ? "<=" : operator === "gt" ? ">" : ">=";
  const targetSourceDetails = (table) => {
    const sourceName = table[TypeId4].name;
    const sourceBaseName = table[TypeId4].baseName;
    return {
      sourceName,
      sourceBaseName
    };
  };
  const sourceDetails = (source) => {
    if (TypeId4 in source) {
      return targetSourceDetails(source);
    }
    const record2 = source;
    return {
      sourceName: record2.name,
      sourceBaseName: record2.baseName
    };
  };
  const makeColumnReferenceSelection = (alias2, selection) => {
    const columns = {};
    for (const [columnName, expression] of Object.entries(selection)) {
      const state = expression[TypeId2];
      columns[columnName] = makeExpression({
        runtime: undefined,
        dbType: state.dbType,
        runtimeSchema: state.runtimeSchema,
        nullability: state.nullability,
        dialect: state.dialect,
        aggregation: "scalar",
        source: {
          tableName: alias2,
          columnName,
          baseTableName: alias2
        },
        sourceNullability: "propagate",
        dependencies: {
          [alias2]: true
        }
      }, {
        kind: "column",
        tableName: alias2,
        columnName
      });
    }
    return columns;
  };
  const makeAliasedValuesSource = (rows, selection, alias2) => {
    const columns = makeColumnReferenceSelection(alias2, selection);
    const source = {
      kind: "values",
      name: alias2,
      baseName: alias2,
      dialect: profile.dialect,
      rows,
      columns
    };
    return Object.assign(source, columns);
  };
  const normalizeValuesRow = (row) => Object.fromEntries(Object.entries(row).map(([key2, value]) => [key2, toDialectExpression(value)]));
  const normalizeUnnestColumns = (columns) => Object.fromEntries(Object.entries(columns).map(([key2, values2]) => [key2, values2.map((value) => toDialectExpression(value))]));
  const normalizeMutationTargets = (target) => Array.isArray(target) ? target : [target];
  const mutationTargetClauses = (target) => normalizeMutationTargets(target).map((table) => {
    const { sourceName, sourceBaseName } = targetSourceDetails(table);
    return {
      kind: "from",
      tableName: sourceName,
      baseTableName: sourceBaseName,
      source: table
    };
  });
  const mutationAvailableSources = (target, mode = "required") => Object.fromEntries(normalizeMutationTargets(target).map((table) => {
    const { sourceName, sourceBaseName } = targetSourceDetails(table);
    return [
      sourceName,
      {
        name: sourceName,
        mode,
        baseName: sourceBaseName
      }
    ];
  }));
  const buildMutationAssignments = (target, values2) => {
    const targets = normalizeMutationTargets(target);
    if (targets.length === 1 && !Array.isArray(target)) {
      const columns = target;
      return Object.entries(values2).map(([columnName, value]) => ({
        columnName,
        value: toMutationValueExpression(value, columns[columnName])
      }));
    }
    const valueMap = values2;
    return targets.flatMap((table) => {
      const targetName = table[TypeId4].name;
      const scopedValues = valueMap[targetName] ?? {};
      const columns = table;
      return Object.entries(scopedValues).map(([columnName, value]) => ({
        tableName: targetName,
        columnName,
        value: toMutationValueExpression(value, columns[columnName])
      }));
    });
  };
  const buildInsertValuesRows = (target, rows) => {
    const firstRow = rows[0];
    const firstColumns = Object.keys(firstRow);
    if (firstColumns.length === 0) {
      throw new Error("values(...) rows must specify at least one column; use insert(target) for default-only inserts instead");
    }
    const columns = firstColumns;
    const normalizedRows = rows.map((row) => {
      const rowKeys = Object.keys(row);
      if (rowKeys.length !== columns.length || columns.some((column2) => !(column2 in row))) {
        throw new Error("All values(...) rows must project the same columns in the same shape");
      }
      const assignments = buildMutationAssignments(target, row);
      return {
        values: columns.map((columnName) => assignments.find((assignment) => assignment.columnName === columnName))
      };
    });
    const required = normalizedRows.flatMap((row) => row.values.flatMap((entry) => Object.keys(entry.value[TypeId2].dependencies)));
    return {
      columns,
      rows: normalizedRows,
      required: required.filter((name2, index3, list) => list.indexOf(name2) === index3)
    };
  };
  const normalizeInsertSelectColumns = (selection) => {
    const columns = Object.keys(selection);
    if (columns.length === 0) {
      throw new Error("insert(...).pipe(from(subquery)) requires at least one projected column");
    }
    return columns;
  };
  const normalizeInsertUnnestValues = (target, values2) => {
    const entries = Object.entries(values2);
    if (entries.length === 0) {
      throw new Error("unnest(...) requires at least one column array");
    }
    const columns = entries.map(([columnName]) => columnName);
    const normalized = entries.map(([columnName, items]) => {
      if (!Array.isArray(items)) {
        throw new Error("unnest(...) expects every value to be an array");
      }
      return {
        columnName,
        values: items
      };
    });
    const expectedLength = normalized[0].values.length;
    if (normalized.some((entry) => entry.values.length !== expectedLength)) {
      throw new Error("unnest(...) expects every column array to have the same length");
    }
    const knownColumns = new Set(Object.keys(target[TypeId4].fields));
    if (columns.some((columnName) => !knownColumns.has(columnName))) {
      throw new Error("unnest(...) received a column that does not exist on the target table");
    }
    return {
      columns,
      values: normalized
    };
  };
  const buildConflictTarget = (target, input) => {
    if (Array.isArray(input)) {
      return {
        kind: "columns",
        columns: normalizeColumnList(input)
      };
    }
    if (!Array.isArray(input) && "constraint" in input) {
      return {
        kind: "constraint",
        name: input.constraint
      };
    }
    const columnTarget = input;
    return {
      kind: "columns",
      columns: normalizeColumnList(columnTarget.columns),
      where: columnTarget.where === undefined ? undefined : toDialectExpression(columnTarget.where)
    };
  };
  const defaultIndexName = (tableName, columns, unique3) => `${tableName}_${columns.join("_")}_${unique3 ? "uniq" : "idx"}`;
  function as(valueOrAlias, alias2) {
    if (alias2 === undefined) {
      return (value2) => as(value2, valueOrAlias);
    }
    const resolvedAlias = alias2;
    const value = valueOrAlias;
    if (typeof value !== "object" || value === null || TypeId2 in value) {
      const expression = toDialectExpression(value);
      const projected = Object.create(Object.getPrototypeOf(expression));
      const runtimeExpression = expression;
      projected[TypeId2] = runtimeExpression[TypeId2];
      projected[TypeId3] = runtimeExpression[TypeId3];
      if ("schema" in runtimeExpression) {
        projected.schema = runtimeExpression.schema;
      }
      projected[TypeId8] = {
        alias: resolvedAlias
      };
      return projected;
    }
    if ("kind" in value && value.kind === "values" && !("name" in value)) {
      const valuesInput = value;
      return makeAliasedValuesSource(valuesInput.rows, valuesInput.selection, resolvedAlias);
    }
    return makeDerivedSource(value, resolvedAlias);
  }
  function with_(valueOrAlias, alias2) {
    if (alias2 === undefined) {
      return (value) => with_(value, valueOrAlias);
    }
    return makeCteSource(valueOrAlias, alias2);
  }
  function withRecursive_(valueOrAlias, alias2) {
    if (alias2 === undefined) {
      return (value) => withRecursive_(value, valueOrAlias);
    }
    return makeCteSource(valueOrAlias, alias2, true);
  }
  function lateral(valueOrAlias, alias2) {
    if (alias2 === undefined) {
      return (value) => lateral(value, valueOrAlias);
    }
    return makeLateralSource(valueOrAlias, alias2);
  }
  const values = (rows) => {
    if (rows.length === 0) {
      throw new Error("values(...) requires at least one row");
    }
    const normalizedRows = rows.map((row) => normalizeValuesRow(row));
    const columnNames = Object.keys(normalizedRows[0]);
    for (const row of normalizedRows) {
      const rowKeys = Object.keys(row);
      if (rowKeys.length !== columnNames.length || !rowKeys.every((key2, index3) => key2 === columnNames[index3])) {
        throw new Error("values(...) rows must project the same columns in the same order");
      }
    }
    return Object.assign(Object.create(ValuesInputProto), {
      kind: "values",
      dialect: profile.dialect,
      rows: normalizedRows,
      selection: normalizedRows[0]
    });
  };
  const unnest = (columns, alias2) => {
    const normalizedColumns = normalizeUnnestColumns(columns);
    const columnNames = Object.keys(normalizedColumns);
    if (columnNames.length === 0) {
      throw new Error("unnest(...) requires at least one column array");
    }
    const firstColumn = normalizedColumns[columnNames[0]];
    const rowCount = firstColumn?.length ?? 0;
    if (rowCount === 0) {
      throw new Error("unnest(...) requires at least one row");
    }
    for (const columnName of columnNames) {
      const values2 = normalizedColumns[columnName];
      if (values2.length !== rowCount) {
        throw new Error("unnest(...) column arrays must have the same length");
      }
    }
    const firstRow = Object.fromEntries(columnNames.map((columnName) => [columnName, normalizedColumns[columnName][0]]));
    const columnsSelection = makeColumnReferenceSelection(alias2, firstRow);
    const source = {
      kind: "unnest",
      name: alias2,
      baseName: alias2,
      dialect: profile.dialect,
      values: columns,
      arrays: normalizedColumns,
      columns: columnsSelection
    };
    return Object.assign(source, columnsSelection);
  };
  const generateSeries = (start, stop, step, alias2 = "series") => {
    const startExpression = toDialectNumericExpression(start);
    const stopExpression = toDialectNumericExpression(stop);
    const stepExpression = step === undefined ? undefined : toDialectNumericExpression(step);
    const valueSelection = {
      value: startExpression
    };
    const columns = makeColumnReferenceSelection(alias2, valueSelection);
    const source = {
      kind: "tableFunction",
      name: alias2,
      baseName: alias2,
      dialect: profile.dialect,
      functionName: "generate_series",
      args: stepExpression === undefined ? [startExpression, stopExpression] : [startExpression, stopExpression, stepExpression],
      columns
    };
    return Object.assign(source, columns);
  };
  const select = (selection) => makePlan({
    selection,
    required: extractRequiredRuntime(selection),
    available: {},
    dialect: profile.dialect
  }, {
    kind: "select",
    select: selection,
    where: [],
    having: [],
    joins: [],
    groupBy: [],
    orderBy: []
  }, undefined, "read", "select");
  const buildSetOperation = (kind, all, left, right) => {
    const leftState = left[TypeId];
    const leftAst = getAst(left);
    const basePlan = leftAst.kind === "set" ? leftAst.setBase ?? left : left;
    const leftOperations = leftAst.kind === "set" ? [...leftAst.setOperations ?? []] : [];
    return makePlan({
      selection: leftState.selection,
      required: undefined,
      available: {},
      dialect: leftState.dialect ?? right[TypeId].dialect
    }, {
      kind: "set",
      select: leftState.selection,
      where: [],
      having: [],
      joins: [],
      groupBy: [],
      orderBy: [],
      setBase: basePlan,
      setOperations: [
        ...leftOperations,
        {
          kind,
          all,
          query: right
        }
      ]
    }, undefined, undefined, "set");
  };
  const union = (left, right) => buildSetOperation("union", false, left, right);
  const unionAll = (left, right) => buildSetOperation("union", true, left, right);
  const intersect = (left, right) => buildSetOperation("intersect", false, left, right);
  const intersectAll = (left, right) => buildSetOperation("intersect", true, left, right);
  const except = (left, right) => buildSetOperation("except", false, left, right);
  const exceptAll = (left, right) => buildSetOperation("except", true, left, right);
  const where = (predicate) => (plan) => {
    const current = plan[TypeId];
    const currentAst = getAst(plan);
    const currentQuery = getQueryState(plan);
    const predicateExpression = toDialectExpression(predicate);
    const predicateRequired = extractRequiredFromDialectInputRuntime(predicate);
    return makePlan({
      selection: current.selection,
      required: [...currentRequiredList(current.required), ...predicateRequired].filter((name2, index3, values2) => !(name2 in current.available) && values2.indexOf(name2) === index3),
      available: current.available,
      dialect: current.dialect
    }, {
      ...currentAst,
      where: [...currentAst.where, {
        kind: "where",
        predicate: predicateExpression
      }]
    }, undefined, currentQuery.capabilities, currentQuery.statement);
  };
  const from = (source) => (plan) => {
    const current = plan[TypeId];
    const currentAst = getAst(plan);
    const currentQuery = getQueryState(plan);
    if (currentQuery.statement === "insert") {
      return attachInsertSource(plan, source);
    }
    if (typeof source !== "object" || source === null || "kind" in source && source.kind === "values" && !("name" in source) || !(TypeId4 in source) && !(("name" in source) && ("baseName" in source))) {
      throw new Error("from(...) requires an aliased source in select/update statements");
    }
    const sourceLike = source;
    const { sourceName, sourceBaseName } = sourceDetails(sourceLike);
    if (currentQuery.statement === "select") {
      const nextAst = {
        ...currentAst,
        from: {
          kind: "from",
          tableName: sourceName,
          baseTableName: sourceBaseName,
          source: sourceLike
        }
      };
      return makePlan({
        selection: current.selection,
        required: currentRequiredList(current.required).filter((name2) => name2 !== sourceName),
        available: {
          [sourceName]: {
            name: sourceName,
            mode: "required",
            baseName: sourceBaseName
          }
        },
        dialect: current.dialect
      }, nextAst, currentQuery.assumptions, currentQuery.capabilities, currentQuery.statement);
    }
    if (currentQuery.statement === "update") {
      const nextAvailable = {
        ...current.available,
        [sourceName]: {
          name: sourceName,
          mode: "required",
          baseName: sourceBaseName
        }
      };
      const nextAst = {
        ...currentAst,
        fromSources: [
          ...currentAst.fromSources ?? [],
          {
            kind: "from",
            tableName: sourceName,
            baseTableName: sourceBaseName,
            source: sourceLike
          }
        ]
      };
      return makePlan({
        selection: current.selection,
        required: currentRequiredList(current.required).filter((name2) => !(name2 in nextAvailable)),
        available: nextAvailable,
        dialect: current.dialect
      }, nextAst, currentQuery.assumptions, currentQuery.capabilities, currentQuery.statement);
    }
    throw new Error(`from(...) is not supported for ${currentQuery.statement} statements`);
  };
  const having = (predicate) => (plan) => {
    const current = plan[TypeId];
    const currentAst = getAst(plan);
    const currentQuery = getQueryState(plan);
    const predicateExpression = toDialectExpression(predicate);
    const predicateRequired = extractRequiredFromDialectInputRuntime(predicate);
    return makePlan({
      selection: current.selection,
      required: [...currentRequiredList(current.required), ...predicateRequired].filter((name2, index3, values2) => !(name2 in current.available) && values2.indexOf(name2) === index3),
      available: current.available,
      dialect: current.dialect
    }, {
      ...currentAst,
      having: [...currentAst.having, {
        kind: "having",
        predicate: predicateExpression
      }]
    }, currentQuery.assumptions, currentQuery.capabilities, currentQuery.statement);
  };
  const innerJoin = (table, on) => join("inner", table, on);
  const leftJoin = (table, on) => join("left", table, on);
  const rightJoin = (table, on) => join("right", table, on);
  const fullJoin = (table, on) => join("full", table, on);
  const crossJoin = (table) => (plan) => {
    const current = plan[TypeId];
    const currentAst = getAst(plan);
    const currentQuery = getQueryState(plan);
    const { sourceName, sourceBaseName } = sourceDetails(table);
    const nextAvailable = Object.assign({}, current.available, {
      [sourceName]: {
        name: sourceName,
        mode: "required",
        baseName: sourceBaseName
      }
    });
    return makePlan({
      selection: current.selection,
      required: currentRequiredList(current.required).filter((name2) => !(name2 in nextAvailable)),
      available: nextAvailable,
      dialect: current.dialect
    }, {
      ...currentAst,
      joins: [...currentAst.joins, {
        kind: "cross",
        tableName: sourceName,
        baseTableName: sourceBaseName,
        source: table
      }]
    }, currentQuery.assumptions, currentQuery.capabilities, currentQuery.statement);
  };
  const join = (kind, table, on) => (plan) => {
    const current = plan[TypeId];
    const currentAst = getAst(plan);
    const currentQuery = getQueryState(plan);
    const onExpression = toDialectExpression(on);
    const { sourceName, sourceBaseName } = sourceDetails(table);
    const baseAvailable = kind === "right" || kind === "full" ? Object.fromEntries(Object.entries(current.available).map(([name2, source]) => [name2, {
      name: source.name,
      mode: "optional",
      baseName: source.baseName
    }])) : current.available;
    const nextAvailable = {
      ...baseAvailable,
      [sourceName]: {
        name: sourceName,
        mode: kind === "left" || kind === "full" ? "optional" : "required",
        baseName: sourceBaseName
      }
    };
    return makePlan({
      selection: current.selection,
      required: [...currentRequiredList(current.required), ...extractRequiredFromDialectInputRuntime(on)].filter((name2, index3, values2) => !(name2 in nextAvailable) && values2.indexOf(name2) === index3),
      available: nextAvailable,
      dialect: current.dialect
    }, {
      ...currentAst,
      joins: [...currentAst.joins, {
        kind,
        tableName: sourceName,
        baseTableName: sourceBaseName,
        source: table,
        on: onExpression
      }]
    }, currentQuery.assumptions, currentQuery.capabilities, currentQuery.statement);
  };
  const orderBy = (value, direction = "asc") => (plan) => {
    const current = plan[TypeId];
    const currentAst = getAst(plan);
    const currentQuery = getQueryState(plan);
    const expression = toDialectExpression(value);
    const required = extractRequiredFromDialectInputRuntime(value);
    return makePlan({
      selection: current.selection,
      required: [...currentRequiredList(current.required), ...required].filter((name2, index3, values2) => !(name2 in current.available) && values2.indexOf(name2) === index3),
      available: current.available,
      dialect: current.dialect
    }, {
      ...currentAst,
      orderBy: [...currentAst.orderBy, {
        kind: "orderBy",
        value: expression,
        direction
      }]
    }, currentQuery.assumptions, currentQuery.capabilities, currentQuery.statement);
  };
  function lock(mode, options2 = {}) {
    return (plan) => {
      const current = plan[TypeId];
      const currentAst = getAst(plan);
      const currentQuery = getQueryState(plan);
      return makePlan({
        selection: current.selection,
        required: current.required,
        available: current.available,
        dialect: current.dialect
      }, {
        ...currentAst,
        lock: {
          kind: "lock",
          mode,
          nowait: options2.nowait ?? false,
          skipLocked: options2.skipLocked ?? false
        }
      }, currentQuery.assumptions, currentQuery.capabilities, currentQuery.statement);
    };
  }
  const distinct = () => (plan) => {
    const current = plan[TypeId];
    const currentAst = getAst(plan);
    const currentQuery = getQueryState(plan);
    return makePlan({
      selection: current.selection,
      required: current.required,
      available: current.available,
      dialect: current.dialect
    }, {
      ...currentAst,
      distinct: true
    }, currentQuery.assumptions, currentQuery.capabilities, currentQuery.statement);
  };
  const distinctOn = (...values2) => {
    const expressions = values2.map((value) => toDialectExpression(value));
    if (profile.dialect !== "postgres") {
      return {
        __effect_qb_error__: "effect-qb: distinctOn(...) is only supported by the postgres dialect",
        __effect_qb_dialect__: profile.dialect,
        __effect_qb_hint__: "Use postgres.Query.distinctOn(...) or regular distinct()/grouping logic"
      };
    }
    return (plan) => {
      const current = plan[TypeId];
      const currentAst = getAst(plan);
      const currentQuery = getQueryState(plan);
      return makePlan({
        selection: current.selection,
        required: current.required,
        available: current.available,
        dialect: current.dialect
      }, {
        ...currentAst,
        distinct: true,
        distinctOn: expressions
      }, currentQuery.assumptions, currentQuery.capabilities, currentQuery.statement);
    };
  };
  const limit = (value) => (plan) => {
    const current = plan[TypeId];
    const currentAst = getAst(plan);
    const currentQuery = getQueryState(plan);
    const expression = toDialectNumericExpression(value);
    const required = extractRequiredFromDialectNumericInputRuntime(value);
    return makePlan({
      selection: current.selection,
      required: [...currentRequiredList(current.required), ...required].filter((name2, index3, values2) => !(name2 in current.available) && values2.indexOf(name2) === index3),
      available: current.available,
      dialect: current.dialect
    }, {
      ...currentAst,
      limit: expression
    }, currentQuery.assumptions, currentQuery.capabilities, currentQuery.statement);
  };
  const offset = (value) => (plan) => {
    const current = plan[TypeId];
    const currentAst = getAst(plan);
    const currentQuery = getQueryState(plan);
    const expression = toDialectNumericExpression(value);
    const required = extractRequiredFromDialectNumericInputRuntime(value);
    return makePlan({
      selection: current.selection,
      required: [...currentRequiredList(current.required), ...required].filter((name2, index3, values2) => !(name2 in current.available) && values2.indexOf(name2) === index3),
      available: current.available,
      dialect: current.dialect
    }, {
      ...currentAst,
      offset: expression
    }, currentQuery.assumptions, currentQuery.capabilities, currentQuery.statement);
  };
  const groupBy = (...values2) => (plan) => {
    const current = plan[TypeId];
    const currentAst = getAst(plan);
    const currentQuery = getQueryState(plan);
    const required = [...values2.flatMap((value) => Object.keys(value[TypeId2].dependencies))].filter((name2, index3, list) => !(name2 in current.available) && list.indexOf(name2) === index3);
    return makePlan({
      selection: current.selection,
      required: [...currentRequiredList(current.required), ...required].filter((name2, index3, list) => !(name2 in current.available) && list.indexOf(name2) === index3),
      available: current.available,
      dialect: current.dialect
    }, {
      ...currentAst,
      groupBy: dedupeGroupedExpressions([...currentAst.groupBy, ...values2])
    }, currentQuery.assumptions, currentQuery.capabilities, currentQuery.statement);
  };
  const returning = (selection) => (plan) => {
    const current = plan[TypeId];
    const currentAst = getAst(plan);
    const currentQuery = getQueryState(plan);
    return makePlan({
      selection,
      required: [...currentRequiredList(current.required), ...extractRequiredRuntime(selection)].filter((name2, index3, list) => !(name2 in current.available) && list.indexOf(name2) === index3),
      available: current.available,
      dialect: current.dialect
    }, {
      ...currentAst,
      select: selection
    }, currentQuery.assumptions, currentQuery.capabilities, currentQuery.statement, currentQuery.target, currentQuery.insertSource);
  };
  function insert(target, values2) {
    const { sourceName, sourceBaseName } = targetSourceDetails(target);
    const assignments = values2 === undefined ? [] : buildMutationAssignments(target, values2);
    const required = assignments.flatMap((entry) => Object.keys(entry.value[TypeId2].dependencies));
    const insertState = values2 === undefined ? "missing" : "ready";
    return makePlan({
      selection: {},
      required: required.filter((name2, index3, list) => name2 !== sourceName && list.indexOf(name2) === index3),
      available: {
        [sourceName]: {
          name: sourceName,
          mode: "required",
          baseName: sourceBaseName
        }
      },
      dialect: target[TypeId].dialect
    }, {
      kind: "insert",
      select: {},
      into: {
        kind: "from",
        tableName: sourceName,
        baseTableName: sourceBaseName,
        source: target
      },
      values: assignments,
      conflict: undefined,
      where: [],
      having: [],
      joins: [],
      groupBy: [],
      orderBy: []
    }, undefined, "write", "insert", target, insertState);
  }
  const attachInsertSource = (plan, source) => {
    const current = plan[TypeId];
    const currentAst = getAst(plan);
    const currentQuery = getQueryState(plan);
    const target = currentQuery.target;
    const targetSource = currentAst.into;
    const sourceName = targetSource.tableName;
    if (typeof source === "object" && source !== null && "kind" in source && source.kind === "values") {
      const valuesSource = source;
      const normalized = buildInsertValuesRows(target, valuesSource.rows);
      return makePlan({
        selection: current.selection,
        required: normalized.required.filter((name2) => name2 !== sourceName),
        available: current.available,
        dialect: current.dialect
      }, {
        ...currentAst,
        values: [],
        insertSource: {
          kind: "values",
          columns: normalized.columns,
          rows: normalized.rows
        }
      }, currentQuery.assumptions, currentQuery.capabilities, currentQuery.statement, currentQuery.target, "ready");
    }
    if (typeof source === "object" && source !== null && "kind" in source && source.kind === "unnest") {
      const unnestSource = source;
      const normalized = normalizeInsertUnnestValues(target, unnestSource.values);
      return makePlan({
        selection: current.selection,
        required: [],
        available: current.available,
        dialect: current.dialect
      }, {
        ...currentAst,
        values: [],
        insertSource: {
          kind: "unnest",
          columns: normalized.columns,
          values: normalized.values
        }
      }, currentQuery.assumptions, currentQuery.capabilities, currentQuery.statement, currentQuery.target, "ready");
    }
    const sourcePlan = source;
    const selection = sourcePlan[TypeId].selection;
    const columns = normalizeInsertSelectColumns(selection);
    return makePlan({
      selection: current.selection,
      required: currentRequiredList(sourcePlan[TypeId].required).filter((name2) => name2 !== sourceName),
      available: current.available,
      dialect: current.dialect
    }, {
      ...currentAst,
      values: [],
      insertSource: {
        kind: "query",
        columns,
        query: sourcePlan
      }
    }, currentQuery.assumptions, currentQuery.capabilities, currentQuery.statement, currentQuery.target, "ready");
  };
  const onConflict = (target, options2 = {}) => (plan) => {
    const current = plan[TypeId];
    const currentAst = getAst(plan);
    const currentQuery = getQueryState(plan);
    const insertTarget = currentAst.into.source;
    const conflictTarget = buildConflictTarget(insertTarget, target);
    const updateAssignments = options2.update ? buildMutationAssignments(insertTarget, options2.update) : [];
    const updateWhere = options2.where === undefined ? undefined : toDialectExpression(options2.where);
    const required = [
      ...currentRequiredList(current.required),
      ...updateAssignments.flatMap((entry) => Object.keys(entry.value[TypeId2].dependencies)),
      ...updateWhere ? Object.keys(updateWhere[TypeId2].dependencies) : []
    ].filter((name2, index3, list) => !(name2 in current.available) && list.indexOf(name2) === index3);
    return makePlan({
      selection: current.selection,
      required,
      available: current.available,
      dialect: current.dialect
    }, {
      ...currentAst,
      conflict: {
        kind: "conflict",
        target: conflictTarget,
        action: updateAssignments.length === 0 ? "doNothing" : "doUpdate",
        values: updateAssignments.length === 0 ? undefined : updateAssignments,
        where: updateWhere
      }
    }, currentQuery.assumptions, currentQuery.capabilities, currentQuery.statement, currentQuery.target, currentQuery.insertSource);
  };
  function update(target, values2) {
    const targets = mutationTargetClauses(target);
    const primaryTarget = targets[0];
    const assignments = buildMutationAssignments(target, values2);
    const targetNames = new Set(targets.map((entry) => entry.tableName));
    const required = assignments.flatMap((entry) => Object.keys(entry.value[TypeId2].dependencies)).filter((name2, index3, list) => !targetNames.has(name2) && list.indexOf(name2) === index3);
    return makePlan({
      selection: {},
      required,
      available: mutationAvailableSources(target),
      dialect: primaryTarget.source[TypeId].dialect
    }, {
      kind: "update",
      select: {},
      target: primaryTarget,
      targets,
      set: assignments,
      where: [],
      having: [],
      joins: [],
      groupBy: [],
      orderBy: []
    }, undefined, "write", "update");
  }
  const upsert = (target, values2, conflictColumns, updateValues) => {
    const { sourceName, sourceBaseName } = targetSourceDetails(target);
    const assignments = buildMutationAssignments(target, values2);
    const updateAssignments = updateValues ? buildMutationAssignments(target, updateValues) : [];
    const required = [
      ...assignments.flatMap((entry) => Object.keys(entry.value[TypeId2].dependencies)),
      ...updateAssignments.flatMap((entry) => Object.keys(entry.value[TypeId2].dependencies))
    ];
    return makePlan({
      selection: {},
      required: required.filter((name2, index3, list) => name2 !== sourceName && list.indexOf(name2) === index3),
      available: {
        [sourceName]: {
          name: sourceName,
          mode: "required",
          baseName: sourceBaseName
        }
      },
      dialect: target[TypeId].dialect
    }, {
      kind: "insert",
      select: {},
      into: {
        kind: "from",
        tableName: sourceName,
        baseTableName: sourceBaseName,
        source: target
      },
      values: assignments,
      conflict: {
        kind: "conflict",
        target: {
          kind: "columns",
          columns: normalizeColumnList(conflictColumns)
        },
        action: updateAssignments.length > 0 ? "doUpdate" : "doNothing",
        values: updateAssignments.length > 0 ? updateAssignments : undefined
      },
      where: [],
      having: [],
      joins: [],
      groupBy: [],
      orderBy: []
    }, undefined, "write", "insert", target, "ready");
  };
  function delete_(target) {
    const targets = mutationTargetClauses(target);
    const primaryTarget = targets[0];
    return makePlan({
      selection: {},
      required: [],
      available: mutationAvailableSources(target),
      dialect: primaryTarget.source[TypeId].dialect
    }, {
      kind: "delete",
      select: {},
      target: primaryTarget,
      targets,
      where: [],
      having: [],
      joins: [],
      groupBy: [],
      orderBy: []
    }, undefined, "write", "delete");
  }
  const truncate = (target, options2 = {}) => {
    const { sourceName, sourceBaseName } = targetSourceDetails(target);
    return makePlan({
      selection: {},
      required: [],
      available: {},
      dialect: target[TypeId].dialect
    }, {
      kind: "truncate",
      select: {},
      target: {
        kind: "from",
        tableName: sourceName,
        baseTableName: sourceBaseName,
        source: target
      },
      truncate: {
        kind: "truncate",
        restartIdentity: options2.restartIdentity ?? false,
        cascade: options2.cascade ?? false
      },
      where: [],
      having: [],
      joins: [],
      groupBy: [],
      orderBy: []
    }, undefined, "write", "truncate");
  };
  const merge = (target, source, on, options2 = {}) => {
    const { sourceName: targetName, sourceBaseName: targetBaseName } = targetSourceDetails(target);
    const { sourceName: usingName, sourceBaseName: usingBaseName } = sourceDetails(source);
    const onExpression = toDialectExpression(on);
    const matched = options2.whenMatched;
    const notMatched = options2.whenNotMatched;
    if (matched && "delete" in matched && "update" in matched) {
      throw new Error("merge whenMatched cannot specify both update and delete");
    }
    const matchedPredicate = matched?.predicate ? toDialectExpression(matched.predicate) : undefined;
    const matchedAssignments = matched && "update" in matched && matched.update ? buildMutationAssignments(target, matched.update) : [];
    const notMatchedPredicate = notMatched?.predicate ? toDialectExpression(notMatched.predicate) : undefined;
    const notMatchedAssignments = notMatched ? buildMutationAssignments(target, notMatched.values) : [];
    const required = [
      ...Object.keys(onExpression[TypeId2].dependencies),
      ...matchedAssignments.flatMap((entry) => Object.keys(entry.value[TypeId2].dependencies)),
      ...notMatchedAssignments.flatMap((entry) => Object.keys(entry.value[TypeId2].dependencies)),
      ...matchedPredicate ? Object.keys(matchedPredicate[TypeId2].dependencies) : [],
      ...notMatchedPredicate ? Object.keys(notMatchedPredicate[TypeId2].dependencies) : []
    ].filter((name2, index3, values2) => name2 !== targetName && name2 !== usingName && values2.indexOf(name2) === index3);
    return makePlan({
      selection: {},
      required,
      available: {
        [targetName]: {
          name: targetName,
          mode: "required",
          baseName: targetBaseName
        },
        [usingName]: {
          name: usingName,
          mode: "required",
          baseName: usingBaseName
        }
      },
      dialect: target[TypeId].dialect
    }, {
      kind: "merge",
      select: {},
      target: {
        kind: "from",
        tableName: targetName,
        baseTableName: targetBaseName,
        source: target
      },
      using: {
        kind: "from",
        tableName: usingName,
        baseTableName: usingBaseName,
        source
      },
      merge: {
        kind: "merge",
        on: onExpression,
        whenMatched: matched ? "delete" in matched && matched.delete ? {
          kind: "delete",
          predicate: matchedPredicate
        } : {
          kind: "update",
          values: matchedAssignments,
          predicate: matchedPredicate
        } : undefined,
        whenNotMatched: notMatched ? {
          kind: "insert",
          values: notMatchedAssignments,
          predicate: notMatchedPredicate
        } : undefined
      },
      where: [],
      having: [],
      joins: [],
      groupBy: [],
      orderBy: []
    }, undefined, "write", "merge");
  };
  const transaction = (options2 = {}) => makePlan({
    selection: {},
    required: [],
    available: {},
    dialect: profile.dialect
  }, {
    kind: "transaction",
    select: {},
    transaction: {
      kind: "transaction",
      isolationLevel: options2.isolationLevel,
      readOnly: options2.readOnly
    },
    where: [],
    having: [],
    joins: [],
    groupBy: [],
    orderBy: []
  }, undefined, "transaction", "transaction");
  const commit = () => makePlan({
    selection: {},
    required: [],
    available: {},
    dialect: profile.dialect
  }, {
    kind: "commit",
    select: {},
    transaction: {
      kind: "commit"
    },
    where: [],
    having: [],
    joins: [],
    groupBy: [],
    orderBy: []
  }, undefined, "transaction", "commit");
  const rollback = () => makePlan({
    selection: {},
    required: [],
    available: {},
    dialect: profile.dialect
  }, {
    kind: "rollback",
    select: {},
    transaction: {
      kind: "rollback"
    },
    where: [],
    having: [],
    joins: [],
    groupBy: [],
    orderBy: []
  }, undefined, "transaction", "rollback");
  const savepoint = (name2) => makePlan({
    selection: {},
    required: [],
    available: {},
    dialect: profile.dialect
  }, {
    kind: "savepoint",
    select: {},
    transaction: {
      kind: "savepoint",
      name: name2
    },
    where: [],
    having: [],
    joins: [],
    groupBy: [],
    orderBy: []
  }, undefined, "transaction", "savepoint");
  const rollbackTo = (name2) => makePlan({
    selection: {},
    required: [],
    available: {},
    dialect: profile.dialect
  }, {
    kind: "rollbackTo",
    select: {},
    transaction: {
      kind: "rollbackTo",
      name: name2
    },
    where: [],
    having: [],
    joins: [],
    groupBy: [],
    orderBy: []
  }, undefined, "transaction", "rollbackTo");
  const releaseSavepoint = (name2) => makePlan({
    selection: {},
    required: [],
    available: {},
    dialect: profile.dialect
  }, {
    kind: "releaseSavepoint",
    select: {},
    transaction: {
      kind: "releaseSavepoint",
      name: name2
    },
    where: [],
    having: [],
    joins: [],
    groupBy: [],
    orderBy: []
  }, undefined, "transaction", "releaseSavepoint");
  const createTable = (target, options2 = {}) => {
    const { sourceName, sourceBaseName } = targetSourceDetails(target);
    return makePlan({
      selection: {},
      required: [],
      available: {},
      dialect: target[TypeId].dialect
    }, {
      kind: "createTable",
      select: {},
      target: {
        kind: "from",
        tableName: sourceName,
        baseTableName: sourceBaseName,
        source: target
      },
      ddl: {
        kind: "createTable",
        ifNotExists: options2.ifNotExists ?? false
      },
      where: [],
      having: [],
      joins: [],
      groupBy: [],
      orderBy: []
    }, undefined, "ddl", "createTable");
  };
  const dropTable = (target, options2 = {}) => {
    const { sourceName, sourceBaseName } = targetSourceDetails(target);
    return makePlan({
      selection: {},
      required: [],
      available: {},
      dialect: target[TypeId].dialect
    }, {
      kind: "dropTable",
      select: {},
      target: {
        kind: "from",
        tableName: sourceName,
        baseTableName: sourceBaseName,
        source: target
      },
      ddl: {
        kind: "dropTable",
        ifExists: options2.ifExists ?? false
      },
      where: [],
      having: [],
      joins: [],
      groupBy: [],
      orderBy: []
    }, undefined, "ddl", "dropTable");
  };
  const createIndex = (target, columns, options2 = {}) => {
    const normalizedColumns = normalizeColumnList(columns);
    const { sourceName, sourceBaseName } = targetSourceDetails(target);
    return makePlan({
      selection: {},
      required: [],
      available: {},
      dialect: target[TypeId].dialect
    }, {
      kind: "createIndex",
      select: {},
      target: {
        kind: "from",
        tableName: sourceName,
        baseTableName: sourceBaseName,
        source: target
      },
      ddl: {
        kind: "createIndex",
        name: options2.name ?? defaultIndexName(sourceBaseName, normalizedColumns, options2.unique ?? false),
        columns: normalizedColumns,
        unique: options2.unique ?? false,
        ifNotExists: options2.ifNotExists ?? false
      },
      where: [],
      having: [],
      joins: [],
      groupBy: [],
      orderBy: []
    }, undefined, "ddl", "createIndex");
  };
  const dropIndex = (target, columns, options2 = {}) => {
    const normalizedColumns = normalizeColumnList(columns);
    const { sourceName, sourceBaseName } = targetSourceDetails(target);
    return makePlan({
      selection: {},
      required: [],
      available: {},
      dialect: target[TypeId].dialect
    }, {
      kind: "dropIndex",
      select: {},
      target: {
        kind: "from",
        tableName: sourceName,
        baseTableName: sourceBaseName,
        source: target
      },
      ddl: {
        kind: "dropIndex",
        name: options2.name ?? defaultIndexName(sourceBaseName, normalizedColumns, false),
        ifExists: options2.ifExists ?? false
      },
      where: [],
      having: [],
      joins: [],
      groupBy: [],
      orderBy: []
    }, undefined, "ddl", "dropIndex");
  };
  const api = {
    literal,
    column,
    cast,
    type,
    json: json2,
    jsonb: jsonb2,
    eq,
    neq,
    lt,
    lte,
    gt,
    gte,
    isNull,
    isNotNull,
    upper,
    lower,
    like,
    ilike,
    regexMatch,
    regexIMatch,
    regexNotMatch,
    regexNotIMatch,
    and,
    or,
    not,
    all: all_,
    any: any_,
    case: case_,
    match,
    coalesce,
    call,
    uuidGenerateV4,
    nextVal,
    in: in_,
    notIn,
    between,
    contains,
    containedBy,
    overlaps,
    concat,
    exists,
    over,
    rowNumber,
    rank,
    denseRank,
    count,
    max,
    min,
    isDistinctFrom,
    isNotDistinctFrom,
    excluded,
    as,
    with: with_,
    withRecursive: withRecursive_,
    lateral,
    scalar,
    inSubquery,
    compareAny,
    compareAll,
    values,
    unnest,
    generateSeries,
    returning,
    onConflict,
    insert,
    update,
    upsert,
    delete: delete_,
    truncate,
    merge,
    transaction,
    commit,
    rollback,
    savepoint,
    rollbackTo,
    releaseSavepoint,
    createTable,
    dropTable,
    createIndex,
    dropIndex,
    union,
    unionAll,
    intersect,
    intersectAll,
    except,
    exceptAll,
    select,
    where,
    having,
    from,
    innerJoin,
    leftJoin,
    rightJoin,
    fullJoin,
    crossJoin,
    distinct,
    distinctOn,
    limit,
    offset,
    lock,
    orderBy,
    groupBy
  };
  return api;
}

// src/postgres/private/query.ts
var postgresQuery = makeDialectQuery({
  dialect: "postgres",
  textDb: { dialect: "postgres", kind: "text" },
  numericDb: { dialect: "postgres", kind: "float8" },
  boolDb: { dialect: "postgres", kind: "bool" },
  timestampDb: { dialect: "postgres", kind: "timestamp" },
  nullDb: { dialect: "postgres", kind: "null" },
  type: postgresDatatypes
});

// src/postgres/function/core.ts
var coalesce = postgresQuery.coalesce;
var call = postgresQuery.call;
var uuidGenerateV4 = postgresQuery.uuidGenerateV4;
var nextVal = postgresQuery.nextVal;
// src/postgres/function/string.ts
var exports_string = {};
__export(exports_string, {
  upper: () => upper,
  lower: () => lower,
  concat: () => concat
});
var lower = postgresQuery.lower;
var upper = postgresQuery.upper;
var concat = postgresQuery.concat;
// src/postgres/function/aggregate.ts
var exports_aggregate = {};
__export(exports_aggregate, {
  min: () => min,
  max: () => max,
  count: () => count
});
var count = postgresQuery.count;
var max = postgresQuery.max;
var min = postgresQuery.min;
// src/postgres/function/window.ts
var exports_window = {};
__export(exports_window, {
  rowNumber: () => rowNumber,
  rank: () => rank,
  over: () => over,
  denseRank: () => denseRank
});
var over = postgresQuery.over;
var rowNumber = postgresQuery.rowNumber;
var rank = postgresQuery.rank;
var denseRank = postgresQuery.denseRank;
// src/postgres/function/json.ts
var exactPath = (...segments) => path(...segments);
var json2 = {
  key: postgresQuery.json.key,
  index: postgresQuery.json.index,
  path: exactPath,
  get: (base, target) => postgresQuery.json.get(base, target),
  access: (base, target) => postgresQuery.json.access(base, target),
  traverse: (base, target) => postgresQuery.json.traverse(base, target),
  text: (base, target) => postgresQuery.json.text(base, target),
  accessText: (base, target) => postgresQuery.json.accessText(base, target),
  traverseText: (base, target) => postgresQuery.json.traverseText(base, target),
  buildObject: postgresQuery.json.buildObject,
  buildArray: postgresQuery.json.buildArray,
  toJson: postgresQuery.json.toJson,
  typeOf: postgresQuery.json.typeOf,
  length: postgresQuery.json.length,
  keys: postgresQuery.json.keys,
  stripNulls: postgresQuery.json.stripNulls
};
var jsonb2 = {
  key: postgresQuery.jsonb.key,
  index: postgresQuery.jsonb.index,
  wildcard: postgresQuery.jsonb.wildcard,
  slice: postgresQuery.jsonb.slice,
  descend: postgresQuery.jsonb.descend,
  path: postgresQuery.jsonb.path,
  get: (base, target) => postgresQuery.jsonb.get(base, target),
  access: (base, target) => postgresQuery.jsonb.access(base, target),
  traverse: (base, target) => postgresQuery.jsonb.traverse(base, target),
  text: (base, target) => postgresQuery.jsonb.text(base, target),
  accessText: (base, target) => postgresQuery.jsonb.accessText(base, target),
  traverseText: (base, target) => postgresQuery.jsonb.traverseText(base, target),
  contains: (left, right) => postgresQuery.jsonb.contains(left, right),
  containedBy: (left, right) => postgresQuery.jsonb.containedBy(left, right),
  hasKey: (base, key2) => postgresQuery.jsonb.hasKey(base, key2),
  keyExists: (base, key2) => postgresQuery.jsonb.keyExists(base, key2),
  hasAnyKeys: (base, ...keys) => postgresQuery.jsonb.hasAnyKeys(base, ...keys),
  hasAllKeys: (base, ...keys) => postgresQuery.jsonb.hasAllKeys(base, ...keys),
  delete: (base, target) => postgresQuery.jsonb.delete(base, target),
  remove: (base, target) => postgresQuery.jsonb.remove(base, target),
  set: (base, target, next, options2) => postgresQuery.jsonb.set(base, target, next, options2),
  insert: (base, target, next, options2) => postgresQuery.jsonb.insert(base, target, next, options2),
  concat: postgresQuery.jsonb.concat,
  merge: postgresQuery.jsonb.merge,
  buildObject: postgresQuery.jsonb.buildObject,
  buildArray: postgresQuery.jsonb.buildArray,
  toJsonb: postgresQuery.jsonb.toJsonb,
  typeOf: (base) => postgresQuery.jsonb.typeOf(base),
  length: (base) => postgresQuery.jsonb.length(base),
  keys: (base) => postgresQuery.jsonb.keys(base),
  stripNulls: (base) => postgresQuery.jsonb.stripNulls(base),
  pathExists: (base, query) => postgresQuery.jsonb.pathExists(base, query),
  pathMatch: (base, query) => postgresQuery.jsonb.pathMatch(base, query)
};
// src/postgres/function/temporal.ts
var exports_temporal = {};
__export(exports_temporal, {
  now: () => now,
  localTimestamp: () => localTimestamp,
  localTime: () => localTime,
  currentTimestamp: () => currentTimestamp,
  currentTime: () => currentTime,
  currentDate: () => currentDate
});
var makeTemporal = (name2, dbType, runtimeSchema) => makeExpression({
  runtime: undefined,
  dbType,
  runtimeSchema,
  nullability: "never",
  dialect: "postgres",
  aggregation: "scalar",
  source: undefined,
  dependencies: {},
  sourceNullability: "resolved"
}, {
  kind: "function",
  name: name2,
  args: []
});
var now = () => makeTemporal("now", { dialect: "postgres", kind: "timestamptz" }, InstantStringSchema);
var currentDate = () => makeTemporal("current_date", { dialect: "postgres", kind: "date" }, LocalDateStringSchema);
var currentTime = () => makeTemporal("current_time", { dialect: "postgres", kind: "timetz" }, OffsetTimeStringSchema);
var currentTimestamp = () => makeTemporal("current_timestamp", { dialect: "postgres", kind: "timestamptz" }, InstantStringSchema);
var localTime = () => makeTemporal("localtime", { dialect: "postgres", kind: "time" }, LocalTimeStringSchema);
var localTimestamp = () => makeTemporal("localtimestamp", { dialect: "postgres", kind: "timestamp" }, LocalDateTimeStringSchema);
// src/postgres/executor.ts
var exports_executor = {};
__export(exports_executor, {
  withTransaction: () => withTransaction2,
  withSavepoint: () => withSavepoint2,
  make: () => make6,
  driver: () => driver2,
  custom: () => custom2
});
import * as Effect2 from "effect/Effect";
import * as SqlClient3 from "effect/unstable/sql/SqlClient";

// src/internal/executor.ts
import * as Effect from "effect/Effect";
import * as Schema6 from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";

// src/mysql/datatypes/spec.ts
var mysqlDatatypeKinds = {
  char: { family: "text", runtime: "string" },
  varchar: { family: "text", runtime: "string" },
  tinytext: { family: "text", runtime: "string" },
  text: { family: "text", runtime: "string" },
  mediumtext: { family: "text", runtime: "string" },
  longtext: { family: "text", runtime: "string" },
  tinyint: { family: "numeric", runtime: "number" },
  smallint: { family: "numeric", runtime: "number" },
  mediumint: { family: "numeric", runtime: "number" },
  int: { family: "numeric", runtime: "number" },
  integer: { family: "numeric", runtime: "number" },
  bigint: { family: "numeric", runtime: "bigintString" },
  decimal: { family: "numeric", runtime: "decimalString" },
  dec: { family: "numeric", runtime: "decimalString" },
  numeric: { family: "numeric", runtime: "decimalString" },
  fixed: { family: "numeric", runtime: "decimalString" },
  float: { family: "numeric", runtime: "number" },
  double: { family: "numeric", runtime: "number" },
  real: { family: "numeric", runtime: "number" },
  bool: { family: "boolean", runtime: "boolean" },
  boolean: { family: "boolean", runtime: "boolean" },
  bit: { family: "bit", runtime: "string" },
  date: { family: "date", runtime: "localDate" },
  time: { family: "time", runtime: "localTime" },
  datetime: { family: "datetime", runtime: "localDateTime" },
  timestamp: { family: "timestamp", runtime: "localDateTime" },
  year: { family: "year", runtime: "year" },
  binary: { family: "binary", runtime: "bytes" },
  varbinary: { family: "binary", runtime: "bytes" },
  tinyblob: { family: "binary", runtime: "bytes" },
  blob: { family: "binary", runtime: "bytes" },
  mediumblob: { family: "binary", runtime: "bytes" },
  longblob: { family: "binary", runtime: "bytes" },
  json: { family: "json", runtime: "json" },
  geometry: { family: "spatial", runtime: "unknown" },
  point: { family: "spatial", runtime: "unknown" },
  linestring: { family: "spatial", runtime: "unknown" },
  polygon: { family: "spatial", runtime: "unknown" },
  multipoint: { family: "spatial", runtime: "unknown" },
  multilinestring: { family: "spatial", runtime: "unknown" },
  multipolygon: { family: "spatial", runtime: "unknown" },
  geometrycollection: { family: "spatial", runtime: "unknown" },
  enum: { family: "enum", runtime: "string" },
  set: { family: "set", runtime: "string" }
};

// src/internal/runtime-normalize.ts
var stripParameterizedKind = (kind) => {
  const openParen = kind.indexOf("(");
  return openParen === -1 ? kind : kind.slice(0, openParen);
};
var stripArrayKind = (kind) => {
  let current = kind;
  while (current.endsWith("[]")) {
    current = current.slice(0, -2);
  }
  return current;
};
var baseKind = (kind) => stripArrayKind(stripParameterizedKind(kind));
var isRecord2 = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var pad = (value, width = 2) => value.toString().padStart(width, "0");
var formatLocalDate = (value) => `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
var formatLocalTime = (value) => {
  const milliseconds = value.getUTCMilliseconds();
  const base = `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`;
  return milliseconds === 0 ? base : `${base}.${pad(milliseconds, 3)}`;
};
var formatLocalDateTime = (value) => {
  const milliseconds = value.getUTCMilliseconds();
  const base = `${formatLocalDate(value)}T${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`;
  return milliseconds === 0 ? base : `${base}.${pad(milliseconds, 3)}`;
};
var runtimeTagOfBaseDbType = (dialect, kind) => {
  const normalizedKind = baseKind(kind);
  if (dialect === "postgres") {
    return postgresDatatypeKinds[normalizedKind]?.runtime;
  }
  if (dialect === "mysql") {
    return mysqlDatatypeKinds[normalizedKind]?.runtime;
  }
  return;
};
var expectString = (value, label) => {
  if (typeof value === "string") {
    return value;
  }
  throw new Error(`Expected ${label} as string`);
};
var normalizeNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  if (typeof value === "bigint" && Number.isSafeInteger(Number(value))) {
    return Number(value);
  }
  throw new Error("Expected a finite numeric value");
};
var normalizeBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "t" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "f" || normalized === "0") {
      return false;
    }
  }
  throw new Error("Expected a boolean-like value");
};
var normalizeBigIntString = (value) => {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value).toString();
  }
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return BigInt(value.trim()).toString();
  }
  throw new Error("Expected an integer-like bigint value");
};
var canonicalizeDecimalString = (input) => {
  const trimmed = input.trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(trimmed);
  if (match === null) {
    throw new Error("Expected a decimal string");
  }
  const sign = match[1] === "-" ? "-" : "";
  const integer = match[2].replace(/^0+(?=\d)/, "") || "0";
  const fraction = (match[3] ?? "").replace(/0+$/, "");
  if (fraction.length === 0) {
    return `${sign}${integer}`;
  }
  return `${sign}${integer}.${fraction}`;
};
var normalizeDecimalString = (value) => {
  if (typeof value === "string") {
    return canonicalizeDecimalString(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const rendered = String(value);
    if (/[eE]/.test(rendered)) {
      throw new Error("Scientific notation is not a supported decimal runtime");
    }
    return canonicalizeDecimalString(rendered);
  }
  throw new Error("Expected a decimal-like value");
};
var normalizeLocalDate = (value) => {
  if (value instanceof Date) {
    return formatLocalDate(value);
  }
  const raw = expectString(value, "local date").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return formatLocalDate(parsed);
  }
  throw new Error("Expected a local-date value");
};
var normalizeLocalTime = (value) => {
  if (value instanceof Date) {
    return formatLocalTime(value);
  }
  const raw = expectString(value, "local time").trim();
  if (/^\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(raw)) {
    return raw;
  }
  throw new Error("Expected a local-time value");
};
var normalizeOffsetTime = (value) => {
  if (value instanceof Date) {
    return `${formatLocalTime(value)}Z`;
  }
  const raw = expectString(value, "offset time").trim();
  if (/^\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(raw)) {
    return raw;
  }
  throw new Error("Expected an offset-time value");
};
var normalizeLocalDateTime = (value) => {
  if (value instanceof Date) {
    return formatLocalDateTime(value);
  }
  const raw = expectString(value, "local datetime").trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(raw)) {
    return raw.replace(" ", "T");
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(raw)) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return formatLocalDateTime(parsed);
    }
  }
  throw new Error("Expected a local-datetime value");
};
var normalizeInstant = (value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  const raw = expectString(value, "instant").trim();
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(raw)) {
    throw new Error("Instant values require a timezone offset");
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Expected an ISO instant value");
  }
  return parsed.toISOString();
};
var normalizeYear = (value) => {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 9999) {
    return pad(value, 4);
  }
  const raw = expectString(value, "year").trim();
  if (/^\d{4}$/.test(raw)) {
    return raw;
  }
  throw new Error("Expected a four-digit year");
};
var normalizeBytes = (value) => {
  if (value instanceof Uint8Array) {
    return new Uint8Array(value);
  }
  if (typeof Buffer !== "undefined" && value instanceof Buffer) {
    return new Uint8Array(value);
  }
  throw new Error("Expected a byte array value");
};
var isJsonValue = (value) => {
  if (value === null) {
    return true;
  }
  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
      return true;
    case "object":
      if (Array.isArray(value)) {
        return value.every(isJsonValue);
      }
      return isRecord2(value) && Object.values(value).every(isJsonValue);
    default:
      return false;
  }
};
var normalizeJson = (value) => {
  if (typeof value === "string") {
    const parsed = JSON.parse(value);
    if (isJsonValue(parsed)) {
      return parsed;
    }
    throw new Error("Parsed JSON value is not a valid JSON runtime");
  }
  if (isJsonValue(value)) {
    return value;
  }
  throw new Error("Expected a JSON value");
};
var normalizeDbValue = (dbType, value) => {
  if (value === null) {
    return null;
  }
  if ("base" in dbType) {
    return normalizeDbValue(dbType.base, value);
  }
  if ("element" in dbType) {
    if (!Array.isArray(value)) {
      throw new Error("Expected an array value");
    }
    return value.map((entry) => normalizeDbValue(dbType.element, entry));
  }
  if ("fields" in dbType) {
    if (!isRecord2(value)) {
      throw new Error("Expected a record value");
    }
    const normalized = {};
    for (const [key2, fieldDbType] of Object.entries(dbType.fields)) {
      if (key2 in value) {
        normalized[key2] = normalizeDbValue(fieldDbType, value[key2]);
      }
    }
    return normalized;
  }
  if ("variant" in dbType && dbType.variant === "json") {
    return normalizeJson(value);
  }
  if ("variant" in dbType && (dbType.variant === "enum" || dbType.variant === "set")) {
    return expectString(value, "text");
  }
  switch (runtimeTagOfBaseDbType(dbType.dialect, dbType.kind)) {
    case "string":
      return expectString(value, "text");
    case "number":
      return normalizeNumber(value);
    case "bigintString":
      return normalizeBigIntString(value);
    case "boolean":
      return normalizeBoolean(value);
    case "json":
      return normalizeJson(value);
    case "localDate":
      return normalizeLocalDate(value);
    case "localTime":
      return normalizeLocalTime(value);
    case "offsetTime":
      return normalizeOffsetTime(value);
    case "localDateTime":
      return normalizeLocalDateTime(value);
    case "instant":
      return normalizeInstant(value);
    case "year":
      return normalizeYear(value);
    case "decimalString":
      return normalizeDecimalString(value);
    case "bytes":
      return normalizeBytes(value);
    case "array":
      if (!Array.isArray(value)) {
        throw new Error("Expected an array value");
      }
      return value;
    case "record":
      if (!isRecord2(value)) {
        throw new Error("Expected a record value");
      }
      return value;
    case "null":
      return null;
    case "unknown":
    case undefined:
      return value;
  }
};

// src/internal/runtime-schema.ts
import * as Schema5 from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
var schemaCache = new WeakMap;
var stripParameterizedKind2 = (kind) => {
  const openParen = kind.indexOf("(");
  return openParen === -1 ? kind : kind.slice(0, openParen);
};
var stripArrayKind2 = (kind) => {
  let current = kind;
  while (current.endsWith("[]")) {
    current = current.slice(0, -2);
  }
  return current;
};
var baseKind2 = (kind) => stripArrayKind2(stripParameterizedKind2(kind));
var runtimeSchemaForTag = (tag) => {
  switch (tag) {
    case "string":
      return Schema5.String;
    case "number":
      return Schema5.Number;
    case "bigintString":
      return BigIntStringSchema;
    case "boolean":
      return Schema5.Boolean;
    case "json":
      return JsonValueSchema;
    case "localDate":
      return LocalDateStringSchema;
    case "localTime":
      return LocalTimeStringSchema;
    case "offsetTime":
      return OffsetTimeStringSchema;
    case "localDateTime":
      return LocalDateTimeStringSchema;
    case "instant":
      return InstantStringSchema;
    case "year":
      return YearStringSchema;
    case "decimalString":
      return DecimalStringSchema;
    case "bytes":
      return Schema5.Uint8Array;
    case "array":
      return Schema5.Array(Schema5.Unknown);
    case "record":
      return Schema5.Record(Schema5.String, Schema5.Unknown);
    case "null":
      return Schema5.Null;
    case "unknown":
      return;
  }
};
var runtimeTagOfBaseDbType2 = (dialect, kind) => {
  const normalizedKind = baseKind2(kind);
  if (dialect === "postgres") {
    return postgresDatatypeKinds[normalizedKind]?.runtime;
  }
  if (dialect === "mysql") {
    return mysqlDatatypeKinds[normalizedKind]?.runtime;
  }
  return;
};
var runtimeSchemaForDbType = (dbType) => {
  if ("base" in dbType) {
    return runtimeSchemaForDbType(dbType.base);
  }
  if ("element" in dbType) {
    return Schema5.Array(runtimeSchemaForDbType(dbType.element) ?? Schema5.Unknown);
  }
  if ("fields" in dbType) {
    const fields2 = Object.fromEntries(Object.entries(dbType.fields).map(([key2, field]) => [key2, runtimeSchemaForDbType(field) ?? Schema5.Unknown]));
    return Schema5.Struct(fields2);
  }
  if ("variant" in dbType && dbType.variant === "json") {
    return JsonValueSchema;
  }
  if ("variant" in dbType && (dbType.variant === "enum" || dbType.variant === "set")) {
    return Schema5.String;
  }
  const runtimeTag = runtimeTagOfBaseDbType2(dbType.dialect, dbType.kind);
  return runtimeTag === undefined ? undefined : runtimeSchemaForTag(runtimeTag);
};
var makeSchemaFromAst = (ast) => Schema5.make(ast);
var unionAst = (asts) => {
  if (asts.length === 0) {
    return;
  }
  if (asts.length === 1) {
    return asts[0];
  }
  return new SchemaAST.Union(asts, "anyOf");
};
var propertyAstOf = (ast, key2) => {
  const current = SchemaAST.toType(ast);
  switch (current._tag) {
    case "Suspend":
      return propertyAstOf(current.thunk(), key2);
    case "Objects": {
      const property = current.propertySignatures.find((entry) => entry.name === key2);
      if (property !== undefined) {
        return property.type;
      }
      const index3 = current.indexSignatures.find((entry) => SchemaAST.toType(entry.parameter)._tag === "String");
      return index3?.type;
    }
    case "Union": {
      const values = current.types.flatMap((member) => {
        const next = propertyAstOf(member, key2);
        return next === undefined ? [] : [next];
      });
      return unionAst(values);
    }
    default:
      return;
  }
};
var numberAstOf = (ast, index3) => {
  const current = SchemaAST.toType(ast);
  switch (current._tag) {
    case "Suspend":
      return numberAstOf(current.thunk(), index3);
    case "Arrays": {
      const element = current.elements[index3];
      if (element !== undefined) {
        return element;
      }
      if (current.rest.length === 0) {
        return;
      }
      return unionAst(current.rest);
    }
    case "Union": {
      const values = current.types.flatMap((member) => {
        const next = numberAstOf(member, index3);
        return next === undefined ? [] : [next];
      });
      return unionAst(values);
    }
    default:
      return;
  }
};
var exactJsonSegments = (segments) => segments.every((segment) => segment.kind === "key" || segment.kind === "index");
var schemaAstAtExactJsonPath = (schema3, segments) => {
  let current = SchemaAST.toType(schema3.ast);
  for (const segment of segments) {
    if (segment.kind === "key") {
      const property = propertyAstOf(current, segment.key);
      if (property === undefined) {
        return;
      }
      current = property;
      continue;
    }
    if (segment.kind === "index") {
      const next = numberAstOf(current, segment.index);
      if (next === undefined) {
        return;
      }
      current = next;
      continue;
    }
    return;
  }
  return current;
};
var unionSchemas = (schemas) => {
  const resolved = schemas.filter((schema3) => schema3 !== undefined);
  if (resolved.length === 0) {
    return;
  }
  if (resolved.length === 1) {
    return resolved[0];
  }
  return Schema5.Union(resolved);
};
var firstSelectedExpression = (plan) => {
  const selection = getAst(plan).select;
  return flattenSelection(selection)[0]?.expression;
};
var isJsonCompatibleAst = (ast) => {
  const current = SchemaAST.toType(ast);
  switch (current._tag) {
    case "String":
    case "Number":
    case "Boolean":
    case "Null":
    case "Arrays":
    case "Objects":
      return true;
    case "Literal":
      return current.literal === null || typeof current.literal === "string" || typeof current.literal === "number" || typeof current.literal === "boolean";
    case "Union":
      return current.types.every(isJsonCompatibleAst);
    case "Suspend":
      return isJsonCompatibleAst(current.thunk());
    default:
      return false;
  }
};
var jsonCompatibleSchema = (schema3) => {
  if (schema3 === undefined) {
    return;
  }
  const ast = SchemaAST.toType(schema3.ast);
  return isJsonCompatibleAst(ast) ? schema3 : JsonValueSchema;
};
var buildStructSchema = (entries) => {
  const fields2 = Object.fromEntries(entries.map((entry) => [entry.key, expressionRuntimeSchema(entry.value) ?? JsonValueSchema]));
  return Schema5.Struct(fields2);
};
var buildTupleSchema = (values) => Schema5.Tuple(values.map((value) => expressionRuntimeSchema(value) ?? JsonValueSchema));
var deriveRuntimeSchema = (expression) => {
  const state = expression[TypeId2];
  if (state.runtimeSchema !== undefined) {
    return state.runtimeSchema;
  }
  const ast = expression[TypeId3];
  switch (ast.kind) {
    case "column":
    case "excluded":
      return state.runtimeSchema;
    case "literal":
      if (ast.value === null) {
        return Schema5.Null;
      }
      if (typeof ast.value === "string" || typeof ast.value === "number" || typeof ast.value === "boolean") {
        return Schema5.Literal(ast.value);
      }
      return runtimeSchemaForDbType(state.dbType);
    case "cast":
      return runtimeSchemaForDbType(ast.target);
    case "isNull":
    case "isNotNull":
    case "not":
    case "eq":
    case "neq":
    case "lt":
    case "lte":
    case "gt":
    case "gte":
    case "like":
    case "ilike":
    case "isDistinctFrom":
    case "isNotDistinctFrom":
    case "contains":
    case "containedBy":
    case "overlaps":
    case "and":
    case "or":
    case "in":
    case "notIn":
    case "between":
    case "exists":
    case "inSubquery":
    case "comparisonAny":
    case "comparisonAll":
    case "jsonHasKey":
    case "jsonKeyExists":
    case "jsonHasAnyKeys":
    case "jsonHasAllKeys":
    case "jsonPathExists":
    case "jsonPathMatch":
      return Schema5.Boolean;
    case "upper":
    case "lower":
    case "concat":
    case "jsonGetText":
    case "jsonPathText":
    case "jsonAccessText":
    case "jsonTraverseText":
    case "jsonTypeOf":
      return Schema5.String;
    case "count":
    case "jsonLength":
      return Schema5.Number;
    case "max":
    case "min":
      return expressionRuntimeSchema(ast.value);
    case "case":
      return unionSchemas([
        ...ast.branches.map((branch) => expressionRuntimeSchema(branch.then)),
        expressionRuntimeSchema(ast.else)
      ]);
    case "coalesce":
      return unionSchemas(ast.values.map(expressionRuntimeSchema));
    case "scalarSubquery": {
      const selection = firstSelectedExpression(ast.plan);
      return selection === undefined ? undefined : expressionRuntimeSchema(selection);
    }
    case "window":
      return ast.function === "over" && ast.value !== undefined ? expressionRuntimeSchema(ast.value) : Schema5.Number;
    case "jsonGet":
    case "jsonPath":
    case "jsonAccess":
    case "jsonTraverse": {
      const baseSchema = expressionRuntimeSchema(ast.base);
      const segments = ast.segments;
      if (baseSchema === undefined || segments === undefined || !exactJsonSegments(segments)) {
        return JsonValueSchema;
      }
      const subAst = schemaAstAtExactJsonPath(baseSchema, segments);
      return subAst === undefined ? JsonValueSchema : makeSchemaFromAst(subAst);
    }
    case "jsonDelete":
    case "jsonDeletePath":
    case "jsonRemove":
    case "jsonSet":
    case "jsonInsert":
      return expressionRuntimeSchema(ast.base);
    case "jsonStripNulls":
      return expressionRuntimeSchema(ast.value);
    case "jsonConcat":
    case "jsonMerge":
      return JsonValueSchema;
    case "jsonBuildObject":
      return buildStructSchema(ast.entries ?? []);
    case "jsonBuildArray":
      return buildTupleSchema(ast.values ?? []);
    case "jsonToJson":
    case "jsonToJsonb":
      return jsonCompatibleSchema(expressionRuntimeSchema(ast.value));
    case "jsonKeys":
      return Schema5.Array(Schema5.String);
  }
};
var expressionRuntimeSchema = (expression) => {
  const cached = schemaCache.get(expression);
  if (cached !== undefined || schemaCache.has(expression)) {
    return cached;
  }
  const resolved = deriveRuntimeSchema(expression) ?? runtimeSchemaForDbType(expression[TypeId2].dbType);
  schemaCache.set(expression, resolved);
  return resolved;
};

// src/internal/executor.ts
var setPath2 = (target, path2, value) => {
  let current = target;
  for (let index3 = 0;index3 < path2.length - 1; index3++) {
    const key2 = path2[index3];
    const existing = current[key2];
    if (typeof existing === "object" && existing !== null && !Array.isArray(existing)) {
      current = existing;
      continue;
    }
    const next = {};
    current[key2] = next;
    current = next;
  }
  current[path2[path2.length - 1]] = value;
};
var hasWriteStatement = (statement) => statement === "insert" || statement === "update" || statement === "delete" || statement === "truncate" || statement === "merge" || statement === "transaction" || statement === "commit" || statement === "rollback" || statement === "savepoint" || statement === "rollbackTo" || statement === "releaseSavepoint" || statement === "createTable" || statement === "createIndex" || statement === "dropIndex" || statement === "dropTable";
var hasWriteCapabilityInSource = (source) => typeof source === "object" && source !== null && ("plan" in source) ? hasWriteCapability(source.plan) : false;
var hasWriteCapability = (plan) => {
  const ast = getAst(plan);
  if (hasWriteStatement(ast.kind)) {
    return true;
  }
  if (ast.kind === "set") {
    if (ast.setBase && hasWriteCapability(ast.setBase)) {
      return true;
    }
    if ((ast.setOperations ?? []).some((entry) => hasWriteCapability(entry.query))) {
      return true;
    }
  }
  if (ast.from && hasWriteCapabilityInSource(ast.from.source)) {
    return true;
  }
  if (ast.into && hasWriteCapabilityInSource(ast.into.source)) {
    return true;
  }
  if (ast.target && hasWriteCapabilityInSource(ast.target.source)) {
    return true;
  }
  if ((ast.joins ?? []).some((join) => hasWriteCapabilityInSource(join.source))) {
    return true;
  }
  return false;
};
var makeRowDecodeError = (rendered, projection, expression, raw, stage, cause, normalized) => ({
  _tag: "RowDecodeError",
  message: stage === "normalize" ? `Failed to normalize projection '${projection.alias}'` : `Failed to decode projection '${projection.alias}' against its runtime schema`,
  dialect: rendered.dialect,
  query: {
    sql: rendered.sql,
    params: rendered.params
  },
  projection: {
    alias: projection.alias,
    path: projection.path
  },
  dbType: expression[TypeId2].dbType,
  raw,
  normalized,
  stage,
  cause
});
var hasOptionalSourceDependency = (expression, available) => {
  const state = expression[TypeId2];
  if (state.sourceNullability === "resolved") {
    return false;
  }
  return Object.keys(state.dependencies).some((sourceName) => available[sourceName]?.mode === "optional");
};
var effectiveRuntimeNullability = (expression, available) => {
  const nullability = expression[TypeId2].nullability;
  if (nullability === "always") {
    return "always";
  }
  return hasOptionalSourceDependency(expression, available) ? "maybe" : nullability;
};
var decodeProjectionValue = (rendered, projection, expression, raw, available, driverMode) => {
  let normalized = raw;
  if (driverMode === "raw") {
    try {
      normalized = normalizeDbValue(expression[TypeId2].dbType, raw);
    } catch (cause) {
      throw makeRowDecodeError(rendered, projection, expression, raw, "normalize", cause);
    }
  }
  if (normalized === null) {
    if (effectiveRuntimeNullability(expression, available) === "never") {
      throw makeRowDecodeError(rendered, projection, expression, raw, "schema", new Error("Received null for a non-null projection"), normalized);
    }
    return null;
  }
  const schema3 = expressionRuntimeSchema(expression);
  if (schema3 === undefined) {
    return normalized;
  }
  if (Schema6.is(schema3)(normalized)) {
    return normalized;
  }
  try {
    return Schema6.decodeUnknownSync(schema3)(normalized);
  } catch (cause) {
    throw makeRowDecodeError(rendered, projection, expression, raw, "schema", cause, normalized);
  }
};
var decodeRows = (rendered, plan, rows, options2 = {}) => {
  const projections = flattenSelection(getAst(plan).select);
  const byAlias = new Map(projections.map((projection) => [projection.alias, projection.expression]));
  const driverMode = options2.driverMode ?? "raw";
  const available = plan[TypeId].available;
  return rows.map((row) => {
    const decoded = {};
    for (const projection of rendered.projections) {
      if (!(projection.alias in row)) {
        continue;
      }
      const expression = byAlias.get(projection.alias);
      if (expression === undefined) {
        continue;
      }
      setPath2(decoded, projection.path, decodeProjectionValue(rendered, projection, expression, row[projection.alias], available, driverMode));
    }
    return decoded;
  });
};
var make4 = (dialect, execute) => ({
  dialect,
  execute(plan) {
    return execute(plan);
  }
});
var driver = (dialect, execute) => ({
  dialect,
  execute(query) {
    return execute(query);
  }
});
var withTransaction = (effect) => Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) => sql.withTransaction(effect));
var withSavepoint = (effect) => Effect.flatMap(Effect.service(SqlClient.SqlClient), (sql) => sql.withTransaction(effect));

// src/internal/postgres-renderer.ts
var renderPostgresPlan = (plan) => {
  const state = {
    params: [],
    ctes: [],
    cteNames: new Set
  };
  const rendered = renderQueryAst(getAst(plan), state, postgresDialect);
  return {
    sql: rendered.sql,
    params: state.params,
    projections: rendered.projections
  };
};

// src/internal/renderer.ts
var TypeId9 = Symbol.for("effect-qb/Renderer");
function make5(dialect, render2) {
  const implementation = render2 ?? (dialect === "postgres" ? renderPostgresPlan : undefined);
  if (!implementation) {
    throw new Error(`No built-in renderer for dialect: ${dialect}`);
  }
  return {
    dialect,
    render(plan) {
      const rendered = implementation(plan);
      const projections = rendered.projections ?? [];
      validateProjections(projections);
      return {
        sql: rendered.sql,
        params: rendered.params ?? [],
        projections,
        dialect,
        [TypeId9]: {
          row: undefined,
          dialect
        }
      };
    }
  };
}
var postgres2 = make5("postgres");

// src/postgres/executor.ts
var withTransaction2 = withTransaction;
var withSavepoint2 = withSavepoint;
function driver2(dialectOrExecute, maybeExecute) {
  const execute = typeof dialectOrExecute === "string" ? maybeExecute : dialectOrExecute;
  return driver("postgres", execute);
}
var fromDriver = (renderer, sqlDriver, driverMode = "raw") => ({
  dialect: "postgres",
  execute(plan) {
    const rendered = renderer.render(plan);
    return Effect2.mapError(Effect2.flatMap(sqlDriver.execute(rendered), (rows) => Effect2.try({
      try: () => decodeRows(rendered, plan, rows, { driverMode }),
      catch: (error) => error
    })), (error) => {
      if (typeof error === "object" && error !== null && "_tag" in error && error._tag === "RowDecodeError") {
        return error;
      }
      const normalized = normalizePostgresDriverError(error, rendered);
      return hasWriteCapability(plan) ? normalized : narrowPostgresDriverErrorForReadQuery(normalized);
    });
  }
});
var sqlClientDriver = () => driver2((query) => Effect2.flatMap(Effect2.service(SqlClient3.SqlClient), (sql) => sql.unsafe(query.sql, [...query.params])));
function make6(options2 = {}) {
  if (options2.driver) {
    return fromDriver(options2.renderer ?? make5("postgres"), options2.driver, options2.driverMode);
  }
  return fromDriver(options2.renderer ?? make5("postgres"), sqlClientDriver(), options2.driverMode);
}
var custom2 = (execute) => make4("postgres", execute);
// src/postgres/query.ts
var exports_query2 = {};
__export(exports_query2, {
  with_: () => with_,
  withRecursive: () => withRecursive,
  with: () => with_,
  where: () => where,
  values: () => values,
  upsert: () => upsert,
  update: () => update,
  unnest: () => unnest,
  union_query_capabilities: () => union_query_capabilities,
  unionAll: () => unionAll,
  union: () => union,
  type: () => type,
  truncate: () => truncate,
  transaction: () => transaction,
  select: () => select,
  scalar: () => scalar,
  savepoint: () => savepoint,
  rollbackTo: () => rollbackTo,
  rollback: () => rollback,
  rightJoin: () => rightJoin,
  returning: () => returning,
  releaseSavepoint: () => releaseSavepoint,
  regexNotMatch: () => regexNotMatch,
  regexNotIMatch: () => regexNotIMatch,
  regexMatch: () => regexMatch,
  regexIMatch: () => regexIMatch,
  overlaps: () => overlaps,
  orderBy: () => orderBy,
  or: () => or,
  onConflict: () => onConflict,
  offset: () => offset,
  notIn: () => notIn,
  not: () => not,
  neq: () => neq,
  merge: () => merge,
  match: () => match,
  lte: () => lte,
  lt: () => lt,
  lock: () => lock,
  literal: () => literal,
  limit: () => limit,
  like: () => like,
  leftJoin: () => leftJoin,
  lateral: () => lateral,
  isNull: () => isNull,
  isNotNull: () => isNotNull,
  isNotDistinctFrom: () => isNotDistinctFrom,
  isDistinctFrom: () => isDistinctFrom,
  intersectAll: () => intersectAll,
  intersect: () => intersect,
  insert: () => insert,
  innerJoin: () => innerJoin,
  in_: () => in_,
  inSubquery: () => inSubquery,
  in: () => in_,
  ilike: () => ilike,
  having: () => having,
  gte: () => gte,
  gt: () => gt,
  groupBy: () => groupBy,
  generateSeries: () => generateSeries,
  fullJoin: () => fullJoin,
  from: () => from,
  exists: () => exists,
  excluded: () => excluded,
  exceptAll: () => exceptAll,
  except: () => except,
  eq: () => eq,
  dropTable: () => dropTable,
  dropIndex: () => dropIndex,
  distinctOn: () => distinctOn,
  distinct: () => distinct,
  delete_: () => delete_,
  delete: () => delete_,
  crossJoin: () => crossJoin,
  createTable: () => createTable,
  createIndex: () => createIndex,
  contains: () => contains,
  containedBy: () => containedBy,
  compareAny: () => compareAny,
  compareAll: () => compareAll,
  commit: () => commit,
  column: () => column,
  cast: () => cast,
  case: () => case_,
  between: () => between,
  as: () => as,
  any: () => any,
  and: () => and,
  all: () => all
});
var literal = postgresQuery.literal;
var column = postgresQuery.column;
var cast = postgresQuery.cast;
var type = postgresQuery.type;
var eq = postgresQuery.eq;
var neq = postgresQuery.neq;
var lt = postgresQuery.lt;
var lte = postgresQuery.lte;
var gt = postgresQuery.gt;
var gte = postgresQuery.gte;
var isNull = postgresQuery.isNull;
var isNotNull = postgresQuery.isNotNull;
var like = postgresQuery.like;
var ilike = postgresQuery.ilike;
var regexMatch = postgresQuery.regexMatch;
var regexIMatch = postgresQuery.regexIMatch;
var regexNotMatch = postgresQuery.regexNotMatch;
var regexNotIMatch = postgresQuery.regexNotIMatch;
var and = postgresQuery.and;
var or = postgresQuery.or;
var not = postgresQuery.not;
var all = postgresQuery.all;
var any = postgresQuery.any;
var case_ = postgresQuery.case;
var match = postgresQuery.match;
var in_ = postgresQuery.in;
var notIn = postgresQuery.notIn;
var between = postgresQuery.between;
var contains = postgresQuery.contains;
var containedBy = postgresQuery.containedBy;
var overlaps = postgresQuery.overlaps;
var exists = postgresQuery.exists;
var isDistinctFrom = postgresQuery.isDistinctFrom;
var isNotDistinctFrom = postgresQuery.isNotDistinctFrom;
var excluded = postgresQuery.excluded;
var as = postgresQuery.as;
var with_ = postgresQuery.with;
var withRecursive = postgresQuery.withRecursive;
var lateral = postgresQuery.lateral;
var scalar = postgresQuery.scalar;
var inSubquery = postgresQuery.inSubquery;
var compareAny = postgresQuery.compareAny;
var compareAll = postgresQuery.compareAll;
var values = postgresQuery.values;
var unnest = postgresQuery.unnest;
var generateSeries = postgresQuery.generateSeries;
var returning = postgresQuery.returning;
var onConflict = postgresQuery.onConflict;
var insert = postgresQuery.insert;
var update = postgresQuery.update;
var upsert = postgresQuery.upsert;
var delete_ = postgresQuery.delete;
var truncate = postgresQuery.truncate;
var merge = postgresQuery.merge;
var transaction = postgresQuery.transaction;
var commit = postgresQuery.commit;
var rollback = postgresQuery.rollback;
var savepoint = postgresQuery.savepoint;
var rollbackTo = postgresQuery.rollbackTo;
var releaseSavepoint = postgresQuery.releaseSavepoint;
var createTable = postgresQuery.createTable;
var dropTable = postgresQuery.dropTable;
var createIndex = postgresQuery.createIndex;
var dropIndex = postgresQuery.dropIndex;
var union = postgresQuery.union;
var unionAll = postgresQuery.unionAll;
var intersect = postgresQuery.intersect;
var intersectAll = postgresQuery.intersectAll;
var except = postgresQuery.except;
var exceptAll = postgresQuery.exceptAll;
var select = postgresQuery.select;
var where = postgresQuery.where;
var having = postgresQuery.having;
var from = postgresQuery.from;
var innerJoin = postgresQuery.innerJoin;
var leftJoin = postgresQuery.leftJoin;
var rightJoin = postgresQuery.rightJoin;
var fullJoin = postgresQuery.fullJoin;
var crossJoin = postgresQuery.crossJoin;
var distinct = postgresQuery.distinct;
var distinctOn = postgresQuery.distinctOn;
var limit = postgresQuery.limit;
var offset = postgresQuery.offset;
var lock = postgresQuery.lock;
var orderBy = postgresQuery.orderBy;
var groupBy = postgresQuery.groupBy;
// src/postgres/schema-expression.ts
var exports_schema_expression2 = {};
__export(exports_schema_expression2, {
  toAst: () => toAst,
  renderDdlExpressionSql: () => renderDdlExpressionSql,
  render: () => render,
  parseExpression: () => parseExpression,
  normalizeDdlExpressionSql: () => normalizeDdlExpressionSql,
  normalize: () => normalize,
  isSchemaExpression: () => isSchemaExpression,
  fromAst: () => fromAst,
  TypeId: () => TypeId5
});
// src/postgres/schema.ts
var schema3 = (schemaName) => ({
  ...schema(schemaName),
  enum: (name2, values2) => enumType(name2, values2, schemaName)
});
// src/postgres/table.ts
var exports_table2 = {};
__export(exports_table2, {
  unique: () => unique3,
  primaryKey: () => primaryKey3,
  options: () => options2,
  option: () => option2,
  make: () => make7,
  index: () => index3,
  foreignKey: () => foreignKey2,
  check: () => check2,
  alias: () => alias2,
  TypeId: () => TypeId10,
  OptionsSymbol: () => OptionsSymbol2,
  Class: () => Class2
});
var TypeId10 = TypeId4;
var OptionsSymbol2 = OptionsSymbol;
var options2 = options;
var make7 = (name2, fields2, schemaName = "public") => make2(name2, fields2, schemaName);
var alias2 = (table, aliasName) => alias(table, aliasName);
var Class2 = (name2, schemaName = "public") => {
  const base = Class(name2, schemaName);
  return base;
};
var option2 = option;
var isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
var normalizeColumns = (columns) => Array.isArray(columns) ? [...columns] : [columns];
var normalizeIndexKeys = (keys) => keys.map((key2) => ("expression" in key2) ? {
  kind: "expression",
  expression: key2.expression,
  order: key2.order,
  nulls: key2.nulls
} : {
  kind: "column",
  column: key2.column,
  order: key2.order,
  nulls: key2.nulls
});
var primaryKey3 = (input) => isObject(input) && ("columns" in input) ? option({
  kind: "primaryKey",
  columns: normalizeColumns(input.columns),
  name: input.name,
  deferrable: input.deferrable,
  initiallyDeferred: input.initiallyDeferred
}) : primaryKey(input);
var unique3 = (input) => isObject(input) && ("columns" in input) && (("name" in input) || ("nullsNotDistinct" in input) || ("deferrable" in input) || ("initiallyDeferred" in input)) ? option({
  kind: "unique",
  columns: normalizeColumns(input.columns),
  name: input.name,
  nullsNotDistinct: input.nullsNotDistinct,
  deferrable: input.deferrable,
  initiallyDeferred: input.initiallyDeferred
}) : unique(input);
var index3 = (input) => isObject(input) && (("keys" in input) || ("name" in input) || ("unique" in input) || ("method" in input) || ("include" in input) || ("predicate" in input)) ? option({
  kind: "index",
  columns: input.columns === undefined ? undefined : normalizeColumns(input.columns),
  keys: input.keys === undefined ? undefined : normalizeIndexKeys(input.keys),
  name: input.name,
  unique: input.unique,
  method: input.method,
  include: input.include,
  predicate: input.predicate
}) : index(input);
var foreignKey2 = (columnsOrSpec, target, referencedColumns) => isObject(columnsOrSpec) && ("columns" in columnsOrSpec) && ("target" in columnsOrSpec) ? (() => {
  const spec = columnsOrSpec;
  const targetTable = spec.target();
  const targetState = targetTable[TypeId4];
  return option({
    kind: "foreignKey",
    columns: normalizeColumns(spec.columns),
    name: spec.name,
    references: () => ({
      tableName: targetState.baseName,
      schemaName: targetState.schemaName,
      columns: normalizeColumns(spec.referencedColumns),
      knownColumns: Object.keys(targetState.fields)
    }),
    onUpdate: spec.onUpdate,
    onDelete: spec.onDelete,
    deferrable: spec.deferrable,
    initiallyDeferred: spec.initiallyDeferred
  });
})() : foreignKey(columnsOrSpec, target, referencedColumns);
var check2 = (nameOrSpec, predicate) => isObject(nameOrSpec) ? option({
  kind: "check",
  name: nameOrSpec.name,
  predicate: nameOrSpec.predicate,
  noInherit: nameOrSpec.noInherit
}) : check(nameOrSpec, predicate);
// src/postgres/renderer.ts
var exports_renderer2 = {};
__export(exports_renderer2, {
  postgres: () => postgres3,
  make: () => make8,
  TypeId: () => TypeId9
});
function make8(dialectOrRender, render2) {
  const customRender = typeof dialectOrRender === "function" ? dialectOrRender : render2;
  return customRender ? make5("postgres", customRender) : make5("postgres");
}
var postgres3 = make8();
export {
  schema3 as schema,
  exports_table2 as Table,
  exports_schema_expression2 as SchemaExpression,
  exports_renderer2 as Renderer,
  exports_query2 as Query,
  exports_plan as Plan,
  exports_metadata as Metadata,
  exports_function as Function,
  exports_expression as Expression,
  exports_executor as Executor,
  exports_errors as Errors,
  exports_datatypes as Datatypes,
  exports_column as Column
};
