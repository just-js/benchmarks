module.exports = {
  modules : [
    {
      name: 'sys',
      obj: [
        'modules/sys/sys.o'
      ],
      lib: [
        'dl',
        'rt'
      ]
    },
    {
      name: 'net',
      obj: [
        'modules/net/net.o'
      ]
    },
    {
      name: 'epoll',
      obj: [
        'modules/epoll/epoll.o'
      ]
    }
  ],
  v8flags: '--stack-trace-limit=10 --use-strict --disallow-code-generation-from-strings',
  main: 'bench-just-dumb-loop.js'
}
