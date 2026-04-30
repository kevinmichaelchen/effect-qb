import type * as Expression from "./expression.js"
import type { RenderState, SqlDialect } from "./dialect.js"
import { postgresDialect } from "./postgres-dialect.js"
import * as SchemaExpression from "./schema-expression.js"
import { renderExpression } from "./sql-expression-renderer.js"
import type { DdlExpressionLike } from "./table-options.js"
import { parse, toSql, type Expr } from "pgsql-ast-parser"

export const renderDdlExpression = (
  expression: DdlExpressionLike,
  state: RenderState,
  dialect: SqlDialect
): string =>
  SchemaExpression.isSchemaExpression(expression)
    ? SchemaExpression.render(expression)
    : renderExpression(expression as Expression.Any, state, dialect)

const escapeString = (value: string): string => `'${value.replaceAll("'", "''")}'`

const inlineLiteralDialect: SqlDialect<"postgres"> = {
  ...postgresDialect,
  renderLiteral(value) {
    if (value === null) {
      return "null"
    }
    if (typeof value === "boolean") {
      return value ? "true" : "false"
    }
    if (typeof value === "number" || typeof value === "bigint") {
      return String(value)
    }
    if (value instanceof Date) {
      return escapeString(value.toISOString())
    }
    return escapeString(String(value))
  }
}

export const renderDdlExpressionSql = (expression: DdlExpressionLike): string =>
  SchemaExpression.isSchemaExpression(expression)
    ? SchemaExpression.render(expression)
    : renderExpression(expression as Expression.Any, {
        params: [],
        ctes: [],
        cteNames: new Set()
      }, inlineLiteralDialect)

type ExpressionRecord = {
  readonly [key: string]: unknown
}

const isExpressionRecord = (value: unknown): value is ExpressionRecord =>
  typeof value === "object" && value !== null

const isAnyArrayCall = (value: unknown): value is {
  readonly type: "call"
  readonly function: {
    readonly name: string
  }
  readonly args: readonly [{
    readonly type: "array"
    readonly expressions: readonly unknown[]
  }]
} =>
  isExpressionRecord(value) &&
  value.type === "call" &&
  isExpressionRecord(value.function) &&
  typeof value.function.name === "string" &&
  value.function.name.toLowerCase() === "any" &&
  Array.isArray(value.args) &&
  value.args.length === 1 &&
  isExpressionRecord(value.args[0]) &&
  value.args[0].type === "array" &&
  Array.isArray(value.args[0].expressions)

const canonicalizeExpressionNode = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonicalizeExpressionNode)
  }
  if (!isExpressionRecord(value)) {
    return value
  }

  const normalized: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    normalized[key] = canonicalizeExpressionNode(child)
  }

  if (
    normalized.type === "binary" &&
    typeof normalized.op === "string" &&
    normalized.op.toLowerCase() === "=" &&
    isAnyArrayCall(normalized.right)
  ) {
    return {
      ...normalized,
      op: "IN",
      right: {
        type: "list",
        expressions: normalized.right.args[0].expressions
      }
    }
  }

  return normalized
}

const canonicalizeDdlExpressionAst = (expression: Expr): Expr =>
  canonicalizeExpressionNode(expression) as Expr

export const normalizeDdlExpressionSql = (expression: DdlExpressionLike): string => {
  const rendered = renderDdlExpressionSql(expression)
  try {
    return toSql.expr(canonicalizeDdlExpressionAst(parse(rendered, "expr")))
  } catch {
    return rendered.trim()
  }
}
