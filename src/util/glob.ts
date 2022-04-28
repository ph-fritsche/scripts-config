import glob from 'glob'

export function globPromise(
    pattern: string,
    opt: glob.IOptions = {},
): Promise<string[]> {
    return new Promise<string[]>((res, rej) => {
        glob(pattern, opt, (error, files) => {
            if (error) {
                rej(error)
            } else {
                res(files)
            }
        })
    })
}
