import type { config } from 'shared-scripts';
import { rename } from './rename'
import { tsBuild } from './ts-build'
import { tsBuild2 } from './ts-build2';

const scriptsConfig: config = {
    scripts: {
        rename: rename,
        'ts-build': tsBuild,
        'ts-build2': tsBuild2,
    },
}

export default scriptsConfig
