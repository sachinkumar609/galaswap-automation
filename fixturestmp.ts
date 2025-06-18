import { test as base } from '@playwright/test';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

export const test = base.extend<{
  userDataDir: string
}>({
  userDataDir: async ({}, use) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-metamask-'));
    await use(tempDir);
    fs.removeSync(tempDir);
  }
});
