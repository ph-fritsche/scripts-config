import { existsSync } from 'fs'
import { readFile, symlink } from 'fs/promises'
import { chdir } from 'process'
import { run } from 'shared-scripts'
import scriptsConfig from '../src/config'
import { testOnExample } from './_helper'

// work around for typescript
const dynamicImport = <T>(module: string) => import(module) as Promise<T>

testOnExample(dir => {
    const exampleDir = `${dir}/example`

    beforeAll(async () => {
        chdir(exampleDir)
        await symlink(`${__dirname}/../node_modules`, `${exampleDir}/node_modules`)
        await run('ts-build', ['--exportsMap', 'foo/*,bar:some/other/file'], scriptsConfig)
    }, 30000)

    test('export cjs', async () => {
        const { which } = await dynamicImport<{ which: () => string }>(`${exampleDir}/dist/cjs/foo/filename.js`)

        expect(which).toEqual(expect.any(Function))
        expect(which()).toEqual(`${exampleDir}/dist/cjs/foo/filename.js`)
    })

    test('export esm', async () => {
        const { which } = await dynamicImport<{ which: () => string }>(`${exampleDir}/dist/esm/foo/filename.js`)

        expect(which).toEqual(expect.any(Function))
        expect(which()).toEqual(`${exampleDir}/dist/esm/foo/filename.js`)
    })

    test('export declarations', () => {
        expect(existsSync(`${exampleDir}/dist/types/foo/filename.d.ts`)).toBe(true)
    })

    test('update package.json', async () => {
        expect(String(await readFile(`${exampleDir}/package.json`))).toMatchInlineSnapshot(`
    {
        "name": "example",
        "private": "true",
        "scripts": {
            "scripts": "../node_modules/.bin/scripts",
            "tsc": "../node_modules/.bin/tsc"
        },
        "main": "./dist/cjs/index.js",
        "module": "./dist/esm/index.js",
        "types": "./dist/types/index.d.ts",
        "exports": {
            ".": {
                "import": "./dist/esm/index.js",
                "default": "./dist/cjs/index.js"
            },
            "./dist/*": "./dist/*.js",
            "./foo/*": {
                "import": "./dist/esm/foo/*.js",
                "default": "./dist/cjs/foo/*.js"
            },
            "./bar": {
                "import": "./dist/esm/some/other/file.js",
                "default": "./dist/cjs/some/other/file.js"
            }
        },
        "typesVersions": {
            "*": {
                "dist/types/*": [
                    "./dist/types/*"
                ],
                "dist/cjs/*": [
                    "./dist/types/*.d.ts"
                ],
                "dist/esm/*": [
                    "./dist/types/*.d.ts"
                ],
                "foo/*": [
                    "./dist/types/foo/*.d.ts"
                ],
                "bar": [
                    "./dist/types/some/other/file.d.ts"
                ],
                "*": [
                    "./dist/types/*.d.ts"
                ]
            }
        }
    }
    `)
    })
})
