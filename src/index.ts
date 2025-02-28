import { clone, Context, Dict, Driver, Field, makeArray, Model, omit, Schema, Type } from 'koishi'
import { DataService } from '@koishijs/console'
import { resolve } from 'path'
import { deserialize, serialize } from './utils'

export * from './utils'

export type Methods = 'get' | 'set' | 'eval' | 'create' | 'remove' | 'upsert' | 'drop' | 'stats'

export type DbEvents = {
  [M in Methods as `database/${M}`]: (...args: string[]) => Promise<string>
}

declare module '@koishijs/console' {
  namespace Console {
    interface Services {
      database: DatabaseProvider
    }
  }

  interface Events extends DbEvents {}
}

export interface TableInfo extends Driver.TableStats, Model.Config<any> {
  fields: Field.Config
  primary: string[]
  HookObjectId: (value: any) => void
}

export interface DatabaseInfo extends Driver.Stats {
  tables: Dict<TableInfo>
}

class DatabaseProvider extends DataService<DatabaseInfo> {
  static filter = false
  static inject = ['console', 'database']

  task: Promise<DatabaseInfo>

  addListener<K extends Methods>(name: K, refresh = false) {
    this.ctx.console.addListener(`database/${name}`, async (...args) => {
      const callargs: any[] = args.map(deserialize)
      if (['set', 'remove'].includes(name)) {
        const table = (await this.get()).tables[callargs[0]]!
        if (table.HookObjectId) {
          callargs[1][table.primary[0]] = new table.HookObjectId(callargs[1][table.primary[0]])
        }
      }
      const result = await (this.ctx.database[name] as any)(...callargs)
      if (refresh) this.refresh()
      return result === undefined ? result : serialize(result)
    }, { authority: 4 })
  }

  constructor(ctx: Context) {
    super(ctx, 'database', { authority: 4 })

    ctx.console.addEntry(process.env.KOISHI_BASE ? [
      process.env.KOISHI_BASE + '/dist/index.js',
      process.env.KOISHI_BASE + '/dist/style.css',
    ] : process.env.KOISHI_ENV === 'browser' ? [
      // @ts-ignore
      import.meta.url.replace(/\/src\/[^/]+$/, '/client/index.ts'),
    ] : {
      dev: resolve(__dirname, '../client/index.ts'),
      prod: resolve(__dirname, '../dist'),
    })

    this.addListener('create', true)
    this.addListener('eval', true)
    this.addListener('get')
    this.addListener('remove', true)
    this.addListener('set')
    this.addListener('stats', true)
    this.addListener('upsert', true)

    const refresh = ctx.throttle(() => this.refresh(), 500)
    ctx.on('model', () => refresh())
  }

  async getInfo() {
    const stats = await this.ctx.database.stats()
    const result = { tables: {}, ...stats } as DatabaseInfo
    const tableStats = result.tables
    result.tables = {}
    await Promise.all(Object.keys(this.ctx.model.tables).map(async name => {
      result.tables[name] = {
        ...clone(omit(this.ctx.model.tables[name], ['ctx'])),
        ...tableStats[name],
      }
      result.tables[name].primary = makeArray(result.tables[name].primary)
      for (const [key, field] of Object.entries(result.tables[name].fields)) {
        if (!Field.available(field)) delete result.tables[name].fields[key]
      }
      if ((result.tables[name].fields[result.tables[name].primary[0]]?.type as Type)?.type === 'primary'
       && ['mongo', 'MongoDriver'].includes(Object.values(this.ctx.database.drivers)[0].constructor.name)) {
        const record = await this.ctx.database.select(name as any).limit(1).execute()
        result.tables[name].HookObjectId = record[0]?.[result.tables[name].primary[0]]?.constructor
      }
    }))
    result.tables = Object.fromEntries(Object.entries(result.tables).sort(([a], [b]) => a.localeCompare(b)))
    return result
  }

  get(forced = false) {
    if (forced) delete this.task
    return this.task ||= this.getInfo()
  }
}

namespace DatabaseProvider {
  export interface Config {}

  export const Config: Schema<Config> = Schema.object({})
}

export default DatabaseProvider
