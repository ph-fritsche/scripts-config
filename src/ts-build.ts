import type { params, script, stringMap } from 'shared-scripts'
import { sync } from 'cross-spawn'

const script: script = {
    options: {
        outDir: {
            description: 'Where to redirect the output',
            value: ['dir'],
        },
    },
    run: (params: params) => {
        const outDir = (params.options?.outDir as stringMap)?.dir ?? 'dist'

        execScript(['tsc', '--outDir', outDir, '--target', 'ES6', '--sourceMap', 'false'])
        execScript(['scripts', 'rename', '--in', outDir, '\\.js(\\.|$)', '.esm.js$1'])
        execScript(['tsc', '--outDir', outDir, '--target', 'ES3', '--declaration', 'false'])
    },
}

function execScript(args: string[]) {
    const child = sync('yarn', args)
    process.stdout.write(child.stdout)
    process.stderr.write(child.stderr)
    if (child.status) {
        process.exit(1)
    }
}

export default script
