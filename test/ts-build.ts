import { run, streams } from 'shared-scripts'
import scriptsConfig from '../src/config'
import { tsBuild2 } from '../src/ts-build2'

test('relay to ts-build2', async () => {
    const impl = jest.spyOn(tsBuild2, 'run').mockImplementation(() => void 0)
    const streamsStub = {in: {}, out: {}, err: {}} as streams

    await run(
        'ts-build',
        ['--exportsMap', 'foo/*,bar:some/other/file'],
        scriptsConfig,
        streamsStub,
    )

    expect(impl).toHaveBeenCalledWith({
        options: {
            exportsMap: {
                paths: 'foo/*,bar:some/other/file',
            },
            cjs: true,
        },
        args: {},
        variadic: [],
    }, streamsStub)
})
