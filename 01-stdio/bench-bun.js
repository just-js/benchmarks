const fs = Bun.fs()
const blocksize = parseInt(Bun.argv[2] || 65536)
const buf = new ArrayBuffer(blocksize)
let size = 0
let reads = 0
const STDIN_FILENO = 0
let n = fs.readSync(STDIN_FILENO, buf)
while (n > 0) {
  reads++
  size += n
  n = fs.readSync(STDIN_FILENO, buf)
}
if (n < 0) throw new Error('Bad Read')
console.log(`size ${size} reads ${reads} blocksize ${blocksize}`)
