const message = 'Hello, World!'

require('@http')
  .createServer()
  .get('/', res => res.text(message))
  .listen()
