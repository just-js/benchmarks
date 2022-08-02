const { fs } = just.library('fs')
const { net } = just.library('net')

const fileFlags = {
  SQLITE_OPEN_READONLY: 0x01,
  SQLITE_OPEN_READWRITE: 0x02,
  SQLITE_OPEN_CREATE: 0x04,
  SQLITE_OPEN_MAIN_DB: 0x100,
  SQLITE_OPEN_WAL: 0x80000,
  SQLITE_OPEN_MAIN_JOURNAL: 0x800
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
    const path = ReadCString(heap, i0)
    const name = getName(path)
    if (extend === 0) {
      heap[o0] = 0
      return constants.SQLITE_OK
    }
    const database = databases[name]
    if (database.regions[region]) {
      const p = new Pointer(memory, o0)
      p.set(database.regions[region].ptr)
    } else {
      const ptr = ex.malloc(size)
      database.regions[region] = { ptr, bytes: heap.subarray(ptr, ptr + size) }
      const p = new Pointer(memory, o0)
      p.set(ptr)
    }
    return constants.SQLITE_OK
  },
  wasm_http_shm_lock: (i0, offset, n, flags) => {
    const path = ReadCString(heap, i0)
    const name = getName(path)
    const database = databases[name]
    if (database.regions[0]) {
      const { bytes } = database.regions[0]
      if (flags & walFlags.SQLITE_SHM_UNLOCK) {
        bytes[120 + offset] = walFlags.F_UNLCK
      } else if (flags & walFlags.SQLITE_SHM_SHARED) {
        bytes[120 + offset] = walFlags.F_RDLCK
      } else {
        bytes[120 + offset] = walFlags.F_WRLCK
      }
    }
    return constants.SQLITE_OK
  },
  wasm_http_open: (i0, flags) => {
    const path = ReadCString(heap, i0)
    const name = getName(path)
    const database = databases[name]
    database.files[path].fd = fs.open(path, fs.O_RDWR | fs.O_CREAT | fs.O_APPEND)
    return flags
  },
  wasm_http_file_stat: (i0, o0, o1) => {
    const path = ReadCString(heap, i0)
    const name = getName(path)
    const access = new Pointer(memory, o0)
    const size = new Pointer(memory, o1)
    size.set(Number(just.fs.getStat(path).size))
    access.set(vfsFlags.HTTP_FILE_READWRITE)
    if (!databases[name]) {
      databases[name] = {
        name,
        regions: [],
        files: {
          [path]: { size: size.get(), flags: access.get() }
        }
      }
    } else {
      if (!databases[name].files[path]) {
        databases[name].files[path] = { size: size.get(), flags: access.get() }
      } else {
        databases[name].files[path].size = size.get()
      }
    }
    return constants.SQLITE_OK
  },
  wasm_http_get_bytes: (i0, i1, start, end) => {
    const path = ReadCString(heap, i0)
    const name = getName(path)
    const database = databases[name]
    const file = database.files[path]
    const rc = fs.lseek(file.fd, Number(start))
    const bytes = net.read(file.fd, heap.buffer, i1, Number(end - start))
    return constants.SQLITE_OK
  },
  wasm_http_set_bytes: (i0, i1, amount, offset) => {
    const path = ReadCString(heap, i0)
    const name = getName(path)
    const database = databases[name]
    const file = database.files[path]
    const rc = fs.lseek(file.fd, Number(offset))
    net.write(file.fd, heap.buffer, Number(amount), i1)
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
const buf = just.fs.readFileBytes('lib/quills.wasm')
const module = new WebAssembly.Module(buf)
const imports = { env: { ...environment, memory }, ...wasi.imports}
const instance = new WebAssembly.Instance(module, imports)
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
const rc = ex.sqlite3_open_v2(CString(dbName), ptr.p, fileFlags.SQLITE_OPEN_READWRITE | fileFlags.SQLITE_OPEN_CREATE, CString('http'))
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

let total = parseInt(just.args[2], 10)
const runs = parseInt(just.args[3], 10)

function bench (query) {
  const start = Date.now()
  for (let i = 0; i < runs; i++) query()
  const elapsed = Date.now() - start
  const rate = Math.floor(runs / (elapsed / 1000))
  const { rss } = just.memoryUsage()
  just.print(`time ${elapsed} ms rate ${rate} rss ${rss}`)
  if (total--) just.sys.nextTick(() => bench(query))
}

bench(createQuery(sql))
