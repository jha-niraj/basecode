import { APPS_WITH_ENV, restoreEnvFiles } from './env-files.mts';

/** `pnpm env:restore`: for a deploy killed so hard its own cleanup never ran (a closed terminal, a force-quit). */
let restored = 0;
for (const app of APPS_WITH_ENV) restored += restoreEnvFiles(app, console.log);
console.log(restored ? `Restored ${restored} file(s).` : 'Nothing to restore.');
