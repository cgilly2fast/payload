import type { DBQueryConfig } from 'drizzle-orm'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import type { Field, JoinQuery, SelectMode, SelectType } from 'payload'

import { and, eq, sql } from 'drizzle-orm'
import { fieldAffectsData, fieldIsVirtual, tabHasName } from 'payload/shared'
import toSnakeCase from 'to-snake-case'

import type { BuildQueryJoinAliases, ChainedMethods, DrizzleAdapter } from '../types.js'
import type { Result } from './buildFindManyArgs.js'

import buildQuery from '../queries/buildQuery.js'
import { chainMethods } from './chainMethods.js'

type TraverseFieldArgs = {
  _locales: Result
  adapter: DrizzleAdapter
  currentArgs: Result
  currentTableName: string
  depth?: number
  fields: Field[]
  joinQuery: JoinQuery
  joins?: BuildQueryJoinAliases
  locale?: string
  path: string
  select?: SelectType
  selectAllOnCurrentLevel?: boolean
  selectMode?: SelectMode
  tablePath: string
  topLevelArgs: Record<string, unknown>
  topLevelTableName: string
  withinLocalizedField?: boolean
  withTabledFields: {
    numbers?: boolean
    rels?: boolean
    texts?: boolean
  }
}

export const traverseFields = ({
  _locales,
  adapter,
  currentArgs,
  currentTableName,
  depth,
  fields,
  joinQuery = {},
  joins,
  locale,
  path,
  select,
  selectAllOnCurrentLevel = false,
  selectMode,
  tablePath,
  topLevelArgs,
  topLevelTableName,
  withinLocalizedField = false,
  withTabledFields,
}: TraverseFieldArgs) => {
  fields.forEach((field) => {
    if (fieldIsVirtual(field)) {
      return
    }

    // handle simple relationship
    if (
      depth > 0 &&
      (field.type === 'upload' || field.type === 'relationship') &&
      !field.hasMany &&
      typeof field.relationTo === 'string'
    ) {
      if (field.localized) {
        _locales.with[`${path}${field.name}`] = true
      } else {
        currentArgs.with[`${path}${field.name}`] = true
      }
    }

    if (field.type === 'collapsible' || field.type === 'row') {
      traverseFields({
        _locales,
        adapter,
        currentArgs,
        currentTableName,
        depth,
        fields: field.fields,
        joinQuery,
        joins,
        path,
        select,
        selectMode,
        tablePath,
        topLevelArgs,
        topLevelTableName,
        withTabledFields,
      })

      return
    }

    if (field.type === 'tabs') {
      field.tabs.forEach((tab) => {
        const tabPath = tabHasName(tab) ? `${path}${tab.name}_` : path
        const tabTablePath = tabHasName(tab) ? `${tablePath}${toSnakeCase(tab.name)}_` : tablePath

        const tabSelect = tabHasName(tab) ? select?.[tab.name] : select

        if (tabSelect === false) {
          return
        }

        let tabSelectAllOnCurrentLevel = selectAllOnCurrentLevel

        if (tabHasName(tab) && select && !tabSelectAllOnCurrentLevel) {
          tabSelectAllOnCurrentLevel =
            select[tab.name] === true ||
            (selectMode === 'exclude' && typeof select[tab.name] === 'undefined')
        }

        traverseFields({
          _locales,
          adapter,
          currentArgs,
          currentTableName,
          depth,
          fields: tab.fields,
          joinQuery,
          joins,
          path: tabPath,
          select: typeof tabSelect === 'object' ? tabSelect : undefined,
          selectAllOnCurrentLevel: tabSelectAllOnCurrentLevel,
          selectMode,
          tablePath: tabTablePath,
          topLevelArgs,
          topLevelTableName,
          withTabledFields,
        })
      })

      return
    }

    if (fieldAffectsData(field)) {
      switch (field.type) {
        case 'array': {
          const arraySelect = selectAllOnCurrentLevel ? true : select?.[field.name]

          if (select) {
            if (
              (selectMode === 'include' && typeof arraySelect === 'undefined') ||
              (selectMode === 'exclude' && arraySelect === false)
            ) {
              break
            }
          }

          const withArray: Result = {
            columns:
              typeof arraySelect === 'object'
                ? {
                    id: true,
                    _order: true,
                  }
                : {
                    _parentID: false,
                  },
            orderBy: ({ _order }, { asc }) => [asc(_order)],
            with: {},
          }

          const arrayTableName = adapter.tableNameMap.get(
            `${currentTableName}_${tablePath}${toSnakeCase(field.name)}`,
          )

          if (typeof arraySelect === 'object') {
            if (adapter.tables[arrayTableName]._locale) {
              withArray.columns._locale = true
            }

            if (adapter.tables[arrayTableName]._uuid) {
              withArray.columns._uuid = true
            }
          }

          const arrayTableNameWithLocales = `${arrayTableName}${adapter.localesSuffix}`

          if (adapter.tables[arrayTableNameWithLocales]) {
            withArray.with._locales = {
              columns:
                typeof arraySelect === 'object'
                  ? {
                      _locale: true,
                    }
                  : {
                      id: false,
                      _parentID: false,
                    },
              with: {},
            }
          }

          currentArgs.with[`${path}${field.name}`] = withArray

          traverseFields({
            _locales: withArray.with._locales,
            adapter,
            currentArgs: withArray,
            currentTableName: arrayTableName,
            depth,
            fields: field.fields,
            joinQuery,
            path: '',
            select: typeof arraySelect === 'object' ? arraySelect : undefined,
            selectMode,
            tablePath: '',
            topLevelArgs,
            topLevelTableName,
            withinLocalizedField: withinLocalizedField || field.localized,
            withTabledFields,
          })

          if (
            typeof arraySelect === 'object' &&
            withArray.with._locales &&
            Object.keys(withArray.with._locales).length === 1
          ) {
            delete withArray.with._locales
          }

          break
        }

        case 'select': {
          if (field.hasMany) {
            if (select) {
              if (
                (selectMode === 'include' && !select[field.name]) ||
                (selectMode === 'exclude' && select[field.name] === false)
              ) {
                break
              }
            }

            const withSelect: Result = {
              columns: {
                id: false,
                order: false,
                parent: false,
              },
              orderBy: ({ order }, { asc }) => [asc(order)],
            }

            currentArgs.with[`${path}${field.name}`] = withSelect
          }

          break
        }

        case 'blocks': {
          const blocksSelect = selectAllOnCurrentLevel ? true : select?.[field.name]

          if (select) {
            if (
              (selectMode === 'include' && !blocksSelect) ||
              (selectMode === 'exclude' && blocksSelect === false)
            ) {
              break
            }
          }

          field.blocks.forEach((block) => {
            const blockKey = `_blocks_${block.slug}`

            let blockSelect: boolean | SelectType | undefined

            let blockSelectMode = selectMode

            if (selectMode === 'include' && blocksSelect === true) {
              blockSelect = true
            }

            if (typeof blocksSelect === 'object') {
              if (typeof blocksSelect[block.slug] === 'object') {
                blockSelect = blocksSelect[block.slug]
              } else if (
                (selectMode === 'include' && typeof blocksSelect[block.slug] === 'undefined') ||
                (selectMode === 'exclude' && blocksSelect[block.slug] === false)
              ) {
                blockSelect = {}
                blockSelectMode = 'include'
              } else if (selectMode === 'include' && blocksSelect[block.slug] === true) {
                blockSelect = true
              }
            }

            if (!topLevelArgs[blockKey]) {
              const withBlock: Result = {
                columns:
                  typeof blockSelect === 'object'
                    ? {
                        id: true,
                        _order: true,
                        _path: true,
                      }
                    : {
                        _parentID: false,
                      },
                orderBy: ({ _order }, { asc }) => [asc(_order)],
                with: {},
              }

              const tableName = adapter.tableNameMap.get(
                `${topLevelTableName}_blocks_${toSnakeCase(block.slug)}`,
              )

              if (typeof blockSelect === 'object') {
                if (adapter.tables[tableName]._locale) {
                  withBlock.columns._locale = true
                }

                if (adapter.tables[tableName]._uuid) {
                  withBlock.columns._uuid = true
                }
              }

              if (adapter.tables[`${tableName}${adapter.localesSuffix}`]) {
                withBlock.with._locales = {
                  with: {},
                }

                if (typeof blockSelect === 'object') {
                  withBlock.with._locales.columns = {
                    _locale: true,
                  }
                }
              }
              topLevelArgs.with[blockKey] = withBlock

              traverseFields({
                _locales: withBlock.with._locales,
                adapter,
                currentArgs: withBlock,
                currentTableName: tableName,
                depth,
                fields: block.fields,
                joinQuery,
                path: '',
                select: typeof blockSelect === 'object' ? blockSelect : undefined,
                selectMode: blockSelectMode,
                tablePath: '',
                topLevelArgs,
                topLevelTableName,
                withinLocalizedField: withinLocalizedField || field.localized,
                withTabledFields,
              })

              if (
                typeof blockSelect === 'object' &&
                withBlock.with._locales &&
                Object.keys(withBlock.with._locales.columns).length === 1
              ) {
                delete withBlock.with._locales
              }
            }
          })

          break
        }

        case 'group': {
          const groupSelect = select?.[field.name]

          if (groupSelect === false) {
            break
          }

          traverseFields({
            _locales,
            adapter,
            currentArgs,
            currentTableName,
            depth,
            fields: field.fields,
            joinQuery,
            joins,
            path: `${path}${field.name}_`,
            select: typeof groupSelect === 'object' ? groupSelect : undefined,
            selectAllOnCurrentLevel:
              selectAllOnCurrentLevel ||
              groupSelect === true ||
              (selectMode === 'exclude' && typeof groupSelect === 'undefined'),
            selectMode,
            tablePath: `${tablePath}${toSnakeCase(field.name)}_`,
            topLevelArgs,
            topLevelTableName,
            withinLocalizedField: withinLocalizedField || field.localized,
            withTabledFields,
          })

          break
        }

        case 'join': {
          // when `joinsQuery` is false, do not join
          if (joinQuery === false) {
            break
          }
          const {
            limit: limitArg = 10,
            sort,
            where,
          } = joinQuery[`${path.replaceAll('_', '.')}${field.name}`] || {}
          let limit = limitArg
          if (limit !== 0) {
            // get an additional document and slice it later to determine if there is a next page
            limit += 1
          }

          const fields = adapter.payload.collections[field.collection].config.fields
          const joinCollectionTableName = adapter.tableNameMap.get(toSnakeCase(field.collection))
          let joinTableName = `${adapter.tableNameMap.get(toSnakeCase(field.collection))}${
            field.localized && adapter.payload.config.localization ? adapter.localesSuffix : ''
          }`

          if (field.hasMany) {
            const db = adapter.drizzle as LibSQLDatabase
            if (field.localized) {
              joinTableName = adapter.tableNameMap.get(toSnakeCase(field.collection))
            }
            const joinTable = `${joinTableName}${adapter.relationshipsSuffix}`

            const joins: BuildQueryJoinAliases = [
              {
                type: 'innerJoin',
                condition: and(
                  eq(adapter.tables[joinTable].parent, adapter.tables[joinTableName].id),
                  eq(
                    sql.raw(`"${joinTable}"."${topLevelTableName}_id"`),
                    adapter.tables[currentTableName].id,
                  ),
                  eq(adapter.tables[joinTable].path, field.on),
                ),
                table: adapter.tables[joinTable],
              },
            ]

            const { orderBy, where: subQueryWhere } = buildQuery({
              adapter,
              fields,
              joins,
              locale,
              sort,
              tableName: joinCollectionTableName,
              where: {},
            })

            const chainedMethods: ChainedMethods = []

            joins.forEach(({ type, condition, table }) => {
              chainedMethods.push({
                args: [table, condition],
                method: type ?? 'leftJoin',
              })
            })

            const subQuery = chainMethods({
              methods: chainedMethods,
              query: db
                .select({
                  id: adapter.tables[joinTableName].id,
                  ...(field.localized && {
                    locale: adapter.tables[joinTable].locale,
                  }),
                })
                .from(adapter.tables[joinTableName])
                .where(subQueryWhere)
                .orderBy(orderBy.order(orderBy.column))
                .limit(limit),
            })

            const columnName = `${path.replaceAll('.', '_')}${field.name}`

            const jsonObjectSelect = field.localized
              ? sql.raw(`'_parentID', "id", '_locale', "locale"`)
              : sql.raw(`'id', "id"`)

            if (adapter.name === 'sqlite') {
              currentArgs.extras[columnName] = sql`
              COALESCE((
                SELECT json_group_array(json_object(${jsonObjectSelect}))
                FROM (
                  ${subQuery}
                ) AS ${sql.raw(`${columnName}_sub`)}
              ), '[]')
            `.as(columnName)
            } else {
              currentArgs.extras[columnName] = sql`
              COALESCE((
                SELECT json_agg(json_build_object(${jsonObjectSelect}))
                FROM (
                  ${subQuery}
                ) AS ${sql.raw(`${columnName}_sub`)}
              ), '[]'::json)
            `.as(columnName)
            }

            break
          }

          const selectFields = {}

          const withJoin: DBQueryConfig<'many', true, any, any> = {
            columns: selectFields,
          }
          if (limit) {
            withJoin.limit = limit
          }

          if (field.localized) {
            withJoin.columns._locale = true
            withJoin.columns._parentID = true
          } else {
            withJoin.columns.id = true
            withJoin.columns.parent = true
          }
          const { orderBy, where: joinWhere } = buildQuery({
            adapter,
            fields,
            joins,
            locale,
            sort,
            tableName: joinTableName,
            where,
          })
          if (joinWhere) {
            withJoin.where = () => joinWhere
          }
          withJoin.orderBy = orderBy.order(orderBy.column)
          currentArgs.with[`${path.replaceAll('.', '_')}${field.name}`] = withJoin
          break
        }

        default: {
          if (!select && !selectAllOnCurrentLevel) {
            break
          }

          if (
            selectAllOnCurrentLevel ||
            (selectMode === 'include' && select[field.name] === true) ||
            (selectMode === 'exclude' && typeof select[field.name] === 'undefined')
          ) {
            const fieldPath = `${path}${field.name}`

            if ((field.localized || withinLocalizedField) && _locales) {
              _locales.columns[fieldPath] = true
            } else if (adapter.tables[currentTableName]?.[fieldPath]) {
              currentArgs.columns[fieldPath] = true
            }

            if (
              !withTabledFields.rels &&
              field.type === 'relationship' &&
              (field.hasMany || Array.isArray(field.relationTo))
            ) {
              withTabledFields.rels = true
            }

            if (!withTabledFields.numbers && field.type === 'number' && field.hasMany) {
              withTabledFields.numbers = true
            }

            if (!withTabledFields.texts && field.type === 'text' && field.hasMany) {
              withTabledFields.texts = true
            }
          }

          break
        }
      }
    }
  })

  return topLevelArgs
}
