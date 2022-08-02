// we need to use just.library() to load modules for now as that is how builder pickes them up
just.library = (name, lib = name) => just.load(name)
const { sys } = just.library('sys')
const { net } = just.library('net')
const { read } = net
const { strerror, errno, STDIN_FILENO } = sys
const blocksize = parseInt(just.args[1] || 65536)
const buf = new ArrayBuffer(blocksize)
let size = 0
let reads = 0
let n = 0
while ((n = read(STDIN_FILENO, buf))) {
  reads++
  size += n
}
if (n < 0) {
  just.error(`read: ${strerror(errno())} (${errno()})`)
  just.exit(1)
}
just.print(`size ${size} reads ${reads} blocksize ${blocksize}`)
