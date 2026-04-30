export interface ColumnModel {
  readonly name: string
  readonly dataType?: string
  readonly nullable?: boolean
}

export interface TableModel {
  readonly name: string
  readonly schemaName?: string
  readonly columns: readonly ColumnModel[]
}

export interface EnumModel {
  readonly name: string
  readonly schemaName?: string
  readonly values: readonly string[]
}

export interface SchemaModel {
  readonly tables: readonly TableModel[]
  readonly enums: readonly EnumModel[]
}

export type AnyDefinition = unknown
export type EnumDefinition = unknown
export type DdlExpressionLike = unknown
export type IndexKeySpec = unknown
export type ReferentialAction = "cascade" | "restrict" | "setNull" | "setDefault" | "noAction"
export type TableOptionSpec = unknown

export const EnumTypeId: unique symbol
export const tableKey: (schemaName: string | undefined, tableName: string) => string
export const enumKey: (schemaName: string | undefined, enumName: string) => string
export const isTableDefinition: (value: unknown) => boolean
export const isEnumDefinition: (value: unknown) => boolean
export const fromDiscoveredValues: (values: readonly unknown[]) => SchemaModel
export const toTableModel: (value: unknown) => TableModel
export const toEnumModel: (value: unknown) => EnumModel
export const normalizeDdlExpressionSql: (value: unknown) => string
export const renderDdlExpressionSql: (value: unknown) => string
