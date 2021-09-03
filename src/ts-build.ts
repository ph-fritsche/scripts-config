import { params, script, stringMap } from 'shared-scripts'
import { execScript } from './util'

export const tsBuild: script = {
    options: {
        outDir: {
            description: 'Where to redirect the output',
            value: ['dir'],
        },
    },
    run: async (params: params) => {
        const outDir = (params.options?.outDir as stringMap)?.dir ?? 'dist'

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
    },
}
