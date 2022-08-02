const { launch, watch } = require('process')
const { readStat } = require('monitor.js')
const { sys } = just.library('sys')

function run (cmd = '', args = [], path = sys.cwd()) {
  const app = launch(cmd, args.map(arg => arg.toString()), path)
  app.out = []
  app.err = []
  app.stats = []
  app.onStdout = (buf, bytes) => app.out.push(buf.readString(bytes))
  app.onStderr = (buf, bytes) => app.err.push(buf.readString(bytes))
  const timer = just.setInterval(() => app.stats.push(readStat(app.pid)), 100)
  app.onClose = () => just.clearTimeout(timer)
  app.waitfor = () => watch(app)
  return app
}

module.exports = { run }
