require('../tools/compat.js')
const handlebars = require('./handlebars.js')

const template = `<!DOCTYPE html>
<html>
<head><title>Fortunes</title></head>
<body>
<table>
  <tr>
    <th>id</th>
    <th>message</th>
  </tr>
  {{#each this}}
  <tr>
    <td>{{id}}</td>
    <td>{{message}}</td>
  </tr>
  {{/each}}
</table>
</body>
</html>`

const compiled = handlebars.compile(template, { compat: false, preventIndent: true, noEscape: true, strict: false })
const payload = [{ id: 1, message: 'hello' }]

function bench (fn) {
  const runs = 200000
  const start = Date.now()
  for (let i = 0; i < runs; i++) fn()
  const elapsed = Date.now() - start
  const rate = Math.floor(runs / (elapsed / 1000))
  const { rss } = process.memoryUsage()
  console.log(`time ${elapsed} ms rate ${rate} rss ${rss}`)
  process.nextTick(() => bench(fn))
}

bench(() => compiled(payload))

//console.log(compiled(payload))
