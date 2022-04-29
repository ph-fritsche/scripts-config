import fs from 'fs'
import { params, script, stringMap } from 'shared-scripts'
import { PackageJson } from './package.json'
import { execScript } from './util'

export const tsBuild: script = {
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
            description: 'Create an exportsMap (comma-separated list of paths)',
            value: ['paths'],
        },
    },
    run: (params: params) => {
        const outDir = (params.options?.outDir as stringMap)?.dir ?? 'dist'
        const packageJsonFile = (params.options.packageJson as stringMap)?.file ?? 'package.json'
        const main = (params.options.main as stringMap)?.file ?? 'index'
        const exportsMap = ((params.options.exportsMap as stringMap)?.paths ?? '').split(',').filter(Boolean)

        execScript(['tsc',
            '--outDir', `${outDir}/esm`,
            '--target', 'ES2020',
            '--module', 'ES2020',
            '--sourceMap', 'true',
            '--declaration', 'false',
        ])
        writePackageType(`${outDir}/esm/package.json`, 'module')

        execScript(['tsc',
            '--outDir', `${outDir}/cjs`,
            '--target', 'ES5',
            '--module', 'CommonJS',
            '--sourceMap', 'true',
            '--declaration', 'false',
        ])
        writePackageType(`${outDir}/cjs/package.json`, 'commonjs')

        execScript(['tsc',
            '--outDir', `${outDir}/types`,
            '--declaration', 'true',
            '--declarationMap', 'true',
            '--emitDeclarationOnly',
        ])

        updatePackageJson(packageJsonFile, outDir, main, exportsMap)
    },
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
    outDir: string,
    main: string,
    exportsMap: string[],
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

    newPackageJson.main = `./${outDir}/cjs/${main}.js`
    newPackageJson.module = `./${outDir}/esm/${main}.js`
    newPackageJson.types = `./${outDir}/types/${main}.d.ts`

    if (exportsMap.length > 0) {
        newPackageJson.exports = Object.fromEntries([
            createExport(outDir, ['.', main].join(':')),

            // Always allow deep import from dist as workaround
            [`./${outDir}/*`, `./${outDir}/*.js`] as const,

            ...exportsMap.map(path => createExport(outDir, path)),
        ])
        newPackageJson.typesVersions = {
            '*': Object.fromEntries([
                // Do not map type imports from types
                [`${outDir}/types/*`, [`./${outDir}/types/*`]] as [string, string[]],

                // Map deep imports from dist
                [`${outDir}/cjs/*`, [`./${outDir}/types/*.d.ts`]] as [string, string[]],
                [`${outDir}/esm/*`, [`./${outDir}/types/*.d.ts`]] as [string, string[]],

                // Map named modules
                ...mapTypesExports(outDir, exportsMap),

                // Map any other module import to the types
                ['*', ['./dist/types/*.d.ts']] as [string, string[]],
            ]),
        }
    }

    fs.writeFileSync(packageJsonFile, JSON.stringify(newPackageJson, null, indent))
}

function createExport(
    outDir: string,
    path: string,
): [string, string | Record<string, string>] {
    const [exportPath, modulePath = exportPath] = path.split(':')
    const distModule = (type: string, p: string) => `./${outDir}/${type}/${p}.js`
    return [
        exportPath === '.' ? '.' : `./${exportPath}`,
        {
            'import': distModule('esm', modulePath),
            'default': distModule('cjs', modulePath),
        },
    ]
}

function mapTypesExports(
    outDir: string,
    exportsMap: string[],
) {
    const typesMappings: Array<[string, string[]]> = []
    for(const path of exportsMap) {
        const [exportPath, modulePath = exportPath] = path.split(':')
        typesMappings.push([
            exportPath,
            [`./${outDir}/types/${modulePath}.d.ts`],
        ])
    }
    return typesMappings
}
