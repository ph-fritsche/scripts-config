import process from 'process'

jest.mock('process', () => {
    const realProcess = jest.requireActual<typeof process>('process')

    return ({
        ...realProcess,
        argv: [],
        stdin: { read: jest.fn() },
        stderr: {
            ...realProcess.stderr,
            write: jest.fn(),
        },
        on: jest.fn(),
        once: jest.fn(),
        off: jest.fn(),
        stdout: {
            ...realProcess.stdout,
            columns: 80,
            write: jest.fn(),
        },
        exit: (code: number) => {
            throw new Error(String(code))
        },
    })
})
