const html = require('@html')

const template = `<!DOCTYPE html>
<html>
<head><title>Fortunes</title></head>
<body>
<table>
  <tr>
    <th>id</th>
    <th>message</th>
  </tr>{{#each this}}
  <tr>
    <td>{{id}}</td>
    <td>{{message}}</td>
  </tr>{{/each}}
</table>
</body>
</html>`


const compiled = html.compile(ArrayBuffer.fromString(template), '', '', { rawStrings: false }).call
const payload = [{ id: 1, message: 'hello' }]

function bench (fn) {
  const runs = 30000000
  const start = Date.now()
  for (let i = 0; i < runs; i++) fn()
  const elapsed = Date.now() - start
  const rate = Math.floor(runs / (elapsed / 1000))
  const { rss } = just.memoryUsage()
  just.print(`time ${elapsed} ms rate ${rate} rss ${rss}`)
  payload.id++
  just.sys.nextTick(() => bench(fn))
}

bench(() => compiled.call(payload))

//just.print(compiled.call(payload))
