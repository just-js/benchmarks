const { epoll } = just.load('epoll')
const { sys } = just.load('sys')
const { net } = just.load('net')

const { close, recv, send, accept, setsockopt, socket, bind, listen } = net
const { fcntl } = sys
const { F_GETFL, F_SETFL, runMicroTasks } = sys
const {
  IPPROTO_TCP, O_NONBLOCK, TCP_NODELAY, SO_KEEPALIVE, AF_INET, SOCK_STREAM, 
  SOL_SOCKET, SO_REUSEADDR, SO_REUSEPORT, SOCK_NONBLOCK
} = net
const {
  create, wait, control, EPOLL_CLOEXEC, EPOLL_CTL_ADD,
  EPOLL_CTL_DEL, EPOLL_CTL_MOD, EPOLLIN, EPOLLERR, EPOLLHUP
} = epoll

function add (fd, callback, events = EPOLLIN) {
  const r = control(loopfd, EPOLL_CTL_ADD, fd, events)
  if (r === 0) handles[fd] = callback
  return r
}

function remove (fd) {
  const r = control(loopfd, EPOLL_CTL_DEL, fd)
  if (r === 0) delete handles[fd]
  return r
}

function update (fd, events = EPOLLIN) {
  return control(loopfd, EPOLL_CTL_MOD, fd, events)
}

function poll (timeout = -1, sigmask) {
  let r = 0
  if (sigmask) {
    r = wait(loopfd, evbuf, timeout, sigmask)
  } else {
    r = wait(loopfd, evbuf, timeout)
  }
  if (r > 0) {
    let off = 0
    for (let i = 0; i < r; i++) {
      const fd = events[off + 1]
      handles[fd] && handles[fd](fd, events[off])
      off += 3
    }
  }
  return r
}

function onSocketEvent (fd, event) {
  if (event & EPOLLERR || event & EPOLLHUP) {
    remove(fd)
    close(fd)
    return
  }
  const bytes = recv(fd, buf, 0, bufferSize)
  if (bytes > 0) {
    send(fd, r200, r200Len, 0)
    return
  }
  if (bytes < 0) just.error('recv error')
  remove(fd)
  close(fd)
}

function onConnect (fd, event) {
  if (event & EPOLLERR || event & EPOLLHUP) {
    remove(fd)
    close(fd)
    return
  }
  const newfd = accept(fd)
  setsockopt(newfd, IPPROTO_TCP, TCP_NODELAY, 0)
  setsockopt(newfd, SOL_SOCKET, SO_KEEPALIVE, 0)
  add(newfd, onSocketEvent)
  const flags = fcntl(newfd, F_GETFL, 0) | O_NONBLOCK
  fcntl(newfd, F_SETFL, flags)
  update(newfd, EPOLLIN | EPOLLERR | EPOLLHUP)
}

const handles = {}
const bufferSize = 16384
const r200 = sys.calloc(1, `HTTP/1.1 200 OK\r\nServer: j\r\nDate: ${(new Date()).toUTCString()}\r\nContent-Type: text/plain\r\nContent-Length: 13\r\n\r\nHello, World!`)
const r400 = sys.calloc(1, `HTTP/1.1 400 Bad Request\r\nServer: j\r\nDate: ${(new Date()).toUTCString()}\r\nContent-Type: text/plain\r\nContent-Length: 13\r\nConnection: close\r\n\r\nHello, World!`)
const r200Len = r200.byteLength
const r400Len = r400.byteLength
const buf = new ArrayBuffer(bufferSize)
const fd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0)
setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, 1)
setsockopt(fd, SOL_SOCKET, SO_REUSEPORT, 1)
bind(fd, '127.0.0.1', 3000)
listen(fd, 1024)
const nevents = 128
const evbuf = new ArrayBuffer(nevents * 12)
const events = new Uint32Array(evbuf)
const loopfd = create(EPOLL_CLOEXEC)
add(fd, onConnect)
while (1) {
  poll(-1)
  runMicroTasks()
}