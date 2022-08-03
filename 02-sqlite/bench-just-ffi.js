const sqlite = require('lib/just/sqlite-ffi.js')
const { open2, exec, prepareStatement, v2 } = sqlite

const defaultFlags = v2.SQLITE_OPEN_READWRITE | v2.SQLITE_OPEN_PRIVATECACHE | 
  v2.SQLITE_OPEN_NOMUTEX | v2.SQLITE_OPEN_CREATE | v2.SQLITE_OPEN_MEMORY
const db = open2(':memory:', defaultFlags)

exec(db, 'PRAGMA auto_vacuum = none')
exec(db, 'PRAGMA temp_store = memory')
exec(db, 'PRAGMA locking_mode = exclusive')
exec(db, 'PRAGMA user_version = 100')

const sql = 'pragma user_version'

let total = parseInt(just.args[2], 10)
const runs = parseInt(just.args[3], 10)

function bench (query) {
  const start = Date.now()
  for (let i = 0; i < runs; i++) query()
  const elapsed = Date.now() - start
  const rate = Math.floor(runs / (elapsed / 1000))
  just.print(`time ${elapsed} ms rate ${rate}`)
  if (--total) just.sys.nextTick(() => bench(query))
}

bench(prepareStatement(db, sql))
