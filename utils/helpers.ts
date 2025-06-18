// utils/helpers.ts

import { BrowserContext, Page } from 'playwright';

async function getMetaMaskPopup(context: BrowserContext): Promise<Page> {
  // Wait for new page event, fallback to find extension popup
  let popup: Page | undefined;
  try {
    popup = await context.waitForEvent('page', { timeout: 20000 });
    await popup.waitForLoadState('domcontentloaded');
  } catch {
    // fallback
    popup = context.pages().find(
      p => p.url().startsWith('chrome-extension://') && !p.url().endsWith('/home.html')
    );
    if (!popup) throw new Error('MetaMask popup not found!');
    await popup.waitForLoadState('domcontentloaded');
  }

  // Try multiple times to bring to front (focus issues workaround)
  for (let i = 0; i < 5; i++) {
    try {
      await popup.bringToFront();
      // Optionally: check for unlock UI
      const pwInput = popup.getByLabel('Password', { exact: false });
      if (await pwInput.isVisible({ timeout: 2000 })) break;
    } catch {
      await new Promise(res => setTimeout(res, 500));
    }
  }
  return popup;
}
