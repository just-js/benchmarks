const { print, error, exit, memoryUsage, sys, net } = just
const { read } = net
const { strerror, errno, STDIN_FILENO } = sys
const blocksize = parseInt(just.args[2] || 65536)
const buf = new ArrayBuffer(blocksize)
let size = 0
let reads = 0
let n = read(STDIN_FILENO, buf, 0, buf.byteLength)
while (n > 0) {
  reads++
  size += n
  n = read(STDIN_FILENO, buf, 0, buf.byteLength)
}
if (n < 0) {
  error(`read: ${strerror(errno())} (${errno()})`)
  exit(1)
}
print(`size ${size} reads ${reads} blocksize ${blocksize}`)
