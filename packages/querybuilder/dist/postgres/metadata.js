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
export {
  toTableModel,
  toEnumModel,
  tableKey,
  renderDdlExpressionSql,
  normalizeDdlExpressionSql,
  isTableDefinition,
  isEnumDefinition,
  fromDiscoveredValues,
  enumKey,
  EnumTypeId
};
