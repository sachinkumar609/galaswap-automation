// walletSetup.ts
import { BrowserContext, Page, expect } from '@playwright/test';

export interface WalletSetupOptions {
  password?: string;
  network?: string;
  timeout?: number;
  mnemonic?: string[];
}

const DEFAULT_MNEMONIC = [
  'vast', 'flip', 'matter', 'ship', 'predict', 'alcohol', 'black', 'jacket',
  'observe', 'hour', 'kid', 'view'
];

export class WalletSetup {
  private context: BrowserContext;
  private options: Required<WalletSetupOptions>;

  constructor(context: BrowserContext, options: WalletSetupOptions = {}) {
    this.context = context;
    this.options = {
      password: options.password || process.env.METAMASK_PASSWORD || 'Test@123',
      network: options.network || 'ethereum',
      timeout: options.timeout || 60000,
      mnemonic: options.mnemonic || DEFAULT_MNEMONIC,
    };
  }

  async unlockWallet(popup: Page): Promise<void> {
  console.log('🔑 Unlocking MetaMask...');
  // Check if unlock UI is present
  const passwordInput = popup.getByLabel('Password', { exact: false });
  const unlockButton = popup.getByRole('button', { name: /unlock/i });
  const pwVisible = await passwordInput.isVisible({ timeout: 2000 }).catch(() => false);
  const btnVisible = await unlockButton.isVisible({ timeout: 2000 }).catch(() => false);

  if (pwVisible && btnVisible) {
    let unlocked = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await popup.bringToFront();
        await popup.waitForLoadState('domcontentloaded');
        if (await passwordInput.isVisible({ timeout: 1000 }).catch(() => false) &&
            await unlockButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await passwordInput.fill(this.options.password);
          await unlockButton.click();
          console.log(`✅ Wallet unlocked via password (attempt ${attempt})`);
          unlocked = true;
          break;
        }
      } catch (error) {
        console.warn(`⚠️ [Attempt ${attempt}] Error during wallet unlock:`, error);
      }
      await popup.waitForTimeout(1000);
    }
    if (!unlocked) throw new Error('❌ Failed to unlock wallet after multiple attempts');
  } else {
    console.log('ℹ️ Unlock screen not visible or already unlocked');
  }
}

async confirmTransaction(popup: Page): Promise<void> {
  console.log('⏳ Waiting for transaction confirmation...');
  // Check if confirm/sign/connect UI is present
  const confirmButton = popup.getByRole('button', { name: /confirm|sign|connect|approve|ok|next/i });
  const btnVisible = await confirmButton.isVisible({ timeout: 2000 }).catch(() => false);

  if (btnVisible) {
    let confirmed = false;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await popup.bringToFront();
        await popup.waitForLoadState('domcontentloaded');
        if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await confirmButton.click();
          console.log(`✅ Transaction confirmed (attempt ${attempt})`);
          confirmed = true;
          break;
        }
      } catch (error) {
        console.warn(`⚠️ [Attempt ${attempt}] Error during confirm transaction:`, error);
      }
      await popup.waitForTimeout(1000);
    }
    if (!confirmed) throw new Error('❌ Failed to confirm transaction after multiple attempts');
  } else {
    console.log('ℹ️ No confirm/sign/connect/approve/ok/next button visible (may already be confirmed)');
  }
}


  async handlePopup(): Promise<Page> {
    console.log('⏳ Waiting for MetaMask popup...');
    // Check for already-open popup first
    const popup = this.context.pages().find(p => 
      p.url().startsWith('chrome-extension://') && !p.url().endsWith('/home.html')
    );
    if (popup) {
      console.log('✅ Found already opened MetaMask popup');
      return popup;
    }
    // Else wait for a new popup
    const newPopup = await this.context.waitForEvent('page', { timeout: 25000 });
    console.log('✅ MetaMask popup opened');
    return newPopup;
  }

  async handleAllPopups(): Promise<void> {
    let handled = false;
    let tries = 0;
    const maxTries = 5;
    do {
      const popups = this.context.pages().filter(
        page => page.url().startsWith('chrome-extension://') && !page.url().endsWith('/home.html')
      );
      if (popups.length) {
        for (const popup of popups) {
          try {
            await popup.bringToFront();
            await this.unlockWallet(popup);
            await this.confirmTransaction(popup);
            await popup.close();
            handled = true;
          } catch {
            // Continue silently
          }
        }
      } else {
        handled = false;
      }
      tries++;
      if (tries < maxTries) await new Promise(res => setTimeout(res, 2000));
    } while (handled && tries < maxTries);
  }

  async switchNetwork(network: string): Promise<void> {
    console.log(`⏳ Switching to ${network} network...`);
    try {
      const popup = await this.handlePopup();
      await this.unlockWallet(popup);
      // Try to find the network/chain button by multiple labels
      const networkButton = popup.getByRole('button', { name: /network|chain|ethereum/i });
      await networkButton.click();
      const networkOption = popup.getByRole('button', { name: new RegExp(network, 'i') });
      await networkOption.click();
      console.log(`✅ Switched to ${network} network`);
    } catch (error) {
      console.error(`❌ Failed to switch to ${network} network:`, error);
      throw error;
    }
  }

  async verifyConnection(page: Page): Promise<string> {
    console.log('⏳ Verifying wallet connection...');
    try {
      const profileDropdown = page.locator('#dropdown-basic');
      await profileDropdown.waitFor({ state: 'visible', timeout: this.options.timeout });
      await profileDropdown.click();
      const selectors = [
        '.copyaddress',
        '[data-testid="wallet-address"]',
        '.wallet-address',
        '.address',
        'div[class*="address"]'
      ];
      for (const sel of selectors) {
        const element = page.locator(sel);
        if ((await element.count()) > 0) {
          const text = await element.textContent();
          if (text) {
            console.log('✅ Wallet connected:', text.trim());
            await profileDropdown.click(); // Close dropdown
            return text.trim();
          }
        }
      }
      throw new Error('Wallet address not found');
    } catch (error) {
      console.error('❌ Failed to verify wallet connection:', error);
      throw error;
    }
  }

  async setupWallet(): Promise<void> {
    console.log('🔧 Setting up MetaMask wallet...');
    try {
      const pages = this.context.pages();
      await Promise.all(pages.map(p => p.waitForLoadState('domcontentloaded')));
      let extensionPage = pages.find(p => p.url().startsWith('chrome-extension://'));
      if (!extensionPage) {
        extensionPage = await this.context.waitForEvent('page', { timeout: 10000 });
        await extensionPage.waitForLoadState('domcontentloaded');
        if (!extensionPage.url().startsWith('chrome-extension://')) throw new Error('MetaMask extension page not found');
      } else {
        await extensionPage.bringToFront();
        await extensionPage.reload();
        await extensionPage.waitForLoadState('networkidle');
      }
      await this.setupMetaMask(extensionPage);
    } catch (error) {
      console.error('❌ Failed to setup MetaMask:', error);
      throw error;
    }
  }

  private async setupMetaMask(page: Page): Promise<void> {
    // Check if onboarding screen is visible
    const onboardingCheckbox = page.locator('[data-testid="onboarding-terms-checkbox"]');
    if (await onboardingCheckbox.isVisible().catch(() => false)) {
      console.log('🧭 Starting MetaMask onboarding...');
      await onboardingCheckbox.click();
      // Import wallet flow, robust to future UI wording
      await page.getByRole('button', { name: /import an existing wallet/i }).click();
      await page.getByRole('button', { name: /i agree/i }).click();
      const mnemonic = this.options.mnemonic;
      console.log('🔐 Filling seed phrase...');
      for (let i = 0; i < mnemonic.length; i++) {
        await page.locator(`#import-srp__srp-word-${i}`).fill(mnemonic[i]);
      }
      await page.getByRole('button', { name: /confirm secret recovery phrase|confirm/i }).click();
      await page.locator('[data-testid="create-password-new"]').fill(this.options.password);
      await page.locator('[data-testid="create-password-confirm"]').fill(this.options.password);
      //await page.locator('input[type="checkbox"]').first().check();
      await page.getByRole('button', { name: /import my wallet/i }).click();
      // Sometimes there are multiple 'Done', 'Next', etc.
      for (let i = 0; i < 3; i++) {
        const nextBtn = page.getByRole('button', { name: /done|next|got it|close/i });
        if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await nextBtn.click();
        }
      }
      await page.waitForLoadState('networkidle');
      const addressLocator = page.locator("[data-testid='app-header-copy-button'] span span");
      await addressLocator.waitFor({ state: 'visible', timeout: this.options.timeout });
      const address = (await addressLocator.textContent())?.trim() || '';
      console.log('✅ Wallet Address:', address);
      expect(address).toMatch(/^0x[a-fA-F0-9]+(\.{3}[a-fA-F0-9]+)?$/);
      expect(address.length).toBeGreaterThan(10);
    } else {
      console.log('⚠️ Wallet already set up or onboarding UI not visible.');
    }
    await page.close();
    console.log('✅ Wallet setup completed');
  }
}
