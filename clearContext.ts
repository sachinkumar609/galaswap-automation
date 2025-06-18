import { BrowserContext } from '@playwright/test';

/**
 * Fully clears cookies, permissions, localStorage, sessionStorage, and cache for all pages in a browser context.
 */
export async function clearBrowserContext(context: BrowserContext): Promise<void> {
  try {
    console.log('🧼 Starting browser context cleanup...');

    // 1. Clear cookies
    await context.clearCookies();
    console.log('🍪 Cookies cleared');

    // 2. Clear permissions
    await context.clearPermissions();
    console.log('🔐 Permissions cleared');

    // 3. Clear localStorage and sessionStorage for each page
    const pages = context.pages();
    for (const page of pages) {
      const url = page.url();

      // Skip chrome-extension:// pages (like MetaMask) to avoid LavaMoat errors
      if (!/^https?:/.test(url)) {
        console.log(`⏭ Skipping non-origin or extension page: ${url}`);
        continue;
      }

      try {
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
        console.log(`📦 Storage cleared for page: ${url}`);
      } catch (err) {
        console.warn(`⚠️ Could not clear storage for ${url}:`, err);
      }
    }

    // 4. Clear cache using CDP if Chromium
    if (pages.length > 0) {
      try {
        const client = await context.newCDPSession(pages[0]);
        await client.send('Network.clearBrowserCache');
        await client.detach();
        console.log('🧹 Cache cleared (Chromium only)');
      } catch (err) {
        console.warn('⚠️ Cache clearing via CDP failed or unsupported:', err);
      }
    }

    console.log('✅ Browser context fully cleaned');
  } catch (err) {
    console.error('❌ Failed to clear browser context:', err);
  }
}
