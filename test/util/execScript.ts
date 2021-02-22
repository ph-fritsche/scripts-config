import { exit } from 'process'
import { execScript } from '../../src/util'

test('exit when child process fails', () => {
    execScript(['exit', '2'])

    expect(exit).toBeCalledWith(1)
})
