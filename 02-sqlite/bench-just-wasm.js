const { fs } = just.library('fs')

const v2 = {
  SQLITE_OPEN_READONLY        : 0x00000001,  /* Ok for sqlite3_open_v2() */
  SQLITE_OPEN_READWRITE       : 0x00000002,  /* Ok for sqlite3_open_v2() */
  SQLITE_OPEN_CREATE          : 0x00000004,  /* Ok for sqlite3_open_v2() */
  SQLITE_OPEN_DELETEONCLOSE   : 0x00000008,  /* VFS only */
  SQLITE_OPEN_EXCLUSIVE       : 0x00000010,  /* VFS only */
  SQLITE_OPEN_AUTOPROXY       : 0x00000020,  /* VFS only */
  SQLITE_OPEN_URI             : 0x00000040,  /* Ok for sqlite3_open_v2() */
  SQLITE_OPEN_MEMORY          : 0x00000080,  /* Ok for sqlite3_open_v2() */
  SQLITE_OPEN_MAIN_DB         : 0x00000100,  /* VFS only */
  SQLITE_OPEN_TEMP_DB         : 0x00000200,  /* VFS only */
  SQLITE_OPEN_TRANSIENT_DB    : 0x00000400,  /* VFS only */
  SQLITE_OPEN_MAIN_JOURNAL    : 0x00000800,  /* VFS only */
  SQLITE_OPEN_TEMP_JOURNAL    : 0x00001000,  /* VFS only */
  SQLITE_OPEN_SUBJOURNAL      : 0x00002000,  /* VFS only */
  SQLITE_OPEN_SUPER_JOURNAL   : 0x00004000,  /* VFS only */
  SQLITE_OPEN_NOMUTEX         : 0x00008000,  /* Ok for sqlite3_open_v2() */
  SQLITE_OPEN_FULLMUTEX       : 0x00010000,  /* Ok for sqlite3_open_v2() */
  SQLITE_OPEN_SHAREDCACHE     : 0x00020000,  /* Ok for sqlite3_open_v2() */
  SQLITE_OPEN_PRIVATECACHE    : 0x00040000,  /* Ok for sqlite3_open_v2() */
  SQLITE_OPEN_WAL             : 0x00080000,  /* VFS only */
  SQLITE_OPEN_NOFOLLOW        : 0x01000000,  /* Ok for sqlite3_open_v2() */
  SQLITE_OPEN_EXRESCODE       : 0x02000000  /* Extended result codes */
}

const walFlags = {
  SQLITE_SHM_UNLOCK: 1,
  SQLITE_SHM_LOCK: 2,
  SQLITE_SHM_SHARED: 4,
  SQLITE_SHM_EXCLUSIVE: 8,
  F_UNLCK: 2,
  F_RDLCK: 0,
  F_WRLCK: 1
}

const vfsFlags = {
  HTTP_FILE_NO_ACCESS:  0,
  HTTP_FILE_READONLY:   1,
  HTTP_FILE_READWRITE:  2,
  HTTP_NO_RANGE_REQUEST: 16
}

const fieldTypes = {
  SQLITE_INTEGER    : 1,
  SQLITE_FLOAT      : 2,
  SQLITE_TEXT       : 3,
  SQLITE_BLOB       : 4,
  SQLITE_NULL       : 5,
  SQLITE_INT64      : 6
}

const constants = {
  SQLITE_OK          : 0, // Successful result
  SQLITE_ERROR       : 1, // Generic error
  SQLITE_INTERNAL    : 2, // Internal logic error in SQLite
  SQLITE_PERM        : 3, // Access permission denied
  SQLITE_ABORT       : 4, // Callback routine requested an abort
  SQLITE_BUSY        : 5, // The database file is locked
  SQLITE_LOCKED      : 6, // A table in the database is locked
  SQLITE_NOMEM       : 7, // A malloc() failed
  SQLITE_READONLY    : 8, // Attempt to write a readonly database
  SQLITE_INTERRUPT   : 9, // Operation terminated by sqlite3_interrupt()
  SQLITE_IOERR      : 10, // Some kind of disk I/O error occurred
  SQLITE_CORRUPT    : 11, // The database disk image is malformed
  SQLITE_NOTFOUND   : 12, // Unknown opcode in sqlite3_file_control()
  SQLITE_FULL       : 13, // Insertion failed because database is full
  SQLITE_CANTOPEN   : 14, // Unable to open the database file
  SQLITE_PROTOCOL   : 15, // Database lock protocol error
  SQLITE_EMPTY      : 16, // Internal use only
  SQLITE_SCHEMA     : 17, // The database schema changed
  SQLITE_TOOBIG     : 18, // String or BLOB exceeds size limit
  SQLITE_CONSTRAINT : 19, // Abort due to constraint violation
  SQLITE_MISMATCH   : 20, // Data type mismatch
  SQLITE_MISUSE     : 21, // Library used incorrectly
  SQLITE_NOLFS      : 22, // Uses OS features not supported on host
  SQLITE_AUTH       : 23, // Authorization denied
  SQLITE_FORMAT     : 24, // Not used
  SQLITE_RANGE      : 25, // 2nd parameter to sqlite3_bind out of range
  SQLITE_NOTADB     : 26, // File opened that is not a database file
  SQLITE_NOTICE     : 27, // Notifications from sqlite3_log()
  SQLITE_WARNING    : 28, // Warnings from sqlite3_log()
  SQLITE_ROW        : 100, // sqlite3_step() has another row ready
  SQLITE_DONE       : 101 // sqlite3_step() has finished executing
}

class Pointer {
  constructor (memory, handle) {
    this.view = new Int32Array(memory.buffer)
    this.p = handle
  }

  get () {
    return this.view[this.p >> 2]
  }

  set (addr) {
    this.view[this.p >> 2] = addr
  }
}

class WASI {
  constructor(memory, env) {
    const wasi = this
    this.memory = memory
    this.view = new DataView(this.memory.buffer)
    this.WASI_ERRNO_SUCCESS = 0
    this.WASI_ERRNO_BADF = 8
    this.WASI_ERRNO_NOSYS = 52
    this.WASI_ERRNO_INVAL = 28
    this.WASI_FILETYPE_CHARACTER_DEVICE = 2
    this.WASI_RIGHTS_FD_SYNC = 1 << 4
    this.WASI_RIGHTS_FD_WRITE = 1 << 6
    this.WASI_RIGHTS_FD_FILESTAT_GET = 1 << 21
    this.WASI_FDFLAGS_APPEND = 1 << 0
    this.nameSpaces = {
      wasi_snapshot_preview1: {
        environ_get: (...args) => wasi.environ_get(env, ...args),
        environ_sizes_get: (...args) => wasi.environ_sizes_get(env, ...args),
        fd_fdstat_get: undefined,
        fd_write: undefined,
        fd_close: undefined,
        proc_exit: undefined,
        fd_seek: undefined
      },
    }
    for (const ns of Object.keys(this.nameSpaces)) {
      const nameSpace = this.nameSpaces[ns]
      for (const fn of Object.keys(nameSpace)) {
        const func = nameSpace[fn] || this.nosys(fn)
        nameSpace[fn] = func.bind(this)
      }
    }
  }

  initialize(instance) {
    instance.exports._initialize()
  }

  get imports() {
    return this.nameSpaces
  }

  nosys(name) {
    return (...args) => {
      just.error(`Unimplemented call to ${name}(${args.toString()})`)
      return this.WASI_ERRNO_NOSYS
    }
  }

  environ_get(env, environ, environBuf) {
    let coffset = environ
    let offset = environBuf
    Object.entries(env).forEach(
      ([key, value]) => {
        this.view.setUint32(coffset, offset, true)
        coffset += 4
        offset += this.memory.buffer.writeString(`${key}=${value}\0`, offset)
      }
    )
  }

  environ_sizes_get(env, environCount, environBufSize) {
    const processed = Object.entries(env).map(
      ([key, value]) => `${key}=${value}\0`
    )
    const size = processed.reduce((acc, e) => acc + String.byteLength(e), 0)
    this.view.setUint32(environCount, processed.length, true)
    this.view.setUint32(environBufSize, size, true)
    return this.WASI_ERRNO_SUCCESS
  }
}

function ReadCString (heap, idx) {
  let endPtr = idx
  while (heap[endPtr]) ++endPtr
  return heap.buffer.readString(endPtr - idx, idx)
}

function CString (str) {
  const buf = ArrayBuffer.fromString(str)
  const len = buf.byteLength + 1
  const ret = stack.alloc(len)
  memory.buffer.copyFrom(buf, ret, buf.byteLength)
  heap[ret + buf.byteLength] = 0
  return ret
}

const environment = {
  wasm_http_shm_map: (i0, region, size, extend, o0) => {
    return constants.SQLITE_OK
  },
  wasm_http_shm_lock: (i0, offset, n, flags) => {
    return constants.SQLITE_OK
  },
  wasm_http_open: (i0, flags) => {
    return flags
  },
  wasm_http_file_stat: (i0, o0, o1) => {
    return constants.SQLITE_OK
  },
  wasm_http_get_bytes: (i0, i1, start, end) => {
    return constants.SQLITE_OK
  },
  wasm_http_set_bytes: (i0, i1, amount, offset) => {
    return constants.SQLITE_OK
  },
  wasm_http_shm_unmap: (i0, deleteFlag) => {},
  wasm_crypto_get_random: (ptr, n) => {},
  wasm_get_unix_epoch: () => BigInt(Math.round(Date.now() / 1000)),
  wasm_wal_handler: (i0, i1, i2, pages) => {},
  wasm_console_log: (i0, i1) => just.error(`code=${i0} msg=${ReadCString(heap, i1)}`),
  emscripten_notify_memory_growth: (...args) => {
    just.print(`memory ${JSON.stringify(args)}`)
  }
}

function getName (path) {
  const name = path.slice(0, path.indexOf('.db') + 3)
  if (name === dbName) return 'main'
  return name.slice(0, -3)
}

function executeSQL (handle, sql) {
  const esp = stack.save()
  const ptr = new Pointer(memory, stack.alloc(4))
  const rc = ex.sqlite3_prepare_v2(handle, CString(sql), -1, ptr.p, 0)
  if (rc !== constants.SQLITE_OK) {
    stack.restore(esp)
    return [ReadCString(heap, ex.sqlite3_errmsg(handle))]
  }
  const stmt = ptr.get()
  let ok = ex.sqlite3_step(stmt)
  const cols = ex.sqlite3_column_count(stmt)
  const rows = []
  while (ok === constants.SQLITE_ROW) {
    const row = {}
    for (let col = 0; col < cols; col++) {
      switch (ex.sqlite3_column_type(stmt, col)) {
        case fieldTypes.SQLITE_INT64:
          row[ReadCString(heap, ex.sqlite3_column_name(stmt, col))] = ex.sqlite3_column_int64(stmt, col)
          break;
        case fieldTypes.SQLITE_INTEGER:
          row[ReadCString(heap, ex.sqlite3_column_name(stmt, col))] = ex.sqlite3_column_int(stmt, col)
          break;
        case fieldTypes.SQLITE_FLOAT:
          row[ReadCString(heap, ex.sqlite3_column_name(stmt, col))] = ex.sqlite3_column_double(stmt, col)
          break;
        case fieldTypes.SQLITE_TEXT:
          row[ReadCString(heap, ex.sqlite3_column_name(stmt, col))] = ReadCString(heap, ex.sqlite3_column_text(stmt, col))
          break;
      }
    }
    rows.push(row)
    ok = ex.sqlite3_step(stmt)
  }
  ex.sqlite3_finalize(stmt)
  stack.restore(esp)
  return rows
}

const databases = {}
const dbName = ':memory:'
const memory = new WebAssembly.Memory({ initial: 256, maximum: 256, shared: false })  
const heap = new Uint8Array(memory.buffer)
const wasi = new WASI(memory, {})
const buf = fs.readFileBytes('lib/quills.wasm')

const imports = { env: { ...environment, memory }, ...wasi.imports}
const instance = WebAssembly.instantiate(buf, imports)

//const module = new WebAssembly.Module(buf)
//const instance = new WebAssembly.Instance(module, imports)


wasi.initialize(instance)
const ex = instance.exports
const stack = {
  alloc: ex.stackAlloc,
  save: ex.stackSave,
  restore: ex.stackRestore
}
ex.sqlite3_initialize()
const esp = stack.save()
const ptr = new Pointer(memory, stack.alloc(4))
const defaultFlags = v2.SQLITE_OPEN_READWRITE | v2.SQLITE_OPEN_PRIVATECACHE | 
  v2.SQLITE_OPEN_NOMUTEX | v2.SQLITE_OPEN_CREATE | v2.SQLITE_OPEN_MEMORY
const rc = ex.sqlite3_open_v2(CString(dbName), ptr.p, defaultFlags, CString('http'))
const handle = ptr.get()
stack.restore(esp)
executeSQL(handle, 'PRAGMA auto_vacuum = none')
executeSQL(handle, 'PRAGMA temp_store = memory')
executeSQL(handle, 'PRAGMA locking_mode = exclusive')
executeSQL(handle, 'PRAGMA user_version = 100')

const sql = 'pragma user_version'

function createQuery (sql) {
  const ptr = new Pointer(memory, stack.alloc(4))
  const rc = ex.sqlite3_prepare_v2(handle, CString(sql), -1, ptr.p, 0)
  if (rc !== constants.SQLITE_OK) return
  const { SQLITE_ROW } = constants
  const { sqlite3_step, sqlite3_column_int, sqlite3_reset, sqlite3_finalize } = ex
  const stmt = ptr.get()
  return () => {
    if (sqlite3_step(stmt) === SQLITE_ROW) {
      const value = sqlite3_column_int(stmt, 0)
      sqlite3_reset(stmt)
      return value
    }
    sqlite3_finalize(stmt)
    return 0
  }
}

function createQuery2 (sql) {
  const ptr = new Pointer(memory, stack.alloc(4))
  const rc = ex.sqlite3_prepare_v2(handle, CString(sql), -1, ptr.p, 0)
  if (rc !== constants.SQLITE_OK) return
  const { wasm_get_version } = ex
  const stmt = ptr.get()
  return () => wasm_get_version(stmt)
}

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

bench(createQuery2(sql))
