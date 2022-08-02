const { net, sys, print, error, memoryUsage } = just
const { read, O_NONBLOCK } = net
const { strerror, errno, STDIN_FILENO } = sys
const { EPOLLIN } = just.loop
const { loop } = just.factory
const blocksize = parseInt(just.args[2] || 65536)
const buf = new ArrayBuffer(blocksize)
const flags = sys.fcntl(STDIN_FILENO, sys.F_GETFL, 0) | O_NONBLOCK
sys.fcntl(STDIN_FILENO, sys.F_SETFL, flags)
let size = 0
let reads = 0
function onData (fd) {
  const n = read(fd, buf)
  if (n < 0) {
    error(`read: ${strerror(errno())} (${errno()})`)
    loop.remove(fd)
    just.exit(1)
  }
  if (n === 0) {
    print(`size ${size} reads ${reads} blocksize ${blocksize} rss ${memoryUsage().rss}`)
    loop.remove(fd)
    return
  }
  reads++
  size += n
}
loop.add(STDIN_FILENO, onData, EPOLLIN)
