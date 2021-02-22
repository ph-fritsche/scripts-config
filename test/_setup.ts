jest.mock('process', () => {
    const process = jest.requireActual('process')

    return ({
        ...process,
        argv: [],
        stdin: { read: jest.fn() },
        stdout: { write: jest.fn() },
        stderr: { write: jest.fn() },
        exit: jest.fn(),
    })
})
