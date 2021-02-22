import fs from 'fs'
import process from 'process'
import type { params, script, stringMap } from 'shared-scripts'

export const rename: script = {
    description: 'Rename files per RegExp',
    options: {
        in: {
            description: 'Directory where files should be renamed',
            value: ['dir'],
        },
        caseInsensitive: {
            short: 'i',
            long: false,
            description: 'Case-Insensitive',
        },
        recursive: {
            short: 'r',
            long: false,
            description: 'Include sub-directories',
        },
        dry: {
            description: 'Dry run',
        },
    },
    requiredArgs: [
        {id: 'search', description: 'Regexp search pattern'},
        {id: 'replace', description: 'Replacement'},
    ],
    run(params: params) {
        if (params.options.in) {
            process.chdir((params.options.in as stringMap).dir)
        }

        const regexp = new RegExp(params.args.search, [
            params.options.caseInsensitive && 'i',
        ].filter(Boolean).join(''))

        mvRegExp()

        function mvRegExp() {
            const cwd = process.cwd()
            const d = fs.readdirSync('.')

            for (const f of d) {
                if (fs.lstatSync(f).isDirectory()) {
                    if (params.options.recursive) {
                        process.chdir(f)
                        mvRegExp()
                        process.chdir(cwd)
                    }
                    continue
                }

                const newName = f.replace(regexp, params.args.replace)

                if (newName !== f) {
                    process.stdout.write(`${f} => ${newName}\n`)
                    if (!params.options.dry) {
                        fs.renameSync(f, newName)
                    }
                }
            }
        }
    },
}
