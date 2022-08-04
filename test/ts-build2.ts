import { realpathSync, existsSync, readFileSync } from 'fs'
import { readFile, rm, writeFile } from 'fs/promises'
import { chdir } from 'process'
import { run } from 'shared-scripts'
import scriptsConfig from '../src/config'
import process from 'process'
import spawn from 'cross-spawn'
import '../src/ts-build2/buildTypes'
import { buildTypes } from '../src/ts-build2/buildTypes'
import { PackageJson } from '../src/package.json'

// accelerate testing
const mockBuildTsc = {skip: false}
jest.mock('../src/ts-build2/buildTypes', () => ({
    buildTypes: (...args: Parameters<typeof buildTypes>) => {
        return mockBuildTsc.skip
            ? Promise.resolve()
            : jest.requireActual<{buildTypes: typeof buildTypes}>('../src/ts-build2/buildTypes').buildTypes(...args)
    },
}))

const exampleDir = realpathSync(`${__dirname}/../example`)
const exampleConsumerDir = realpathSync(`${__dirname}/../example-consumer`)

/* Run file per `node` */
function runConsumer(cmd: string, ...args: string[]) {
    return new Promise<{
        code: number
        output: string
        errput: string
    }>((resolve, reject) => {
        const output: Buffer[] = []
        const errput: Buffer[] = []

        const child = spawn(cmd, args, {cwd: exampleConsumerDir})

        child.stdout?.on('data', (b: Buffer) => output.push(b))
        child.stderr?.on('data', (b: Buffer) => errput.push(b))
        child.once('exit', (code, signal) => {
            if (signal !== null) {
                throw new Error(`${cmd} ${JSON.stringify(args)} aborted with signal "${signal}"`)
            }
            (code ? reject : resolve)({
                code: Number(code),
                output: String(Buffer.concat(output)).trim(),
                errput: String(Buffer.concat(errput)).trim(),
            })
        })
    })
}

function testOnBuild(
    buildArgs: string[],
    tests: () => void,
) {
    let buildComplete = false
    let originalPackageJson: Buffer

    beforeAll(() => {
        (process.stdout.write as jest.MockedFunction<typeof process.stdout.write>).mockClear()
    })

    beforeAll(async () => {
        await rm(`${exampleDir}/dist`, { recursive: true, force: true })

        originalPackageJson = await readFile(`${exampleDir}/package.json`)

        chdir(__dirname + '/../example')
    })

    afterAll(async () => {
        await writeFile(`${exampleDir}/package.json`, originalPackageJson)
    })

    test('build without error', async () => {
        await run('ts-build2', buildArgs, scriptsConfig)
        buildComplete = true
        expect.assertions(0)
    }, 10000)

    describe('assert on build', () => {
        beforeEach(() => {
            if (!buildComplete) {
                throw new Error('Test requires completed build')
            }
        })

        tests()
    })
}

describe.each([
    [
        ['--cjs', '--exportsMap', 'foo/*,bar:some/other/file'],
        {
            'main.cjs': `per main: ${exampleDir}/dist/cjs/foo/filename.js`,
            'main.mjs': `per main: ${exampleDir}/dist/esm/foo/filename.js`,
            'sub.cjs': `per submodule: ${exampleDir}/dist/cjs/foo/filename.js`,
            'sub.mjs': `per submodule: ${exampleDir}/dist/esm/foo/filename.js`,
            'deep-cjs.cjs': `per dist: ${exampleDir}/dist/cjs/foo/filename.js`,
            'deep-esm.mjs': `per dist: ${exampleDir}/dist/esm/foo/filename.js`,
            'deep.mjs': new Error('PATH_NOT_EXPORTED'),
        },
    ],
    [
        ['--exportsMap', 'foo/*,bar:some/other/file'],
        {
            'main.cjs': new Error('REQUIRE_ESM'),
            'main.mjs': `per main: ${exampleDir}/dist/foo/filename.js`,
            'sub.cjs': new Error('REQUIRE_ESM'),
            'sub.mjs': `per submodule: ${exampleDir}/dist/foo/filename.js`,
            'deep-cjs.cjs': new Error('NOT_FOUND'),
            'deep-esm.mjs': new Error('NOT_FOUND'),
            'deep.mjs': `per dist: ${exampleDir}/dist/foo/filename.js`,
        },
    ],
    [
        ['--cjs'],
        {
            'main.cjs': `per main: ${exampleDir}/dist/cjs/foo/filename.js`,
            'main.mjs': `per main: ${exampleDir}/dist/esm/foo/filename.js`,
            'sub.cjs': new Error('PATH_NOT_EXPORTED'),
            'sub.mjs': new Error('PATH_NOT_EXPORTED'),
            'deep-cjs.cjs': `per dist: ${exampleDir}/dist/cjs/foo/filename.js`,
            'deep-esm.mjs': `per dist: ${exampleDir}/dist/esm/foo/filename.js`,
            'deep.mjs': new Error('PATH_NOT_EXPORTED'),
        },
    ],
    [
        [],
        {
            'main.cjs': new Error('REQUIRE_ESM'),
            'main.mjs': `per main: ${exampleDir}/dist/foo/filename.js`,
            'sub.cjs': new Error('NOT_FOUND'),
            'sub.mjs': new Error('NOT_FOUND'),
            'deep-cjs.cjs': new Error('NOT_FOUND'),
            'deep-esm.mjs': new Error('NOT_FOUND'),
            'deep.mjs': `per dist: ${exampleDir}/dist/foo/filename.js`,
        },
    ],
])('correct module exports: %j', (args, consumers: Record<string, string|Error>) => {
    mockBuildTsc.skip = true
    testOnBuild(args, () => {
        test.each(Object.entries(consumers))('consume build: %s', async (file, expected) => {
            await expect(runConsumer('node', file))[
                expected instanceof Error ? 'rejects' : 'resolves'
            ].toHaveProperty(
                expected instanceof Error ? 'errput' : 'output',
                expect.stringMatching(expected instanceof Error ? expected.message : expected),
            )
        })
    })
})

describe.each([
    [
        'es2019',
        {
            '??': false,
            '?.': false,
            '??=': false,
        },
        'es2020',
        {
            '??': true,
            '?.': true,
            '??=': false,
        },
        'default',
        {
            '??': true,
            '?.': true,
            '??=': true,
        },
    ],
])('transpile to target: %s', (target, features) => {
    mockBuildTsc.skip = true
    function expectFeature(file: string, token: keyof typeof features) {
        const expectation = expect(readFileSync(`${exampleDir}/dist/${file}`))
        ;(features[token] ? expectation : expectation.not).toContain(token)
    }
    testOnBuild(target === 'default' ? [] : ['--target', target], () => {
        // eslint-disable-next-line jest/expect-expect
        test('transpile language feature', () => {
            expectFeature('es2020.js', '??')
            expectFeature('es2020.js', '?.')
            expectFeature('es2021.js', '??=')
        })
    })
})

describe('configure and report', () => {
    mockBuildTsc.skip = false
    const args = ['--cjs', '--exportsMap', 'foo/*,bar:some/other/file', '--target', 'es5']
    testOnBuild(args, () => {
        test('report matches and ignored files to console', () => {
            expect((process.stdout.write as jest.MockedFunction<typeof process.stdout.write>).mock.calls.map((c) => c[0]).join('')).toMatchInlineSnapshot(`
                build files:
                  src/es2020.ts                                                       [32m   [build][0m
                  src/es2021.ts                                                       [32m   [build][0m
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

        test('export declarations', () => {
            expect(existsSync('../example/dist/types/foo/filename.d.ts')).toBe(true)
        })

        test('update package.json', async () => {
            const packageJson = JSON.parse(String(await readFile(`${exampleDir}/package.json`))) as PackageJson
            expect(packageJson).toHaveProperty('main', './dist/cjs/index.js')
            expect(packageJson).toHaveProperty('module', './dist/esm/index.js')
            expect(packageJson).toHaveProperty('types', './dist/types/index.d.ts')
            expect(packageJson).toHaveProperty('exports', {
                '.': {
                    'require': './dist/cjs/index.js',
                    'default': './dist/esm/index.js',
                },
                './dist/cjs/*': './dist/cjs/*',
                './dist/esm/*': './dist/esm/*',
                './foo/*': {
                    'require': './dist/cjs/foo/*.js',
                    'default': './dist/esm/foo/*.js',
                },
                './bar': {
                    'require': './dist/cjs/some/other/file.js',
                    'default': './dist/esm/some/other/file.js',
                },
            })
            expect(packageJson).toHaveProperty('typesVersions', {
                '*': {
                    'dist/types/*': [
                        './dist/types/*',
                    ],
                    'dist/cjs/*.js': [
                        './dist/types/*.d.ts',
                    ],
                    'dist/esm/*.js': [
                        './dist/types/*.d.ts',
                    ],
                    'foo/*': [
                        './dist/types/foo/*.d.ts',
                    ],
                    'bar': [
                        './dist/types/some/other/file.d.ts',
                    ],
                    '*': [
                        './dist/types/*.d.ts',
                    ],
                },
            })
        })

        test('exclude tests and stories per default', () => {
            expect(existsSync(`${exampleDir}/dist/index.spec.js`)).toBe(false)
            expect(existsSync(`${exampleDir}/dist/index.stories.js`)).toBe(false)
            expect(existsSync(`${exampleDir}/dist/index.test.js`)).toBe(false)

            expect(existsSync(`${exampleDir}/dist/esm/foo/filename.test.js`)).toBe(false)

            expect(existsSync(`${exampleDir}/dist/types/index.test.d.ts`)).toBe(false)
        })

        test('output is accepted by tsc: %s', async () => {
            await expect(runConsumer('tsc', '--noEmit', 'main.ts', 'sub.ts', 'deep-esm.ts')).resolves.toEqual({code: 0, output: '', errput: ''})
        }, 10000)
    })
})
