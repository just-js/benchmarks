const time = new BigUint64Array(1)
const { hrtime } = process
const { bigint } = hrtime
const fun = () => bigint(time)

function bench (count = 100000000) {
  const start = Date.now()
  for (let i = 0; i < count; i++) fun()
  const elapsed = Date.now() - start
  const rate = Math.floor(count / (elapsed / 1000))
  console.log(`time ${elapsed} ms rate ${rate}`)
  process.nextTick(() => bench(count))
}

bench()
