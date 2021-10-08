import fs from 'fs'
import { params, script, stringMap } from 'shared-scripts'
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
    run: async (params: params) => {
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
        execScript(['tsc',
            '--outDir', `${outDir}/cjs`,
            '--target', 'ES5',
            '--module', 'CommonJS',
            '--sourceMap', 'true',
            '--declaration', 'false',
        ])
        execScript(['tsc',
            '--outDir', `${outDir}/types`,
            '--declaration', 'true',
            '--declarationMap', 'true',
            '--emitDeclarationOnly',
        ])

        updatePackageJson(packageJsonFile, outDir, main, exportsMap)
    },
}

function updatePackageJson(
    packageJsonFile: string,
    outDir: string,
    main: string,
    exportsMap: string[],
) {
    const packageJsonString = String(fs.readFileSync(packageJsonFile))
    const indent = packageJsonString.match(/^(\s+)/m)?.[1] || 2
    const packageJson = JSON.parse(packageJsonString)

    const newPackageJson = { ...packageJson }
    delete newPackageJson.main
    delete newPackageJson.module
    delete newPackageJson.types
    delete newPackageJson.exports
    delete newPackageJson.typesVersions

    newPackageJson.main = `./${outDir}/cjs/${main}.js`
    newPackageJson.module = `./${outDir}/esm/${main}.js`
    newPackageJson.types = `./${outDir}/types/${main}.js`

    if (exportsMap.length > 0) {
        newPackageJson.exports = Object.fromEntries([
            createExport(outDir, ['.', main].join(':')),

            // Always allow deep import from dist as workaround
            [`./${outDir}/*`, `./${outDir}/*.js`],

            ...exportsMap.map(path => createExport(outDir, path)),
        ])
        newPackageJson.typesVersions = {
            '*': Object.fromEntries([
                // Do not map type imports from types
                [`${outDir}/types/*`, [`./${outDir}/types/*`]],

                // Map deep imports from dist
                [`${outDir}/cjs/*`, [`./${outDir}/types/*.d.ts`]],
                [`${outDir}/esm/*`, [`./${outDir}/types/*.d.ts`]],

                // Map named modules
                ...mapTypesExports(outDir, exportsMap),

                // Map any other module import to the types
                ['*', ['./dist/types/*.d.ts']],
            ]),
        }
    }

    fs.writeFileSync(packageJsonFile, JSON.stringify(newPackageJson, null, indent))
}

function createExport(
    outDir: string,
    path: string,
) {
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
