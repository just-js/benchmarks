const { Pipe } = process.binding('pipe_wrap')
const blocksize = parseInt(process.argv[2] || 65536, 10)
const stdin = new Pipe(0)
stdin.open(0)
let size = 0
let reads = 0
stdin.onread = buf => {
  if (!buf) {
    console.log(`size ${size} reads ${reads} blocksize ${blocksize}`)
    return
  }
  reads++
  size += buf.byteLength
}
stdin.readStart()
