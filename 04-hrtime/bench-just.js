const { hrtime } = just

const buf = new ArrayBuffer(8)
const u64 = new BigUint64Array(buf)
const address = buf.getAddress()

function bench (count = 100000000) {
  const start = Date.now()
  for (let i = 0; i < count; i++) hrtime()
  const elapsed = Date.now() - start
  const rate = Math.floor(count / (elapsed / 1000))
  just.print(`time ${elapsed} ms rate ${rate}`)
  just.sys.nextTick(() => bench(count))
}

bench()
