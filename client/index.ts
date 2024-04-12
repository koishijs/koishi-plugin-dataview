import { Context, Schema } from '@koishijs/client'
import { } from 'koishi-plugin-dataview/src'
import Database from './index.vue'
import './icons'

declare module '@koishijs/client' {
  interface Config {
    dataview?: {
      autoStats?: boolean
      color?: boolean
      colors?: TypeColor[]
    }
  }
}

const FieldType = [
  'primary',
  'integer', 'unsigned', 'float', 'double', 'decimal',
  'char', 'string', 'text',
  'boolean',
  'timestamp', 'date', 'time',
  'binary',
  'list', 'json',
  'expr',
] as const

type FieldType = typeof FieldType[number]

interface TypeColor {
  color?: string
  types?: FieldType[]
}

const TypeColor: Schema<TypeColor> = Schema.object({
  color: Schema.string().role('color'),
  types: Schema.array(Schema.union(FieldType)).default([]).role('select'),
})

const defaultTypeColors: TypeColor[] = [
  { color: 'rgba(249,100,94,0.6)', types: ['char', 'string', 'text'] },
  { color: 'rgba(251,163,81,0.6)', types: ['list', 'json'] },
  { color: 'rgba(31,200,155,0.6)', types: ['boolean'] },
  { color: 'rgba(115,202,81,0.6)', types: ['unsigned', 'integer'] },
  { color: 'rgba(134,217,152,0.6)', types: ['float', 'double', 'decimal'] },
  { color: 'rgba(207,139,225,0.6)', types: ['timestamp', 'date', 'time'] },
] as const

export const schema = Schema.object({
  dataview: Schema.object({
    autoStats: Schema.boolean().default(true).description('刷新时自动同步'),
    color: Schema.boolean().default(false).description('默认启用类型染色'),
    colors: Schema.array(TypeColor).default(defaultTypeColors).role('table'),
  }),
})

export default (ctx: Context) => {
  ctx.settings({
    id: 'dataview',
    title: '数据库设置',
    schema,
  })

  ctx.page({
    path: '/database/:name*',
    name: '数据库',
    icon: 'database',
    order: 410,
    authority: 4,
    fields: ['database'],
    component: Database,
  })
}
