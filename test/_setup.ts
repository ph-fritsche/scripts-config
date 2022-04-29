import process from 'process'

jest.mock('process', () => {
    const realProcess = jest.requireActual<typeof process>('process')

    return ({
        ...realProcess,
        argv: [],
        stdin: { read: jest.fn() },
        stdout: { write: jest.fn() },
        stderr: { write: jest.fn() },
        exit: jest.fn(),
    })
})
