import { chromium, BrowserContext, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { clearBrowserContext } from './clearContext';

// Type for wallet setup
type WalletSetup = {
  setupWallet(): Promise<void>;
  unlockWallet(page: Page): Promise<void>;
  confirmTransaction(page: Page): Promise<void>;
  verifyConnection(page: Page): Promise<string>;
};
type WalletSetupClass = new (context: BrowserContext) => WalletSetup;

export class MetaMaskConnector {
  context: BrowserContext | undefined;
  extensionId: string | undefined;
  wallet?: WalletSetup;

  constructor(
    private walletSetupClass: WalletSetupClass,
    private extensionPath: string = '/home/user/playwrightMetamask/galaSwap-automation/metamask',
    private userDataDir: string = path.resolve(__dirname, '../user-data')
  ) {}

  async launchContext() {
    console.log('🚀 Launching MetaMask from:', this.extensionPath);
    console.log('📁 Using user data directory:', this.userDataDir);

    fs.mkdirSync(this.userDataDir, { recursive: true });

    this.context = await chromium.launchPersistentContext(this.userDataDir, {
      channel: 'chrome',
      headless: false,
      args: [
        `--disable-extensions-except=${this.extensionPath}`,
        `--load-extension=${this.extensionPath}`,
      ],
      viewport: { width: 1680, height: 1050 },
      // slowMo: 200,
    });

    // Wait for MetaMask extension's service worker to load
    let [background] = this.context.serviceWorkers();
    if (!background) background = await this.context.waitForEvent('serviceworker');
    const match = background.url().match(/^chrome-extension:\/\/([a-z]+)\//);
    this.extensionId = match?.[1];
    if (!this.extensionId) throw new Error('❌ Failed to extract MetaMask extension ID');

    this.wallet = new this.walletSetupClass(this.context);
  }

  /**
   * Connects the wallet to a dApp and returns the page and wallet address.
   */
  async connectWallet(dappUrl: string): Promise<{ page: Page; address: string }> {
    if (!this.context || !this.extensionId) throw new Error('Call launchContext() first.');

    // 1. Prepare MetaMask (wallet onboarding/restore if needed)
    const metamaskPage = await this.context.newPage();
    await metamaskPage.goto(`chrome-extension://${this.extensionId}/home.html`);
    await metamaskPage.waitForLoadState('domcontentloaded');
    if (!this.wallet) throw new Error('Wallet is not initialized. Call launchContext() first.');
    await this.wallet.setupWallet();

    // 2. Open dApp
    const dappPage = await this.context.newPage();
    await dappPage.bringToFront();
    await dappPage.goto(dappUrl);
    await dappPage.waitForLoadState('networkidle');
    await dappPage.waitForTimeout(1000); // Allow dApp to initialize

    // 3. Determine connect flow
    const connectButton = dappPage.getByRole('button', { name: /connect wallet/i }).first();
    const profileDropdown = dappPage.locator('#dropdown-basic');
    let popupPromise: Promise<Page> | undefined;

    if (await connectButton.isVisible({ timeout: 10000 }).catch(() => false)) {
      // Listen for MetaMask popup if connect is triggered
      popupPromise = this.context.waitForEvent('page');
      await connectButton.click();

      const metamaskOption = dappPage.getByRole('button', { name: /metamask/i });
      await metamaskOption.waitFor({ state: 'visible', timeout: 10000 });
      await metamaskOption.click();
      console.log('🟢 Triggered dApp connect wallet flow.');
    } else if (await profileDropdown.isVisible({ timeout: 30000 }).catch(() => false)) {
      // Already connected, no popup needed
      console.log('🟢 Wallet already connected, skipping connect flow.');
      await this.wallet.unlockWallet(dappPage);
      await this.safeBringToFront(dappPage);
      await this.closeOtherExtensionPages(dappPage);
    }

    // 4. Handle MetaMask popup (if present)
    let popup: Page | undefined;
    if (popupPromise) {
      try {
        popup = await popupPromise;
        await popup.waitForLoadState('domcontentloaded');
      } catch {
        // Fallback: find popup manually
        const foundPopup = this.context.pages().find(
          p => !p.isClosed() && p.url().startsWith('chrome-extension://') && !p.url().endsWith('/home.html')
        );
        if (!foundPopup) {
          const openUrls = this.context.pages().map(p => p.url());
          throw new Error(`Could not find MetaMask popup. Open pages: ${JSON.stringify(openUrls)}`);
        }
        popup = foundPopup;
        await popup.waitForLoadState('domcontentloaded');
        await this.safeBringToFront(popup);
        await this.wallet.unlockWallet(popup);
      }
    }

    // 5. Bring popup to front and unlock wallet if needed
    if (popup && !popup.isClosed()) {
      for (let i = 0; i < 5; i++) {
        try {
          await popup.waitForTimeout(2000);
          await this.safeBringToFront(popup);
          const pwInput = popup.getByLabel('Password', { exact: false });
          if (await pwInput.isVisible({ timeout: 3000 }).catch(() => false)) break;
        } catch {
          await new Promise(res => setTimeout(res, 500));
        }
      }
      await this.wallet.unlockWallet(popup);

      // 6. Confirm connection/transaction if needed
      const confirmBtn = popup.getByRole('button', { name: /confirm|sign|connect|approve|ok|next/i });
      const confirmBtnVisible = await confirmBtn.isVisible({ timeout: 10000 }).catch(() => false);
      if (confirmBtnVisible) {
        await this.wallet.confirmTransaction(popup);
      } else {
        console.log('🔗 No confirm needed, only unlock performed.');
      }
    }

    // 7. Cleanup: close all extension popups except main dApp page
    await this.closeOtherExtensionPages(dappPage);

    // 8. Finalize: bring dApp to front and verify connection
    await this.safeBringToFront(dappPage);
    const address = await this.wallet.verifyConnection(dappPage);

    // Optionally close the popup if it's still open
    if (popup && !popup.isClosed()) {
      await popup.close().catch(() => {});
    }

    return { page: dappPage, address };
  }

  /**
   * Closes all MetaMask extension pages except the main dApp page.
   */
  private async closeOtherExtensionPages(dappPage: Page) {
    if (!this.context) return;
    for (const p of this.context.pages()) {
      if (p.isClosed()) continue;
      const url = p.url();
      if (url.startsWith('chrome-extension://') && !url.endsWith('/home.html')) {
        try { if (this.wallet) await this.wallet.unlockWallet(p); } catch {}
        try { if (this.wallet) await this.wallet.confirmTransaction(p); } catch {}
        if (p !== dappPage) {
          try { await p.close(); } catch {}
        }
      }
    }
    await this.safeBringToFront(dappPage);
  }

  private async safeBringToFront(page: Page) {
    try {
      if (!page.isClosed()) await page.bringToFront();
    } catch {}
  }

  async resetContext(): Promise<void> {
    if (this.context) {
      await clearBrowserContext(this.context);
    }
  }

  async closeContext(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = undefined;
    }
  }
}
