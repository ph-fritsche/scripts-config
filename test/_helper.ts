import spawn from 'cross-spawn'
import { existsSync, mkdirSync, realpathSync } from 'fs'
import { cp, symlink } from 'fs/promises'
import { tmpNameSync } from 'tmp'

const projectDir = realpathSync(`${__dirname}/..`)
export function testOnExample(tests: (dir: string) => void) {
    if (!existsSync(`${projectDir}/tmp`)) {
        mkdirSync(`${projectDir}/tmp`)
    }
    const tmpdir = tmpNameSync({tmpdir: `${projectDir}/tmp`})

    beforeAll(async () => {
        mkdirSync(tmpdir)
        await Promise.all([
            cp(`${projectDir}/example`, `${tmpdir}/example`, { recursive: true }),
            cp(`${projectDir}/example-consumer`, `${tmpdir}/consumer`, { recursive: true }),
        ])
        await symlink(`${tmpdir}`, `${tmpdir}/consumer/node_modules`)
    })

    afterAll(async () => {
        // await rm(tmpdir, { recursive: true })
    })

    tests(tmpdir)
}

export function runChild(cwd: string, cmd: string, ...args: string[]) {
    const child = spawn(cmd, args, { cwd })

    const output: Buffer[] = []
    child.stdout?.on('data', (b: Buffer) => output.push(b))
    const errput: Buffer[] = []
    child.stderr?.on('data', (b: Buffer) => errput.push(b))

    const promise = new Promise<{
        code: number
        output: string
        errput: string
    }>((resolve, reject) => {
        child.once('exit', (code, signal) => {
            if (signal !== null) {
                throw new Error(`${cmd} ${JSON.stringify(args)} aborted with signal "${signal}"`)
            }
            (code ? reject : resolve)({
                code: Number(code),
                output: String(Buffer.concat(output)).trim(),
                errput: String(Buffer.concat(errput)).trim(),
            })
        })
    })

    return {child, promise}
}
