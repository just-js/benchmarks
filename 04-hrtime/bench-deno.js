import { nextTick } from "https://deno.land/std@0.126.0/node/_next_tick.ts"

const fun = () => performance.now()

function bench (count = 100000000) {
  const start = Date.now()
  for (let i = 0; i < count; i++) fun()
  const elapsed = Date.now() - start
  const rate = Math.floor(count / (elapsed / 1000))
  console.log(`time ${elapsed} ms rate ${rate}`)
  nextTick(() => bench(count))
}

bench()
