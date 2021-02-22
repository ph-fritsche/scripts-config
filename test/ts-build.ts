import { realpathSync } from 'fs'
import { rm } from 'fs/promises'
import { chdir } from 'process'
import { run } from 'shared-scripts'
import scriptsConfig from '../src/config'

// work around for typescript
const dynamicImport = (module: string) => import(module)
const exampleDist = __dirname + '/../example/dist'

beforeAll(async() => {
    await rm(exampleDist, { recursive: true, force: true })
    chdir(__dirname + '/../example')
    await run('ts-build', [], scriptsConfig)
})

test('export cjm', async () => {
    const { which } = await dynamicImport('../example/dist/foo/filename.js').catch(() => ({}))

    expect(which).toEqual(expect.any(Function))
    expect(which()).toEqual(realpathSync(`${__dirname}/../example/dist/foo/filename.js`))
})

test('export esm', async () => {
    const { which } = await dynamicImport('../example/dist/foo/filename.esm.js').catch(() => ({}))

    expect(which).toEqual(expect.any(Function))
    expect(which()).toEqual(realpathSync(`${__dirname}/../example/dist/foo/filename.esm.js`))
})
