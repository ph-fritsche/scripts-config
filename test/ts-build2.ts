import { existsSync, readFileSync } from 'fs'
import { readFile } from 'fs/promises'
import { chdir } from 'process'
import { run } from 'shared-scripts'
import scriptsConfig from '../src/config'
import process from 'process'
import '../src/ts-build2/buildTypes'
import { buildTypes } from '../src/ts-build2/buildTypes'
import { PackageJson } from '../src/package.json'
import { runChild, testOnExample } from './_helper'
import { getTscBin } from '../src/util'

// accelerate testing
const mockBuildTsc = {skip: [] as string[]}
jest.mock('../src/ts-build2/buildTypes', () => ({
    buildTypes: (...args: Parameters<typeof buildTypes>) => {
        const dir = process.cwd()
        return mockBuildTsc.skip.some(d => dir.startsWith(d))
            ? Promise.resolve()
            : jest.requireActual<{buildTypes: typeof buildTypes}>('../src/ts-build2/buildTypes').buildTypes(...args)
    },
}))

function testOnBuild(
    dir: string,
    buildArgs: string[],
    tests: (p: {
        getBuildOutput: () => string
        getBuildErrput: () => string
    }) => void,
) {
    let buildComplete = false
    const output: Buffer[] = []
    const errput: Buffer[] = []
    const out = Object.setPrototypeOf({}, process.stdout) as NodeJS.WriteStream
    const err = Object.setPrototypeOf({}, process.stderr) as NodeJS.WriteStream
    out.write = s => !!output.push(Buffer.from(s))
    err.write = s => !!errput.push(Buffer.from(s))

    test('build without error', async () => {
        chdir(dir)
        await run('ts-build2', buildArgs, scriptsConfig, {out, err})
        buildComplete = true
        expect.assertions(0)
    }, 20000)

    describe('assert on build', () => {
        beforeEach(() => {
            if (!buildComplete) {
                throw new Error('Test requires completed build')
            }
        })

        tests({
            getBuildOutput: () => String(Buffer.concat(output)),
            getBuildErrput: () => String(Buffer.concat(errput)),
        })
    })
}

describe.each([
    [
        ['--cjs', '--exportsMap', 'foo/*,bar:some/other/file'],
        {
            'main.cjs': `per main: $exampleDir/dist/cjs/foo/filename.js`,
            'main.mjs': `per main: $exampleDir/dist/esm/foo/filename.js`,
            'sub.cjs': `per submodule: $exampleDir/dist/cjs/foo/filename.js`,
            'sub.mjs': `per submodule: $exampleDir/dist/esm/foo/filename.js`,
            'deep-cjs.cjs': `per dist: $exampleDir/dist/cjs/foo/filename.js`,
            'deep-esm.mjs': `per dist: $exampleDir/dist/esm/foo/filename.js`,
            'deep.mjs': new Error('PATH_NOT_EXPORTED'),
        },
    ],
    [
        ['--exportsMap', 'foo/*,bar:some/other/file'],
        {
            'main.cjs': new Error('REQUIRE_ESM'),
            'main.mjs': `per main: $exampleDir/dist/foo/filename.js`,
            'sub.cjs': new Error('REQUIRE_ESM'),
            'sub.mjs': `per submodule: $exampleDir/dist/foo/filename.js`,
            'deep-cjs.cjs': new Error('NOT_FOUND'),
            'deep-esm.mjs': new Error('NOT_FOUND'),
            'deep.mjs': `per dist: $exampleDir/dist/foo/filename.js`,
        },
    ],
    [
        ['--cjs'],
        {
            'main.cjs': `per main: $exampleDir/dist/cjs/foo/filename.js`,
            'main.mjs': `per main: $exampleDir/dist/esm/foo/filename.js`,
            'sub.cjs': new Error('PATH_NOT_EXPORTED'),
            'sub.mjs': new Error('PATH_NOT_EXPORTED'),
            'deep-cjs.cjs': `per dist: $exampleDir/dist/cjs/foo/filename.js`,
            'deep-esm.mjs': `per dist: $exampleDir/dist/esm/foo/filename.js`,
            'deep.mjs': new Error('PATH_NOT_EXPORTED'),
        },
    ],
    [
        [],
        {
            'main.cjs': new Error('REQUIRE_ESM'),
            'main.mjs': `per main: $exampleDir/dist/foo/filename.js`,
            'sub.cjs': new Error('NOT_FOUND'),
            'sub.mjs': new Error('NOT_FOUND'),
            'deep-cjs.cjs': new Error('NOT_FOUND'),
            'deep-esm.mjs': new Error('NOT_FOUND'),
            'deep.mjs': `per dist: $exampleDir/dist/foo/filename.js`,
        },
    ],
])('export modules: %j', (args, consumers: Record<string, string|Error>) => void testOnExample((dir) => {
    mockBuildTsc.skip.push(dir)
    testOnBuild(`${dir}/example`, args, () => {
        test.each(Object.entries(consumers))('consume build: %s', async (file, expected) => {
            await expect(runChild(`${dir}/consumer`, 'node', file).promise)[
                expected instanceof Error ? 'rejects' : 'resolves'
            ].toHaveProperty(
                expected instanceof Error ? 'errput' : 'output',
                expect.stringMatching(expected instanceof Error ? expected.message : expected.replace('$exampleDir', `${dir}/example`)),
            )
        })
    })
}))

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
])('transpile to target: %s', (target, features) => void testOnExample(dir => {
    mockBuildTsc.skip.push(dir)
    function expectFeature(file: string, token: keyof typeof features) {
        const expectation = expect(readFileSync(`${dir}/example/dist/${file}`))
        ;(features[token] ? expectation : expectation.not).toContain(token)
    }
    testOnBuild(`${dir}/example`, target === 'default' ? [] : ['--target', target], () => {
        // eslint-disable-next-line jest/expect-expect
        test('transpile language feature', () => {
            expectFeature('es2020.js', '??')
            expectFeature('es2020.js', '?.')
            expectFeature('es2021.js', '??=')
        })
    })
}))

describe('configure accepted dual-build', () => void testOnExample(dir => {
    const args = ['--cjs', '--exportsMap', 'foo/*,bar:some/other/file', '--target', 'es5']
    testOnBuild(`${dir}/example`, args, ({getBuildOutput}) => {
        test('report matches and ignored files to console', () => {
            expect(getBuildOutput()).toMatchInlineSnapshot(`
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
            const packageJson = JSON.parse(String(await readFile(`${dir}/example/package.json`))) as PackageJson
            expect(packageJson).toHaveProperty('main', './dist/cjs/index.js')
            expect(packageJson).toHaveProperty('module', './dist/esm/index.js')
            expect(packageJson).toHaveProperty('types', './dist/types/index.d.ts')
            expect(packageJson).toHaveProperty('exports', {
                '.': {
                    'types': './dist/types/index.d.ts',
                    'require': './dist/cjs/index.js',
                    'default': './dist/esm/index.js',
                },
                './dist/cjs/*': './dist/cjs/*',
                './dist/esm/*': './dist/esm/*',
                './foo/*': {
                    'types': './dist/types/foo/*.d.ts',
                    'require': './dist/cjs/foo/*.js',
                    'default': './dist/esm/foo/*.js',
                },
                './bar': {
                    'types': './dist/types/some/other/file.d.ts',
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
            expect(existsSync(`${dir}/example/dist/index.spec.js`)).toBe(false)
            expect(existsSync(`${dir}/example/dist/index.stories.js`)).toBe(false)
            expect(existsSync(`${dir}/example/dist/index.test.js`)).toBe(false)

            expect(existsSync(`${dir}/example/dist/esm/foo/filename.test.js`)).toBe(false)

            expect(existsSync(`${dir}/example/dist/types/index.test.d.ts`)).toBe(false)
        })

        test('output is accepted by tsc', async () => {
            const tscBin = getTscBin(`${dir}/consumer`)
            await expect(runChild(
                `${dir}/consumer`,
                tscBin,
                '--strict',
                '--noEmit',
                'main.ts',
                'sub.ts',
                'deep-esm.ts',
            ).promise).resolves.toEqual({code: 0, output: '', errput: ''})
        }, 25000)

        test('output is accepted by tsc --moduleResolution nodenext', async () => {
            const tscBin = getTscBin(`${dir}/consumer`)
            await expect(runChild(
                `${dir}/consumer`,
                tscBin,
                '--strict',
                '--noEmit',
                '--moduleResolution',
                'nodenext',
                'main.ts',
                'sub.ts',
                'deep-esm.ts',
            ).promise).resolves.toEqual({code: 0, output: '', errput: ''})
        }, 25000)
    })
}))
