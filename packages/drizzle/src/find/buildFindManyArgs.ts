import type { DBQueryConfig } from 'drizzle-orm'
import type { Field, JoinQuery, SelectType } from 'payload'

import { getSelectMode } from 'payload/shared'

import type { BuildQueryJoinAliases, DrizzleAdapter } from '../types.js'

import { traverseFields } from './traverseFields.js'

type BuildFindQueryArgs = {
  adapter: DrizzleAdapter
  depth: number
  fields: Field[]
  joinQuery?: JoinQuery
  /**
   * The joins array will be mutated by pushing any joins needed for the where queries of join field joins
   */
  joins?: BuildQueryJoinAliases
  locale?: string
  select?: SelectType
  tableName: string
}

export type Result = {
  with?: {
    _locales?: DBQueryConfig<'many', true, any, any>
  } & DBQueryConfig<'many', true, any, any>
} & DBQueryConfig<'many', true, any, any>

// Generate the Drizzle query for findMany based on
// a collection field structure
export const buildFindManyArgs = ({
  adapter,
  depth,
  fields,
  joinQuery,
  joins = [],
  locale,
  select,
  tableName,
}: BuildFindQueryArgs): Record<string, unknown> => {
  const result: Result = {
    extras: {},
    with: {},
  }

  if (select) {
    result.columns = {
      id: true,
    }
  }

  const _locales: Result = {
    columns: select
      ? { _locale: true }
      : {
          id: false,
          _parentID: false,
        },
    extras: {},
    with: {},
  }

  if (adapter.tables[`${tableName}_texts`]) {
    result.with._texts = {
      columns: {
        id: false,
        parent: false,
      },
      orderBy: ({ order }, { asc: ASC }) => [ASC(order)],
    }
  }

  if (adapter.tables[`${tableName}_numbers`]) {
    result.with._numbers = {
      columns: {
        id: false,
        parent: false,
      },
      orderBy: ({ order }, { asc: ASC }) => [ASC(order)],
    }
  }

  if (adapter.tables[`${tableName}${adapter.relationshipsSuffix}`]) {
    result.with._rels = {
      columns: {
        id: false,
        parent: false,
      },
      orderBy: ({ order }, { asc: ASC }) => [ASC(order)],
    }
  }

  traverseFields({
    _locales,
    adapter,
    currentArgs: result,
    currentTableName: tableName,
    depth,
    fields,
    joinQuery,
    joins,
    locale,
    path: '',
    select,
    selectMode: select ? getSelectMode(select) : undefined,
    tablePath: '',
    topLevelArgs: result,
    topLevelTableName: tableName,
  })

  if (
    adapter.tables[`${tableName}${adapter.localesSuffix}`] &&
    (!select || Object.keys(_locales.columns).length > 1)
  ) {
    result.with._locales = _locales
  }

  return result
}
