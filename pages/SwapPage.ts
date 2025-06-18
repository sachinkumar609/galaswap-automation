import { Page, Locator, expect } from '@playwright/test';

export class SwapPage {
  readonly page: Page;
  readonly swapCard: Locator;
  readonly switchBtn: Locator;

  constructor(page: Page) {
    this.page = page;
    this.swapCard = page.locator('.swap_flow');
    this.switchBtn = page.locator('.swap_flow_switch button');
  }

  async getTitle(): Promise<string> {
    return this.page.title();
  }

  async getUrl(): Promise<string> {
    return this.page.url();
  }

  async getSwapCardText(): Promise<string | null> {
    return this.swapCard.textContent();
  }

  async getSwapCardHeaderText(): Promise<string | null> {
    return this.swapCard.locator('.card-header').textContent();
  }

  async getSwapCardBodyText(): Promise<string | null> {
    return this.swapCard.locator('.card-body').textContent();
  }

  async getHeaderText(): Promise<string | null> {
    return this.page.locator('.header').textContent();
  }

  async getFooterText(): Promise<string | null> {
    return this.page.locator('.footer').textContent();
  }

  async openSecondTokenSelector(): Promise<void> {
    await this.page.locator('.swap_flow .selecttoken_btn.selected').nth(1).click();
  }

  async selectToken(tokenName: string): Promise<void> {
    await this.page.locator('.tokenmodal_list_btn .common_btn_title', { hasText: tokenName }).click();
  }

  async fillSwapAmount(amount: string): Promise<void> {
    await this.page.locator('input#wanted').fill(amount);
  }

  async clickSwapButton(): Promise<void> {
    await this.page.getByRole('button', { name: 'Swap' }).click();
  }

  async clickConfirmSwapButton(): Promise<void> {
    await this.page.getByRole('button', { name: 'Confirm Swap' }).click();
  }

  async assertSwapConfirmed(): Promise<void> {
    const swapConfirmedHeader = this.page.getByRole('heading', { name: 'Swap Confirmed' });
    await expect(swapConfirmedHeader).toBeVisible({ timeout: 30000 });
  }

  async closeSwapConfirmedModal(): Promise<void> {
    await this.page.locator('button:has-text("Close")').click();
  }

  async clickSwitchButton(): Promise<void> {
    await this.switchBtn.click();
  }
}
