import { assert } from 'chai';
import { promises as fs } from 'fs';

import { packageInfo } from '../src/lib/package_info';

describe('packageInfo', () => {
  it('fields', async () => {
    const piContents = await fs.readFile('./package.json', 'utf-8');
    const pj = JSON.parse(piContents) as typeof packageInfo;

    assert.strictEqual(packageInfo.name, 'vci-logcat');
    assert.strictEqual(packageInfo.version, pj.version);
  });
});
