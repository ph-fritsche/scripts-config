import fs from 'fs'
import { InputOptions, OutputOptions, rollup } from 'rollup'
import { swc } from 'rollup-plugin-swc3'
import { params, script, streams, stringMap } from 'shared-scripts'
import { glob } from 'glob'
import { PackageJson } from '../package.json'
import { JscTarget } from '@swc/core'
import { buildTypes } from './buildTypes'

type ExportTypes = 'esm' | 'cjs' | 'types'

export const tsBuild2: script = {
    options: {
        outDir: {
            description: 'Where to redirect the output (default: dist)',
            value: ['dir'],
        },
        packageJson: {
            description: 'Location of package.json (default: package.json)',
            value: ['file'],
        },
        main: {
            description: 'Main file (default: index)',
            value: ['file'],
        },
        exportsMap: {
            description: 'Add paths to exportsMap (comma-separated list of paths)',
            value: ['paths'],
        },
        cjs: {
            description: 'Add CommonJS modules',
        },
        target: {
            description: 'ECMAScript target version',
            value: ['version'],
        },
    },
    run: async (params: params, streams: streams) => {
        const outDir = (params.options?.outDir as stringMap)?.dir ?? 'dist'
        const packageJsonFile = (params.options.packageJson as stringMap)?.file ?? 'package.json'
        const main = (params.options.main as stringMap)?.file ?? 'index'
        const exportsMap = ((params.options.exportsMap as stringMap)?.paths ?? '').split(',').filter(Boolean)
        const cjs = Boolean(params.options.cjs ?? false)
        const target = (params.options.target as stringMap)?.version ?? 'es2022'

        const packageJson = JSON.parse(String(fs.readFileSync(packageJsonFile))) as PackageJson

        const isMultiBuild = cjs

        const paths = {
            esm: isMultiBuild ? `${outDir}/esm` : outDir,
            cjs: isMultiBuild ? `${outDir}/cjs` : outDir,
            types: isMultiBuild ? `${outDir}/types` : outDir,
        }

        const output: OutputOptions[] = [{dir: paths.esm, format: 'es', preserveModules: true}]
        if (cjs) {
            output.push({dir: paths.cjs, format: 'cjs', preserveModules: true})
        }

        const filesGlob = 'src/**/*.{ts,tsx}'
        const ignorePattern = /\.(spec|stories|test)\.\w+$/
        const files = Object.fromEntries(
            (await glob(filesGlob)).map(f => [f, {ignore: ignorePattern.test(f)}]),
        )

        streams.out.write(`build files:\n`)
        Object.entries(files).forEach(([name, {ignore}]) => {
            const prefix = '  '
            const suffix = (ignore ? '[ignore]' : '[build]').padStart(10, ' ')
            const nameWidth = (streams.out.columns ?? 120) - prefix.length - suffix.length
            const nameColor = ignore ? '\x1B[38;5;8m' : ''
            const suffixColor = ignore ? '\x1B[33m' : '\x1B[32m'
            const resetColor = '\x1B[0m'
            const lines = name.match(new RegExp(`.{1,${nameWidth -1}}`, 'g'))
            lines?.forEach((ln, i) => {
                streams.out.write([
                    prefix,
                    nameColor,
                    ln[i === 0 ? 'padEnd' : 'padStart'](nameWidth),
                    i === lines.length - 1 ? suffixColor + suffix : '',
                    resetColor,
                    '\n',
                ].join(''))
            })
        })

        const buildFiles = Object.entries(files).filter(([, {ignore}]) => !ignore).map(([f]) => f)

        await build({
            input: buildFiles,
            external: [
                ...Object.keys(packageJson.dependencies ?? {}),
                ...Object.keys(packageJson.optionalDependencies ?? {}),
                ...Object.keys(packageJson.peerDependencies ?? {}),
            ],
            plugins: [
                swc({
                    exclude: [],
                    jsc: {
                        target: target as JscTarget,
                    },
                }),
            ],
        }, ...output)

        writePackageType(`${paths.esm}/package.json`, 'module')
        if (cjs) {
            writePackageType(`${paths.cjs}/package.json`, 'commonjs')
        }

        await buildTypes('tsconfig.json', paths.types, buildFiles)

        updatePackageJson(packageJsonFile, main, exportsMap, paths, isMultiBuild, cjs)
    },
}

async function build(
    input: InputOptions,
    ...output: OutputOptions[]
) {
    const bundle = await rollup({...input, output})

    await Promise.all(output.map(o => bundle.write(o)))

    await bundle.close()
}

function writePackageType(
    packageJsonFile: string,
    type: 'commonjs'|'module',
) {
    const packageJson = { type }
    fs.writeFileSync(packageJsonFile, JSON.stringify(packageJson, null, 2))
}

function updatePackageJson(
    packageJsonFile: string,
    main: string,
    exportsMap: string[],
    paths: { [k in ExportTypes]: string },
    isMultiBuild: boolean,
    hasCjs: boolean,
) {
    const packageJsonString = String(fs.readFileSync(packageJsonFile))
    const indent = packageJsonString.match(/^(\s+)/m)?.[1] || 2
    const packageJson = JSON.parse(packageJsonString) as PackageJson

    const newPackageJson = { ...packageJson }
    delete newPackageJson.main
    delete newPackageJson.module
    delete newPackageJson.types
    delete newPackageJson.exports
    delete newPackageJson.typesVersions

    newPackageJson.main = `./${paths.cjs}/${main}.js`
    newPackageJson.module = `./${paths.esm}/${main}.js`
    newPackageJson.types = `./${paths.types}/${main}.d.ts`

    if (exportsMap.length > 0 || isMultiBuild) {
        const newPackageJsonExports = [
            createExport(['.', main].join(':'), paths, hasCjs),
        ]

        // Always allow deep import from dist as workaround
        const esmDeep: Record<string, string> = {
            types: `./${paths.types}/*.d.ts`,
            default: `./${paths.esm}/*.js`,
        }
        if (hasCjs) {
            esmDeep['require'] = `./${paths.cjs}/*.js`
            newPackageJsonExports.push([
                `./${paths.cjs}/*.js`,
                {
                    types: `./${paths.types}/*.d.ts`,
                    import: `./${paths.esm}/*.js`,
                    default: `./${paths.cjs}/*.js`,
                },
            ])
        }
        newPackageJsonExports.push([
            `./${paths.esm}/*.js`,
            esmDeep,
        ])

        newPackageJsonExports.push(
            ...exportsMap.map(path => createExport(path, paths, hasCjs)),
        )

        newPackageJson.exports = Object.fromEntries(newPackageJsonExports)

        if (isMultiBuild) {
            newPackageJson.typesVersions = {
                '*': Object.fromEntries([
                    // Do not map type imports from types
                    [`${paths.types}/*`, [`./${paths.types}/*`]] as [string, string[]],

                    // Map deep imports from dist
                    [`${paths.cjs}/*.js`, [`./${paths.types}/*.d.ts`]] as [string, string[]],
                    [`${paths.esm}/*.js`, [`./${paths.types}/*.d.ts`]] as [string, string[]],

                    // Map named modules
                    ...mapTypesExports(paths.types, exportsMap),

                    // Map any other module import to the types
                    ['*', [`./${paths.types}/*.d.ts`]] as [string, string[]],
                ]),
            }
        }
    }

    fs.writeFileSync(packageJsonFile, JSON.stringify(newPackageJson, null, indent))
}

function createExport(
    path: string,
    paths: { [k in ExportTypes]: string },
    hasCjs: boolean,
): [string, string | Record<string, string>] {
    const [exportPath, modulePath = exportPath] = path.split(':')
    const distModule = (type: ExportTypes, p: string, ext: string) => `./${paths[type]}/${p}.${ext}`

    const map: Array<[string, string]> = [['default', distModule('esm', modulePath, 'js')]]
    if (hasCjs) {
        map.unshift(['require', distModule('cjs', modulePath, 'js')])
    }
    map.unshift(['types', distModule('types', modulePath, 'd.ts')])

    return [
        exportPath === '.' ? '.' : `./${exportPath}`,
        map.length > 1 ? Object.fromEntries(map) : map[0][1],
    ]
}

function mapTypesExports(
    typesPath: string,
    exportsMap: string[],
) {
    const typesMappings: Array<[string, string[]]> = []
    for(const path of exportsMap) {
        const [exportPath, modulePath = exportPath] = path.split(':')
        typesMappings.push([
            exportPath,
            [`./${typesPath}/${modulePath}.d.ts`],
        ])
    }
    return typesMappings
}

