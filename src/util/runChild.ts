import spawn from 'cross-spawn'
import process from 'process'

export async function runChild(
    cmd: string,
    args: string[],
): Promise<void> {
    const child = spawn(cmd, args, {
        stdio: [
            'ignore',
            process.stdout,
            process.stderr,
        ],
    })

    return new Promise<void>((res, rej) => {
        child.once('exit', (code) => {
            if (code) {
                rej(`Command failed with ${code}: ${cmd}\n${JSON.stringify(args, null, 2)}`)
            } else {
                res()
            }
        })
    })
}
