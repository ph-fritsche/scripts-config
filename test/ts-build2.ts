import { realpathSync, existsSync } from 'fs'
import { readFile, rm, writeFile } from 'fs/promises'
import { chdir } from 'process'
import { run } from 'shared-scripts'
import scriptsConfig from '../src/config'
import process from 'process'

// jest's process mock lacks methods
jest.mock('process', () => {
    const realProcess = jest.requireActual('process') as typeof process

    return {
        ...realProcess,
        once: jest.fn(),
        off: jest.fn(),
        stdout: {
            ...realProcess.stdout,
            columns: 80,
            write: jest.fn(),
        },
        exit: (code: number) => {
            throw new Error(String(code))
        },
    }
})

// work around for typescript
const dynamicImport = (module: string) => import(module)
const exampleDir = __dirname + '/../example'

describe('dualExport', () => {
    let buildComplete = false
    let originalPackageJson: Buffer

    beforeAll(() => {
        (process.stdout.write as jest.MockedFunction<typeof process.stdout.write>).mockClear()
    })

    beforeAll(async() => {
        await rm(`${exampleDir}/dist`, { recursive: true, force: true })

        originalPackageJson = await readFile(`${exampleDir}/package.json`)

        chdir(__dirname + '/../example')
    })

    afterAll(async() => {
        await writeFile(`${exampleDir}/package.json`, originalPackageJson)
    })

    test('build without error', async () => {
        await run('ts-build2', ['--cjs', '--exportsMap', 'foo/*,bar:some/other/file'], scriptsConfig)
        buildComplete = true
        expect.assertions(0)
    }, 10000)

    describe('assert on build', () => {
        beforeEach(() => {
            if (!buildComplete) {
                throw new Error('Test requires completed build')
            }
        })

        test('export cjs', async () => {
            const { which } = await dynamicImport('../example/dist/cjs/foo/filename.js').catch(() => ({}))

            expect(which).toEqual(expect.any(Function))
            expect(which()).toEqual(realpathSync(`${__dirname}/../example/dist/cjs/foo/filename.js`))
        })

        test('export esm', async () => {
            const { which } = await dynamicImport('../example/dist/esm/foo/filename.js').catch(() => ({}))

            expect(which).toEqual(expect.any(Function))
            expect(which()).toEqual(realpathSync(`${__dirname}/../example/dist/esm/foo/filename.js`))
        })

        test('export declarations', async () => {
            expect(existsSync('../example/dist/types/foo/filename.d.ts')).toBe(true)
        })

        test('update package.json', async () => {
            expect(String(await readFile(`${exampleDir}/package.json`))).toMatchInlineSnapshot(`
                {
                    "scripts": {
                        "scripts": "../node_modules/.bin/scripts",
                        "tsc": "../node_modules/.bin/tsc"
                    },
                    "main": "./dist/cjs/index.js",
                    "module": "./dist/esm/index.js",
                    "types": "./dist/types/index.d.ts",
                    "exports": {
                        ".": {
                            "require": "./dist/cjs/index.js",
                            "default": "./dist/esm/index.js"
                        },
                        "./dist/*": "./dist/*.js",
                        "./foo/*": {
                            "require": "./dist/cjs/foo/*.js",
                            "default": "./dist/esm/foo/*.js"
                        },
                        "./bar": {
                            "require": "./dist/cjs/some/other/file.js",
                            "default": "./dist/esm/some/other/file.js"
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

        test('exclude tests and stories per default', () => {
            expect(existsSync(`${exampleDir}/dist/index.spec.js`)).toBe(false)
            expect(existsSync(`${exampleDir}/dist/index.stories.js`)).toBe(false)
            expect(existsSync(`${exampleDir}/dist/index.test.js`)).toBe(false)

            expect(existsSync(`${exampleDir}/dist/esm/foo/filename.test.js`)).toBe(false)

            expect(existsSync(`${exampleDir}/dist/types/index.test.d.ts`)).toBe(false)
        })

        test('report matches and ignored files to console', () => {
            expect((process.stdout.write as jest.MockedFunction<typeof process.stdout.write>).mock.calls.map((c) => c[0]).join('')).toMatchInlineSnapshot(`
                build files:
                  [38;5;8msrc/foo/filename.spec.ts                                            [33m  [ignore][0m
                  [38;5;8msrc/foo/filename.stories.ts                                         [33m  [ignore][0m
                  [38;5;8msrc/foo/filename.test.ts                                            [33m  [ignore][0m
                  src/foo/filename.ts                                                 [32m   [build][0m
                  [38;5;8msrc/index.spec.ts                                                   [33m  [ignore][0m
                  [38;5;8msrc/index.stories.ts                                                [33m  [ignore][0m
                  [38;5;8msrc/index.test.ts                                                   [33m  [ignore][0m
                  src/index.ts                                                        [32m   [build][0m
                
            `)
        })
    })
})

describe('default build', () => {
    let buildComplete = false
    let originalPackageJson: Buffer

    beforeAll(() => {
        (process.stdout.write as jest.MockedFunction<typeof process.stdout.write>).mockClear()
    })

    beforeAll(async() => {
        await rm(`${exampleDir}/dist`, { recursive: true, force: true })

        originalPackageJson = await readFile(`${exampleDir}/package.json`)

        chdir(__dirname + '/../example')
    })

    afterAll(async() => {
        await writeFile(`${exampleDir}/package.json`, originalPackageJson)
    })

    test('build without error', async () => {
        await run('ts-build2', ['--exportsMap', 'foo/*,bar:some/other/file'], scriptsConfig)
        buildComplete = true
        expect.assertions(0)
    }, 10000)

    describe('assert on build', () => {
        beforeEach(() => {
            if (!buildComplete) {
                throw new Error('Test requires completed build')
            }
        })

        test('do not export multiple module types in separate folders', async () => {
            expect(existsSync(`${exampleDir}/dist/cjs`)).toBe(false)
            expect(existsSync(`${exampleDir}/dist/esm`)).toBe(false)
            expect(existsSync(`${exampleDir}/dist/types`)).toBe(false)
        })

        test('export modules', async () => {
            const { which } = await dynamicImport('../example/dist/foo/filename.js').catch(() => ({}))

            expect(which).toEqual(expect.any(Function))
            expect(which()).toEqual(realpathSync(`${__dirname}/../example/dist/foo/filename.js`))
        })

        test('export declarations', async () => {
            expect(existsSync('../example/dist/foo/filename.d.ts')).toBe(true)
        })

        test('update package.json', async () => {
            expect(String(await readFile(`${exampleDir}/package.json`))).toMatchInlineSnapshot(`
                {
                    "scripts": {
                        "scripts": "../node_modules/.bin/scripts",
                        "tsc": "../node_modules/.bin/tsc"
                    },
                    "main": "./dist/index.js",
                    "module": "./dist/index.js",
                    "types": "./dist/index.d.ts",
                    "exports": {
                        ".": "./dist/index.js",
                        "./dist/*": "./dist/*.js",
                        "./foo/*": "./dist/foo/*.js",
                        "./bar": "./dist/some/other/file.js"
                    }
                }
            `)
        })

        test('exclude tests and stories per default', () => {
            expect(existsSync(`${exampleDir}/dist/index.spec.js`)).toBe(false)
            expect(existsSync(`${exampleDir}/dist/index.stories.js`)).toBe(false)
            expect(existsSync(`${exampleDir}/dist/index.test.js`)).toBe(false)

            expect(existsSync(`${exampleDir}/dist/foo/filename.test.js`)).toBe(false)

            expect(existsSync(`${exampleDir}/dist/index.test.d.ts`)).toBe(false)
        })

        test('report matches and ignored files to console', () => {
            expect((process.stdout.write as jest.MockedFunction<typeof process.stdout.write>).mock.calls.map((c) => c[0]).join('')).toMatchInlineSnapshot(`
                build files:
                  [38;5;8msrc/foo/filename.spec.ts                                            [33m  [ignore][0m
                  [38;5;8msrc/foo/filename.stories.ts                                         [33m  [ignore][0m
                  [38;5;8msrc/foo/filename.test.ts                                            [33m  [ignore][0m
                  src/foo/filename.ts                                                 [32m   [build][0m
                  [38;5;8msrc/index.spec.ts                                                   [33m  [ignore][0m
                  [38;5;8msrc/index.stories.ts                                                [33m  [ignore][0m
                  [38;5;8msrc/index.test.ts                                                   [33m  [ignore][0m
                  src/index.ts                                                        [32m   [build][0m

            `)
        })
    })
})
