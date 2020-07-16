'use strict'

const http = require('http')
const test = require('ava')
const { createServer, createProxy } = require('./utils')
const { HttpProxyAgent } = require('../')

function request (opts) {
  return new Promise((resolve, reject) => {
    const req = http.request(opts, resolve)
    req.on('error', reject)
    req.end(opts.body)
  })
}

test('Basic', async t => {
  const server = await createServer()
  const proxy = await createProxy()
  server.on('request', (req, res) => res.end('ok'))

  const response = await request({
    method: 'GET',
    hostname: server.address().address,
    port: server.address().port,
    path: '/',
    agent: new HttpProxyAgent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 256,
      maxFreeSockets: 256,
      scheduling: 'lifo',
      proxy: `http://${proxy.address().address}:${proxy.address().port}`
    })
  })

  let body = ''
  response.setEncoding('utf8')
  for await (const chunk of response) {
    body += chunk
  }

  t.is(body, 'ok')
  t.is(response.statusCode, 200)

  server.close()
  proxy.close()
})

test('Proxy authentication', async t => {
  const server = await createServer()
  const proxy = await createProxy()
  server.on('request', (req, res) => res.end('ok'))

  proxy.authenticate = function (req, fn) {
    fn(null, req.headers['proxy-authorization'] === `Basic ${Buffer.from('hello:world').toString('base64')}`)
  }

  const response = await request({
    method: 'GET',
    hostname: server.address().address,
    port: server.address().port,
    path: '/',
    agent: new HttpProxyAgent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 256,
      maxFreeSockets: 256,
      scheduling: 'lifo',
      proxy: `http://hello:world@${proxy.address().address}:${proxy.address().port}`
    })
  })

  let body = ''
  response.setEncoding('utf8')
  for await (const chunk of response) {
    body += chunk
  }

  t.is(body, 'ok')
  t.is(response.statusCode, 200)

  server.close()
  proxy.close()
})

test('Configure the agent to reuse sockets', async t => {
  const server = await createServer()
  const proxy = await createProxy()
  server.on('request', (req, res) => res.end('ok'))

  let count = 0
  proxy.on('connection', () => {
    count += 1
    t.is(count, 1)
  })

  const agent = new HttpProxyAgent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 256,
    maxFreeSockets: 256,
    scheduling: 'lifo',
    proxy: `http://${proxy.address().address}:${proxy.address().port}`
  })

  let response = await request({
    method: 'GET',
    hostname: server.address().address,
    port: server.address().port,
    path: '/',
    agent
  })

  let body = ''
  response.setEncoding('utf8')
  for await (const chunk of response) {
    body += chunk
  }

  t.is(body, 'ok')
  t.is(response.statusCode, 200)

  response = await request({
    method: 'GET',
    hostname: server.address().address,
    port: server.address().port,
    path: '/',
    agent
  })

  body = ''
  response.setEncoding('utf8')
  for await (const chunk of response) {
    body += chunk
  }

  t.is(body, 'ok')
  t.is(response.statusCode, 200)

  server.close()
  proxy.close()
})

test('Configure the agent to NOT reuse sockets', async t => {
  const server = await createServer()
  const proxy = await createProxy()
  server.on('request', (req, res) => res.end('ok'))

  const ports = []
  proxy.on('connection', socket => {
    t.false(ports.includes(socket.remotePort))
    ports.push(socket.remotePort)
  })

  const agent = new HttpProxyAgent({
    keepAlive: false,
    keepAliveMsecs: 1000,
    maxSockets: Infinity,
    maxFreeSockets: 256,
    scheduling: 'lifo',
    proxy: `http://${proxy.address().address}:${proxy.address().port}`
  })

  let response = await request({
    method: 'GET',
    hostname: server.address().address,
    port: server.address().port,
    path: '/',
    agent
  })

  let body = ''
  response.setEncoding('utf8')
  for await (const chunk of response) {
    body += chunk
  }

  t.is(body, 'ok')
  t.is(response.statusCode, 200)

  response = await request({
    method: 'GET',
    hostname: server.address().address,
    port: server.address().port,
    path: '/',
    agent
  })

  body = ''
  response.setEncoding('utf8')
  for await (const chunk of response) {
    body += chunk
  }

  t.is(body, 'ok')
  t.is(response.statusCode, 200)

  server.close()
  proxy.close()
})
