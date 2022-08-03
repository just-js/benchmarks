const fs = require('fs')
const binary = require('@binary')
const { run } = require('lib/just/run.js')

const { AD, AC } = binary.ANSI
const { writeFile } = fs
const rx = /time\s(\d+)\sms\srate\s(\d+)/

function parseOutput (chunks) {
  const text = chunks.join('').trim()
  const lines = text.split('\n').filter(line => line)
  const results = []
  for (const line of lines) {
    const [ time, rate ] = rx.exec(line).slice(1).map(v => parseInt(v, 10))
    results.push({ time, rate })
  }
  return results
}

async function benchmark (name, cmdline, args) {
  just.print(`${AC}${name}${AD}`)
  const program = await run(cmdline, args).waitfor()
  program.results = parseOutput(program.out)
  return program
}

async function main (total = 10, runs = 10000000) {
  const args = [total, runs]
  const c = await benchmark('C', './bench-c', args)
  const bun = await benchmark('bun', 'bun', ['bench-bun.js', ...args])
  const node = await benchmark('node', 'node', ['bench-node.js', ...args])
  const deno = await benchmark('deno', 'deno', ['run', 'bench-deno-bundle.js', ...args])
  const justNative = await benchmark('just', 'just', ['bench-just.js', ...args])
  const justFFI = await benchmark('justFFI', 'just', ['bench-just-ffi.js', ...args])
  const justWASM = await benchmark('justWASM', 'just', ['bench-just-wasm.js', ...args])
  const justStatic = await benchmark('justStatic', './bench-just', args)
  const results = { c, bun, node, deno, justNative, justFFI, justWASM, justStatic }
  writeFile('./out/results.json', ArrayBuffer.fromString(JSON.stringify(results)))
}

main(...just.args.slice(2))
