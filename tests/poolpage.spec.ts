import { test, expect, Page } from '@playwright/test';
import { MetaMaskConnector } from '../MetaMaskConnector';
import { WalletSetup } from '../walletSetup';
import { SwapPage } from '../pages/SwapPage';

const extensionPath = '/home/user/playwrightMetamask/galaSwap-automation/metamask';
const dappUrl = 'https://dex-frontend-qa1.defi.gala.com/';

let dappPage: Page | undefined;
let connector: MetaMaskConnector;
let swapPage: SwapPage;

test.beforeAll(async () => {
  connector = new MetaMaskConnector(WalletSetup, extensionPath);
  await connector.launchContext();
  if (!connector.wallet) throw new Error('connector.wallet is not initialized');
  await connector.wallet.setupWallet();
  const { page, address } = await connector.connectWallet(dappUrl);

  if (connector.context) {
    for (const p of connector.context.pages()) {
      if (p !== page) await p.close();
    }
  }
  await page.bringToFront();

  dappPage = page;
  swapPage = new SwapPage(page);

  console.log('✅ Connected with address:', address);
  if (!dappPage) throw new Error('dappPage is not initialized');
  await dappPage.bringToFront();
    await dappPage.waitForLoadState('domcontentloaded');
    await dappPage.waitForLoadState('networkidle');
  });


test.describe('Pool Page Tests', () => {
test.beforeAll(async () => {
   if (!dappPage) throw new Error('dappPage is not initialized');
  await dappPage.bringToFront();
  await dappPage.waitForLoadState('domcontentloaded');
  await dappPage.waitForLoadState('networkidle');
  await dappPage.locator("//a[@href='/dex/pool']").click();
    await dappPage.waitForLoadState('networkidle');
});
  test('Pool Page Title Test', async () => {
    // Use the connected dApp page
    if (!dappPage) {
      throw new Error('dappPage is not initialized');
    }
    const titleText = await dappPage.title();
    expect(titleText).toContain('GalaSwap - Dex-Trade Exchange');
  });

  test('Pool Page URL Test', async () => {
    if (!dappPage) {
      throw new Error('dappPage is not initialized');
    }
    const currentUrl = dappPage.url();
    expect(currentUrl).toMatch(/dex\/pool/);
  });

  test('Pool Positions  Test', async () => {
    if (!dappPage) {
      throw new Error('dappPage is not initialized');
    }
    await dappPage.reload();
    await dappPage.waitForLoadState('load');
    const myPositions = dappPage.locator("//div[@class='poolpreview_pos']//a[@class='poolpreview_pos_single']")
    await dappPage.waitForTimeout(5000);
    await dappPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await dappPage.waitForTimeout(5000); // Wait for positions to load after scrolling
    const positionsCount = await myPositions.count();
    console.log('Number of positions:', positionsCount);
    
  });


  
});

test.afterAll(async () => {
  if (connector && connector.context) {
    await connector.resetContext();
    await connector.closeContext();
  }
});