import { mkdir, readdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { run } from 'shared-scripts'
import scriptsConfig from '../src/config'

const tmpDir = join(tmpdir(), `rename--${Math.random().toString(36)}`)

test('rename file', async () => {
    await mkdir(`${tmpDir}/rename-file`, {recursive: true})
    await writeFile(`${tmpDir}/rename-file/foo.txt`, 'hello, world!')

    await expect(readdir(`${tmpDir}/rename-file`)).resolves.toEqual(['foo.txt'])

    await run('rename', ['--in', `${tmpDir}/rename-file`, 't(\\w+)t', '$1.test'], scriptsConfig).catch(() => void undefined)

    await expect(readdir(`${tmpDir}/rename-file`)).resolves.toEqual(['foo.x.test'])
})

test('rename files recursively', async () => {
    await mkdir(`${tmpDir}/rename-recursive/bar/baz`, {recursive: true})
    await writeFile(`${tmpDir}/rename-recursive/bar/baz/foo.txt`, 'hello, world!').catch(e => e)

    await expect(readdir(`${tmpDir}/rename-recursive/bar/baz`)).resolves.toEqual(['foo.txt'])

    await run('rename', ['--in', `${tmpDir}/rename-recursive`, '-r', 'o', 'u'], scriptsConfig)

    await expect(readdir(`${tmpDir}/rename-recursive/bar/baz`)).resolves.toEqual(['fuo.txt'])
})
