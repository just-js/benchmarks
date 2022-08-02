let size = 0
const { stdin } = process
let reads = 0
const blocksize = parseInt(process.argv[2] || 65536, 10)
stdin.on('readable', () => {
  let chunk
  while ((chunk = stdin.read())) {
    reads++
    size += chunk.length
  }
})
stdin.on('end', () => {
  console.log(`size ${size} reads ${reads} blocksize ${blocksize}`)
})
stdin.on('error', err => {
  console.error(err.stack)
})
