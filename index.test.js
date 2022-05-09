const wait = require('./wait')
const process = require('process')
const path = require('path')
const exec = require('@actions/exec')

test('throws invalid number', async () => {
  await expect(wait('foo')).rejects.toThrow('milliseconds not a number')
})

test('wait 500 ms', async () => {
  const start = new Date()
  await wait(500)
  const end = new Date()
  var delta = Math.abs(end - start)
  expect(delta).toBeGreaterThanOrEqual(500)
})

// shows how the runner will run a javascript action with env / stdout protocol
test('test runs', () => {
  process.env['INPUT_MILLISECONDS'] = 100
  const ip = path.join(__dirname, 'index.js')
  const result = exec.exec('node', [ip, process.env])
  console.log(result)
})
