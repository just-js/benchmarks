const binary = require('@binary')
const { run } = require('lib/just/run.js')

const { AG, AD, AM, AR, AY, AC } = binary.ANSI

function runTest (program, args) {
  return run(program, args).waitfor()
}

async function main (total = 5, runs = 1000000) {
  just.print(`${AC}C${AD}`)
  const c = await runTest('./bench-c', [total, runs])
  just.print(c.out.join('').trim())

  just.print(`${AC}bun${AD}`)
  const bun = await runTest('bun', ['bench-bun.js', total, runs])
  just.print(bun.out.join('').trim())

  just.print(`${AC}node${AD}`)
  const node = await runTest('node', ['bench-node.js', total, runs])
  just.print(node.out.join('').trim())

  just.print(`${AC}deno${AD}`)
  const deno = await runTest('deno', ['run', 'bench-deno.js', total, runs])
  just.print(deno.out.join('').trim())

  just.print(`${AC}just${AD}`)
  const justNative = await runTest('just', ['bench-just.js', total, runs])
  just.print(justNative.out.join('').trim())

  just.print(`${AC}just ffi${AD}`)
  const justFFI = await runTest('just', ['bench-just-ffi.js', total, runs])
  just.print(justFFI.out.join('').trim())

  just.print(`${AC}just wasm${AD}`)
  const justWASM = await runTest('just', ['bench-just-wasm.js', total, runs])
  just.print(justWASM.out.join('').trim())

  just.print(`${AC}just static${AD}`)
  const justStatic = await runTest('./bench-just', [total, runs])
  just.print(justStatic.out.join('').trim())

}

main(...just.args.slice(2))
