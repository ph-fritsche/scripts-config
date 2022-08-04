const { which } = require('example/dist/cjs/foo/filename.js')

process.stdout.write(`per dist: ${which()}\n`)
