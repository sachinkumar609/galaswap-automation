import { test, expect, Page } from '@playwright/test';
import { MetaMaskConnector } from '../MetaMaskConnector';
// import { WalletSetup } from '../walletSetup';
// FIX: Update the import path below to the correct location of walletSetup.ts
import { WalletSetup } from '../walletSetup';
// If walletSetup.ts is not in ../../, adjust the path accordingly.


const extensionPath = '/home/user/playwrightMetamask/tsPlay/metamask';
const dappUrl = 'https://dex-frontend-qa1.defi.gala.com/';

// Hold the connected dApp page
//import type { Page } from '@playwright/test';

let dappPage: Page | undefined;
let connector: MetaMaskConnector; // Declare connector at the top

// Connect MetaMask & dApp once before all tests
test.beforeAll(async () => {
  connector = new MetaMaskConnector(WalletSetup, extensionPath);
  await connector.launchContext();

  // Setup wallet and handle any initial popups
  if (!connector.wallet) {
    throw new Error('connector.wallet is not initialized');
  }
  await connector.wallet.setupWallet();
  // await connector.wallet.handleAllPopups(); // Removed: method does not exist

  // Open dApp, connect wallet, handle MetaMask popups
  const { page, address } = await connector.connectWallet(dappUrl);
  // await connector.wallet.handleAllPopups(); // Removed: method does not exist

  // Close all other pages except dApp page
  if (connector.context) {
    for (const p of connector.context.pages()) {
      if (p !== page) await p.close();
    }
  }
  await page.bringToFront();

  dappPage = page; // Assign for use in tests

  console.log('✅ Connected with address:', address);
   if (!dappPage) {
      throw new Error('dappPage is not initialized');
    }
    await dappPage.bringToFront();
    console.log('Navigating to Swap Page...');
    await dappPage.waitForLoadState('domcontentloaded');
    await dappPage.waitForLoadState('networkidle');

});

// Test suite
test.describe('Swap Page Tests', () => {
 
   

test('Swap Page Title Test', async () => {
  // Use the connected dApp page
 

  if (!dappPage) {
    throw new Error('dappPage is not initialized');
  }
  const titleText = await dappPage.title();
  console.log('Page title:', titleText);

  // Example assertion
  expect(titleText).toContain('GalaSwap - Dex-Trade Exchange'); 

});
test('Swap Page URL Test', async () => {


  if (!dappPage) {
    throw new Error('dappPage is not initialized');
  }
  const currentUrl = dappPage.url();
  console.log('Current URL:', currentUrl);

 expect(currentUrl).toMatch(/qa1/);


});
test('Swap Page Card Content Test', async () => {
  // Use the connected dApp page
  if (!dappPage) {
    throw new Error('dappPage is not initialized');
  }

  const swapCard = dappPage.locator('.swap_flow');
  const cardText = await swapCard.textContent();
  console.log('Card text:', cardText);
  const swapCardHeader = swapCard.locator('.card-header');
  const swapCardHeaderText = await swapCardHeader.textContent();
  const swapCardBody = swapCard.locator('.card-body');
  const swapCardBodyText = await swapCardBody.textContent();
  const switchBtn= swapCard.locator('.swap_flow_switch' );
  console.log('Swap Card Body Text:', swapCardBodyText);
  expect.soft(swapCardBodyText).toMatch('Selling');
  expect.soft(swapCardBodyText).toMatch('GALA');
  expect.soft(swapCardBodyText).toMatch('Buying');

  expect.soft(swapCardBodyText).toMatch('Select token');
  

  const swapButton = swapCard.getByRole('button', { name: 'Swap' });
  await expect(switchBtn).toBeVisible();
   expect.soft(swapCardHeaderText).toContain('Swap');
  await expect.soft(swapButton).toBeVisible();
  

});
test('Swap Page  Header Content Test', async () => {
  // Use the connected dApp page
  if (!dappPage) {
    throw new Error('dappPage is not initialized');
  }

  const header = dappPage.locator('.header');
  const headerText = await header.textContent();

  expect.soft(headerText).toContain('Swap'); 
  expect.soft(headerText).toContain('Pool'); 
  expect.soft(headerText).toContain('Balance'); 
  expect.soft(headerText).toContain('Explore'); 
  expect.soft(headerText).toContain('About'); 
  //expect.soft(headerText).toContain('FAQs');
  expect.soft(headerText).toMatch(/faqs/i);

});

test('Swap Page Footer Content Test', async () => {
  // Use the connected dApp page
  if (!dappPage) {
    throw new Error('dappPage is not initialized');
  }

  const footer = dappPage.locator('.footer');
  const footerText = await footer.textContent();
  
  console.log('Footer text:', footerText);

  

});




});

test.describe('Swap functionality Tests', () => {

test('Buy ETIME against Gala', async () => {
  if (!dappPage) {
    throw new Error('dappPage is not initialized');
  }

  const secondSelectTokenBtn = dappPage.locator('.swap_flow .selecttoken_btn.selected').nth(1);
  await secondSelectTokenBtn.click();

  const etimeTokenBtn = dappPage.locator('.tokenmodal_list_btn .common_btn_title:text("ETIME")');
  await etimeTokenBtn.click();
  await dappPage.locator('input#wanted').fill('1');
  await dappPage.getByRole('button', { name: 'Swap' }).click();

  // Prepare to catch the popup before clicking Confirm Swap
  const [popup] = await Promise.all([
    dappPage.context().waitForEvent('page'),
    dappPage.getByRole('button', { name: 'Confirm Swap' }).click()
  ]);

  await popup.waitForLoadState('domcontentloaded');

  // Bring popup to front and handle unlock/confirm
  for (let i = 0; i < 5; i++) {
    try {
      await popup.waitForTimeout(3000);
      await popup.bringToFront();
if (connector && connector.wallet) {
    await connector.wallet.unlockWallet(popup);
    await connector.wallet.confirmTransaction(popup);
     
  }

      break; // Exit loop if successful
    }
    catch (error) {
      console.error('Error bringing popup to front:', error);
      await new Promise(res => setTimeout(res, 1000)); // Wait before retrying
    }
  
  }
const swapConfirmedHeader = dappPage.getByRole('heading', { name: 'Swap Confirmed' });
  await expect(swapConfirmedHeader).toBeVisible({ timeout: 30000 });
  await dappPage.locator('button:has-text("Close")').click();
console.log('Swap confirmed successfully!');
  
});
test('Buy Gala againts ETIME using switch button', async () => {
  if (!dappPage) {
    throw new Error('dappPage is not initialized');
  }

  const secondSelectTokenBtn = dappPage.locator('.swap_flow .selecttoken_btn.selected').nth(1);
  await secondSelectTokenBtn.click();

  const etimeTokenBtn = dappPage.locator('.tokenmodal_list_btn .common_btn_title:text("ETIME")');
  await etimeTokenBtn.click();
  await dappPage.locator('input#wanted').fill('1');
  const switchBtn = dappPage.locator('.swap_flow_switch button');
  await switchBtn.click();


  await dappPage.getByRole('button', { name: 'Swap' }).click();

  // Prepare to catch the popup before clicking Confirm Swap
  const [popup] = await Promise.all([
    dappPage.context().waitForEvent('page'),
    dappPage.getByRole('button', { name: 'Confirm Swap' }).click()
  ]);

  await popup.waitForLoadState('domcontentloaded');

  // Bring popup to front and handle unlock/confirm
  for (let i = 0; i < 5; i++) {
    try {
      await popup.waitForTimeout(3000);
      await popup.bringToFront();
if (connector && connector.wallet) {
    await connector.wallet.unlockWallet(popup);
    await connector.wallet.confirmTransaction(popup);
     
  }

      break; // Exit loop if successful
    }
    catch (error) {
      console.error('Error bringing popup to front:', error);
      await new Promise(res => setTimeout(res, 1000)); // Wait before retrying
    }
  
  }
const swapConfirmedHeader = dappPage.getByRole('heading', { name: 'Swap Confirmed' });
  await expect(swapConfirmedHeader).toBeVisible({ timeout: 30000 });
  await dappPage.locator('button:has-text("Close")').click();
console.log('Swap confirmed successfully!');
  
});

});



test.afterAll(async () => {
  if (connector && connector.context) {
    await connector.resetContext();
    await connector.closeContext();
  }
});