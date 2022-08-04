import process from 'process'
import { execScript } from '../../src/util'

test('exit when child process fails', () => {
    const exit = jest.spyOn(process, 'exit')
        .mockImplementationOnce(() => void 0 as never)

    execScript(['exit', '2'])

    expect(exit).toBeCalledWith(1)
})
