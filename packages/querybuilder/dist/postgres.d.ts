import type * as Effect from "effect/Effect"
import type * as Schema from "effect/Schema"
import type * as SqlClient from "effect/unstable/sql/SqlClient"

export namespace Expression {
  export interface Any {
    readonly _tag: "Expression"
  }
}

export namespace Column {
  export interface ColumnDefinition<Runtime = unknown> {
    readonly _tag: "ColumnDefinition"
    readonly pipe: (...operators: readonly ColumnOperator[]) => ColumnDefinition<Runtime>
  }

  export type ColumnOperator = (column: ColumnDefinition) => ColumnDefinition
}

export const Column: {
  readonly text: () => Column.ColumnDefinition<string>
  readonly int: () => Column.ColumnDefinition<number>
  readonly int8: () => Column.ColumnDefinition<number | string>
  readonly number: (options?: { readonly precision?: number; readonly scale?: number }) => Column.ColumnDefinition<number>
  readonly boolean: () => Column.ColumnDefinition<boolean>
  readonly date: () => Column.ColumnDefinition<string>
  readonly timestamptz: () => Column.ColumnDefinition<string>
  readonly jsonb: (schema?: Schema.Schema<unknown>) => Column.ColumnDefinition<unknown>
  readonly nullable: Column.ColumnOperator
  readonly default: (value: unknown) => Column.ColumnOperator
  readonly generated: (value: unknown) => Column.ColumnOperator
}

export namespace Table {
  export interface TableDefinition<Name extends string = string> {
    readonly _tag: "TableDefinition"
    readonly name: Name
    readonly schemas: {
      readonly select: Schema.Schema<unknown>
      readonly insert: Schema.Schema<unknown>
      readonly update: Schema.Schema<unknown>
    }
    readonly pipe: (...options: readonly TableOption[]) => TableDefinition<Name>
    readonly [column: string]: unknown
  }

  export type AnyTable = TableDefinition
  export interface TableOption {
    readonly _tag: "TableOption"
  }
  export type DdlExpressionLike = Expression.Any
  export type IndexKey = { readonly column?: string; readonly expression?: DdlExpressionLike; readonly order?: "asc" | "desc"; readonly nulls?: "first" | "last" }
  export type ReferentialAction = "cascade" | "restrict" | "setNull" | "setDefault" | "noAction"
  export type SelectOf<Table extends AnyTable> = unknown
  export type InsertOf<Table extends AnyTable> = unknown
  export type UpdateOf<Table extends AnyTable> = unknown
}

export const Table: {
  readonly make: <Name extends string>(name: Name, fields: Record<string, Column.ColumnDefinition>, schemaName?: string) => Table.TableDefinition<Name>
  readonly primaryKey: (spec: string | readonly string[] | { readonly columns: readonly string[]; readonly name?: string; readonly deferrable?: boolean; readonly initiallyDeferred?: boolean }) => Table.TableOption
  readonly unique: (spec: readonly string[] | { readonly columns: readonly string[]; readonly name?: string; readonly nullsNotDistinct?: boolean; readonly deferrable?: boolean; readonly initiallyDeferred?: boolean }) => Table.TableOption
  readonly index: (spec: readonly string[] | { readonly columns?: readonly string[]; readonly keys?: readonly Table.IndexKey[]; readonly name?: string; readonly unique?: boolean; readonly method?: string; readonly include?: readonly string[]; readonly predicate?: Table.DdlExpressionLike }) => Table.TableOption
  readonly foreignKey: (spec: { readonly columns: readonly string[]; readonly target: () => Table.AnyTable; readonly referencedColumns: readonly string[]; readonly name?: string; readonly onUpdate?: Table.ReferentialAction; readonly onDelete?: Table.ReferentialAction; readonly deferrable?: boolean; readonly initiallyDeferred?: boolean }) => Table.TableOption
  readonly check: (name: string, predicate: Table.DdlExpressionLike) => Table.TableOption
}

export namespace Query {
  export interface QueryPlan<Row = unknown> {
    readonly _tag: "QueryPlan"
    readonly __row?: Row
    readonly pipe: (...operators: readonly PlanTransform[]) => QueryPlan<Row>
  }

  export type ResultRows<Plan> = Plan extends QueryPlan<infer Row> ? readonly Row[] : readonly unknown[]
  export type RuntimeResultRows<Plan> = ResultRows<Plan>
  export type ResultRow<Plan> = Plan extends QueryPlan<infer Row> ? Row : unknown
  export type RuntimeResultRow<Plan> = ResultRow<Plan>
  export type CompletePlan<Plan> = Plan
  export type QueryStatement = string
}

type PlanTransform = <Plan extends Query.QueryPlan>(plan: Plan) => Plan
type ExpressionFactory = (...args: readonly unknown[]) => Expression.Any

export const Query: {
  readonly literal: <Value>(value: Value) => Expression.Any
  readonly column: (name: string, dbType: unknown, nullable?: boolean) => Expression.Any
  readonly cast: (value: unknown, target: unknown) => Expression.Any
  readonly type: Record<string, (...args: readonly unknown[]) => unknown>
  readonly eq: ExpressionFactory
  readonly neq: ExpressionFactory
  readonly lt: ExpressionFactory
  readonly lte: ExpressionFactory
  readonly gt: ExpressionFactory
  readonly gte: ExpressionFactory
  readonly isNull: ExpressionFactory
  readonly isNotNull: ExpressionFactory
  readonly like: ExpressionFactory
  readonly ilike: ExpressionFactory
  readonly and: ExpressionFactory
  readonly or: ExpressionFactory
  readonly not: ExpressionFactory
  readonly in: ExpressionFactory
  readonly notIn: ExpressionFactory
  readonly between: ExpressionFactory
  readonly exists: ExpressionFactory
  readonly select: <Selection extends Record<string, unknown>>(selection: Selection) => Query.QueryPlan<{ readonly [Key in keyof Selection]: unknown }>
  readonly from: (source: unknown) => PlanTransform
  readonly where: (predicate: unknown) => PlanTransform
  readonly orderBy: (...args: readonly unknown[]) => PlanTransform
  readonly limit: (count: number) => PlanTransform
  readonly offset: (count: number) => PlanTransform
  readonly insert: (table: Table.AnyTable) => Query.QueryPlan
  readonly update: (table: Table.AnyTable) => Query.QueryPlan
  readonly delete: (table: Table.AnyTable) => Query.QueryPlan
}

export const Function: {
  readonly currentTimestamp: () => Expression.Any
  readonly now: () => Expression.Any
  readonly nextVal: (value: unknown) => Expression.Any
  readonly count: (value?: unknown) => Expression.Any
  readonly lower: (value: unknown) => Expression.Any
  readonly upper: (value: unknown) => Expression.Any
}

export namespace Renderer {
  export interface RenderedQuery<Row = unknown> {
    readonly dialect: "postgres"
    readonly sql: string
    readonly params: readonly unknown[]
    readonly projections: readonly unknown[]
  }

  export interface Renderer {
    readonly dialect: "postgres"
    readonly render: <Plan extends Query.QueryPlan>(plan: Plan) => RenderedQuery<Query.ResultRow<Plan>>
  }
}

export const Renderer: {
  readonly make: () => Renderer.Renderer
}

export namespace Executor {
  export interface QueryExecutor<Context = SqlClient.SqlClient> {
    readonly dialect: "postgres"
    readonly execute: <Plan extends Query.QueryPlan>(plan: Plan) => Effect.Effect<Query.ResultRows<Plan>, unknown, Context>
  }

  export type PostgresQueryError<Plan> = unknown
  export type MysqlQueryError<Plan> = unknown
}

export const Executor: {
  readonly make: () => Executor.QueryExecutor
  readonly withTransaction: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
  readonly withSavepoint: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>
}

export const Datatypes: Record<string, unknown>
export const Errors: Record<string, unknown>
export const Plan: Record<string, unknown>
export const Metadata: Record<string, unknown>
export const SchemaExpression: Record<string, unknown>
export const schema: (name: string) => unknown
export type SchemaNamespace = unknown
