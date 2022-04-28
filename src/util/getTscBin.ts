import fs from 'fs'
import path from 'path'
import { sync } from 'cross-spawn';

export function getTscBin(): string {
    let d = process.cwd()
    for(;;) {
        if (fs.existsSync(`${d}/node_modules/.bin/tsc`)) {
            return `${d}/node_modules/.bin/tsc`
        }
        const parent = path.dirname(d)
        if (parent === d) {
            break
        }
        d = parent
    }

    const child = sync('tsc', ['-v'])
    if (child.error) {
        throw new Error('Could not locate `tsc`')
    }
    return 'tsc'
}
