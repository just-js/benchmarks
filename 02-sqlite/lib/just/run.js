const { launch, watch } = require('process')
const { Monitor } = require('monitor.js')
const { sys } = just.library('sys')

const { pageSize } = sys

function run (cmd = '', args = [], path = sys.cwd()) {
  const app = launch(cmd, args.map(arg => arg.toString()), path)
  app.out = []
  app.err = []
  app.stats = []
  const monitor = new Monitor(app.stats)
  monitor.open(app.pid)
  app.onStdout = (buf, bytes) => app.out.push(buf.readString(bytes))
  app.onStderr = (buf, bytes) => app.err.push(buf.readString(bytes))
  const last = [0, 0]
  app.onClose = () => {
    app.stats = app.stats.map(s => {
      const utime = s.utime - last[0]
      const stime = s.stime - last[1]
      last[0] = s.utime
      last[1] = s.stime
      const total = utime + stime
      const [upc, spc] = [(utime / total) * 100, (stime / total) * 100]
      return [upc, spc, Math.floor((s.rssPages * pageSize))]
    })
    monitor.close()
  }
  app.waitfor = () => watch(app)
  return app
}

module.exports = { run }
