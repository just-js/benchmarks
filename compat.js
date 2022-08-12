if (globalThis.just) {
  global.console = { log: (...args) => just.print(...args) },
  global.process = { nextTick: just.sys.nextTick, memoryUsage: just.memoryUsage }
}