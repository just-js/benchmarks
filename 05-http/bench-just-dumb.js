const { epoll } = just.library('epoll')
const { sys } = just.library('sys')
const { net } = just.library('net')

const { EPOLLIN, EPOLLERR, EPOLLHUP } = epoll
const { close, recv, send, accept, setsockopt, socket, bind, listen } = net
const { fcntl } = sys
const { loop } = just.factory
const { F_GETFL, F_SETFL } = sys
const { 
  IPPROTO_TCP, O_NONBLOCK, TCP_NODELAY, SO_KEEPALIVE, AF_INET, SOCK_STREAM, 
  SOL_SOCKET, SO_REUSEADDR, SO_REUSEPORT, SOCK_NONBLOCK
} = net
const bufferSize = 16384

function onSocketEvent (fd, event) {
  if (event & EPOLLERR || event & EPOLLHUP) {
    loop.remove(fd)
    close(fd)
    return
  }
  const bytes = recv(fd, buf, 0, bufferSize)
  if (bytes > 0) {
    send(fd, r200, r200Len, 0)
    return
  }
  if (bytes < 0) just.error('recv error')
  loop.remove(fd)
  close(fd)
}

function onConnect (fd, event) {
  if (event & EPOLLERR || event & EPOLLHUP) {
    loop.remove(fd)
    close(fd)
    return
  }
  const newfd = accept(fd)
  setsockopt(newfd, IPPROTO_TCP, TCP_NODELAY, 0)
  setsockopt(newfd, SOL_SOCKET, SO_KEEPALIVE, 0)
  loop.add(newfd, onSocketEvent)
  const flags = fcntl(newfd, F_GETFL, 0) | O_NONBLOCK
  fcntl(newfd, F_SETFL, flags)
  loop.update(newfd, EPOLLIN | EPOLLERR | EPOLLHUP)
}

const r200 = ArrayBuffer.fromString(`HTTP/1.1 200 OK\r\nServer: j\r\nDate: ${(new Date()).toUTCString()}\r\nContent-Type: text/plain\r\nContent-Length: 13\r\n\r\nHello, World!`)
const r400 = ArrayBuffer.fromString(`HTTP/1.1 400 Bad Request\r\nServer: j\r\nDate: ${(new Date()).toUTCString()}\r\nContent-Type: text/plain\r\nContent-Length: 13\r\nConnection: close\r\n\r\nHello, World!`)
const r200Len = r200.byteLength
const r400Len = r400.byteLength
const buf = new ArrayBuffer(bufferSize)
const fd = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK, 0)
setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, 1)
setsockopt(fd, SOL_SOCKET, SO_REUSEPORT, 1)
bind(fd, '127.0.0.1', 3000)
listen(fd, 1024)
loop.add(fd, onConnect)
