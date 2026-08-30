describe('coverage fixture harness', () => {
  it('shows non-idle status after mount hit+flush', async () => {
    const status = await $('~coverage-status');
    await status.waitForDisplayed({ timeout: 60000 });

    // Appium accessibility id maps to React Native testID.
    // Retry briefly: mount effect may still be running.
    await browser.waitUntil(
      async () => {
        const text = await status.getText();
        return text.includes('hit=') || text.includes('flush invoked');
      },
      {
        timeout: 60000,
        interval: 1000,
        timeoutMsg: 'Expected coverage-status to show hit=/flush after mount',
      }
    );

    const text = await status.getText();
    expect(text).toMatch(/hit=\d+/);

    // Optional second flush via button (exercises interaction path).
    const button = await $('~coverage-hit-button');
    if (await button.isDisplayed()) {
      await button.click();
      await browser.pause(500);
      const after = await status.getText();
      expect(after).toMatch(/hit=\d+/);
    }
  });
});
