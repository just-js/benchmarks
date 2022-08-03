const { Database, constants, sqlite } = require('@sqlite')

const { v2 } = constants
const defaultFlags = v2.SQLITE_OPEN_READWRITE | v2.SQLITE_OPEN_PRIVATECACHE | 
  v2.SQLITE_OPEN_NOMUTEX | v2.SQLITE_OPEN_CREATE | v2.SQLITE_OPEN_MEMORY

const db = (new Database(':memory:')).open(defaultFlags)

db.exec('PRAGMA auto_vacuum = none')
db.exec('PRAGMA temp_store = memory')
db.exec('PRAGMA locking_mode = exclusive')
db.exec('PRAGMA user_version = 100')

const sql = 'pragma user_version'

function createQuery (sql) {
  const stmt = sqlite.prepare(db.db, sql)
  const { SQLITE_ROW } = constants
  const { step, columnInt, reset, finalize } = sqlite
  return () => {
    if (step(stmt) === SQLITE_ROW) {
      const value = columnInt(stmt, 0)
      reset(stmt)
      return value
    }
    finalize(stmt)
    return 0
  }
}

const args = just.args[0] === 'just' ? just.args.slice(2) : just.args.slice(1)
let total = parseInt(args[0], 10)
const runs = parseInt(args[1], 10)

function bench (query) {
  const start = Date.now()
  for (let i = 0; i < runs; i++) query()
  const elapsed = Date.now() - start
  const rate = Math.floor(runs / (elapsed / 1000))
  just.print(`time ${elapsed} ms rate ${rate}`)
  if (--total) just.sys.nextTick(() => bench(query))
}

bench(createQuery(sql))

