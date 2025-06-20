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

test.describe('Swap Page Tests', () => {
  test('Swap Page Title Test', async () => {
    if (!dappPage) throw new Error('dappPage is not initialized');
    const titleText = await swapPage.getTitle();
    expect(titleText).toContain('GalaSwap - Dex-Trade Exchange');
  });

  test('Swap Page URL Test', async () => {
    if (!dappPage) throw new Error('dappPage is not initialized');
    const currentUrl = await swapPage.getUrl();
    expect(currentUrl).toMatch(/qa1/);
  });

  test('Swap Page Card Content Test', async () => {
    if (!dappPage) throw new Error('dappPage is not initialized');
    const cardText = await swapPage.getSwapCardText();
    const swapCardHeaderText = await swapPage.getSwapCardHeaderText();
    const swapCardBodyText = await swapPage.getSwapCardBodyText();

    expect.soft(swapCardBodyText).toMatch('Selling');
    expect.soft(swapCardBodyText).toMatch('GALA');
    expect.soft(swapCardBodyText).toMatch('Buying');
    expect.soft(swapCardBodyText).toMatch('Select token');
    expect.soft(swapCardHeaderText).toContain('Swap');
    await expect.soft(swapPage.switchBtn).toBeVisible();
    await expect.soft(swapPage.swapCard.getByRole('button', { name: 'Swap' })).toBeVisible();
  });

  test('Swap Page Header Content Test', async () => {
    if (!dappPage) throw new Error('dappPage is not initialized');
    const headerText = await swapPage.getHeaderText();
    expect.soft(headerText).toContain('Swap');
    expect.soft(headerText).toContain('Pool');
    expect.soft(headerText).toContain('Balance');
    expect.soft(headerText).toContain('Explore');
    expect.soft(headerText).toContain('About');
    expect.soft(headerText).toMatch(/faqs/i);
  });

  test('Swap Page Footer Content Test', async () => {
    if (!dappPage) throw new Error('dappPage is not initialized');
    const footerText = await swapPage.getFooterText();
    // You can log or assert as needed
  });
});

test.describe('Swap functionality Tests', () => {
  test('Buy ETIME against Gala', async () => {
    if (!dappPage) throw new Error('dappPage is not initialized');
    await swapPage.openSecondTokenSelector();
    await swapPage.selectToken('ETIME');
    await swapPage.fillSwapAmount('1');
    await swapPage.clickSwapButton();

    const [popup] = await Promise.all([
      dappPage.context().waitForEvent('page'),
      swapPage.clickConfirmSwapButton()
    ]);

    await popup.waitForLoadState('domcontentloaded');

    for (let i = 0; i < 5; i++) {
      try {
        await popup.waitForTimeout(3000);
        await popup.bringToFront();
        if (connector && connector.wallet) {
          await connector.wallet.unlockWallet(popup);
          await connector.wallet.confirmTransaction(popup);
        }
        break;
      } catch (error) {
        await new Promise(res => setTimeout(res, 1000));
      }
    }
    await swapPage.assertSwapConfirmed();
    await swapPage.closeSwapConfirmedModal();
    console.log('Swap confirmed successfully!');
  });

  test('Buy Gala against ETIME using switch button', async () => {
    if (!dappPage) throw new Error('dappPage is not initialized');
    await swapPage.openSecondTokenSelector();
    await swapPage.selectToken('ETIME');
    await swapPage.fillSwapAmount('1');
    await swapPage.clickSwitchButton();
    await swapPage.clickSwapButton();

    const [popup] = await Promise.all([
      dappPage.context().waitForEvent('page'),
      swapPage.clickConfirmSwapButton()
    ]);

    await popup.waitForLoadState('domcontentloaded');

    for (let i = 0; i < 5; i++) {
      try {
        await popup.waitForTimeout(3000);
        await popup.bringToFront();
        if (connector && connector.wallet) {
          await connector.wallet.unlockWallet(popup);
          await connector.wallet.confirmTransaction(popup);
        }
        break;
      } catch (error) {
        await new Promise(res => setTimeout(res, 1000));
      }
    }
    await swapPage.assertSwapConfirmed();
    await swapPage.closeSwapConfirmedModal();
    console.log('Swap confirmed successfully!');
  });
});

test.afterAll(async () => {
  if (connector && connector.context) {
    await connector.resetContext();
    await connector.closeContext();
  }
});
