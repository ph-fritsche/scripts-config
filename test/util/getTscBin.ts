import path from 'path'
import { getTscBin } from '../../src/util'

const projectDir = path.resolve(__dirname, '../..')

test('find tsc', () => {
    process.chdir(__dirname)
    expect(getTscBin()).toBe(`${projectDir}/node_modules/.bin/tsc`)
})

test('find global tsc', () => {
    process.chdir('/tmp')
    expect(getTscBin()).toBe(`tsc`)
})
