import fs from 'fs'
import path from 'path'
import tmp from 'tmp'
import { getTscBin, runChild } from '../util'

export async function buildTypes(
    tsconfigFile: string,
    typesPath: string,
    files: string[],
) {
    const tmpFile = tmp.fileSync({
        tmpdir: path.dirname(tsconfigFile),
        prefix: 'tsconfig.tmp',
    })
    fs.writeFileSync(tmpFile.name, JSON.stringify({
        extends: path.resolve(tsconfigFile),
        compilerOptions: {
            noEmit: false,
            declaration: true,
            emitDeclarationOnly: true,
        },
        include: files.map(f => path.resolve(f)),
    }))

    await runChild(getTscBin(), [
        '--project', tmpFile.name,
        '--outDir', typesPath,
    ]).finally(tmpFile.removeCallback)
}
