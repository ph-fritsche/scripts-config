import { realpathSync, existsSync } from 'fs'
import { readFile, rm, writeFile } from 'fs/promises'
import { chdir } from 'process'
import { run } from 'shared-scripts'
import scriptsConfig from '../src/config'

// work around for typescript
const dynamicImport = <T>(module: string) => import(module) as Promise<T>
const exampleDir = __dirname + '/../example'

let originalPackageJson: Buffer

beforeAll(async() => {
    await rm(`${exampleDir}/dist`, { recursive: true, force: true })

    originalPackageJson = await readFile(`${exampleDir}/package.json`)

    chdir(__dirname + '/../example')
    await run('ts-build', ['--exportsMap', 'foo/*,bar:some/other/file'], scriptsConfig)
})

afterAll(async() => {
    await writeFile(`${exampleDir}/package.json`, originalPackageJson)
})

test('export cjs', async () => {
    const { which } = await dynamicImport<{ which: () => string }>('../example/dist/cjs/foo/filename.js')

    expect(which).toEqual(expect.any(Function))
    expect(which()).toEqual(realpathSync(`${__dirname}/../example/dist/cjs/foo/filename.js`))
})

test('export esm', async () => {
    const { which } = await dynamicImport<{ which: () => string }>('../example/dist/esm/foo/filename.js')

    expect(which).toEqual(expect.any(Function))
    expect(which()).toEqual(realpathSync(`${__dirname}/../example/dist/esm/foo/filename.js`))
})

test('export declarations', () => {
    expect(existsSync('../example/dist/types/foo/filename.d.ts')).toBe(true)
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
