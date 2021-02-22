import type { config } from 'shared-scripts';
import { rename } from './rename'
import { tsBuild } from './ts-build'

const scriptsConfig: config = {
    scripts: {
        rename: rename,
        'ts-build': tsBuild,
    },
}

export default scriptsConfig
