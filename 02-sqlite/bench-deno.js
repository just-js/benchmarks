import { DB } from "https://deno.land/x/sqlite/mod.ts"
import { nextTick } from "https://deno.land/std@0.126.0/node/_next_tick.ts"

const db = new DB(':memory:')

db.query('PRAGMA auto_vacuum = none')
db.query('PRAGMA temp_store = memory')
db.query('PRAGMA locking_mode = exclusive')
db.query('PRAGMA user_version = 100')

const sql = 'pragma user_version'

function createQuery (sql) {
  return db.prepareQuery(sql)
}

let total = parseInt(Deno.args[0], 10)
const runs = parseInt(Deno.args[1], 10)

function bench (query) {
  const start = Date.now()
  for (let i = 0; i < runs; i++) query()
  const elapsed = Date.now() - start
  const rate = Math.floor(runs / (elapsed / 1000))
  const { rss } = Deno.memoryUsage()
  console.log(`time ${elapsed} ms rate ${rate} rss ${rss}`)
  if (--total) nextTick(() => bench(query))
}

const query = createQuery(sql)
bench(() => query.one())
