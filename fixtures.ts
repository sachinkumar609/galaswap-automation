// fixtures.ts
import { test as base, chromium, type BrowserContext } from '@playwright/test';
import { WalletSetup } from './walletSetup';
import path from 'path';
import fs from 'fs';

export const test = base.extend<{
  context: BrowserContext;
  wallet: WalletSetup;
}>({
  context: async ({ }, use) => {
    // Use an absolute path for extension
    const  extensionPath = '/home/user/playwrightMetamask/tsPlay/metamask';

    console.log('📂 Loading MetaMask from:', extensionPath);

    if (!fs.existsSync(extensionPath)) {
      throw new Error(`MetaMask extension not found at ${extensionPath}.`);
    }

    const context = await chromium.launchPersistentContext('', {
      headless: false,
      channel: 'chrome',
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
      ],
      
    });

    try {
      let serviceWorker = context.serviceWorkers()[0];
      if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker', { timeout: 30000 });
      }
      console.log('✅ MetaMask service worker ready');
      await use(context);
    } catch (error) {
      console.error('❌ Failed to initialize MetaMask:', error);
      throw error;
    } finally {
      await context.close();
    }
  },
  wallet: async ({ context }, use) => {
    const wallet = new WalletSetup(context);
    await use(wallet);
  },
});

export { expect } from '@playwright/test';
