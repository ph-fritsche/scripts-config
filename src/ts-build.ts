import { params, script } from 'shared-scripts'
import { tsBuild2 } from './ts-build2'

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
    run: (params: params, streams) => tsBuild2.run({
        ...params,
        options: {
            ...params.options,
            cjs: true,
        },
    }, streams),
}
