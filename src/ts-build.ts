import { params, run, script, stringMap } from 'shared-scripts'
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

        execScript(['tsc', '--outDir', outDir, '--target', 'ES6', '--sourceMap', 'false'])

        await run('rename', ['-r', '--in', outDir, '^([^.]+)\\.js(\\.|$)', '$1.esm.js$2'])

        execScript(['tsc', '--outDir', outDir, '--target', 'ES3', '--declaration', 'false'])
    },
}
