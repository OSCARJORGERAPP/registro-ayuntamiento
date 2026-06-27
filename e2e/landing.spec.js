const { test, expect } = require('@playwright/test');

test('la landing muestra la sede, las áreas y el acceso por email', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sede electrónica' })).toBeVisible();
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Urbanismo' })).toBeVisible();
});

test('la home de un área muestra su título personalizado (RF-10)', async ({ page }) => {
  await page.goto('/area/URB');
  await expect(page.getByRole('heading', { name: 'Atención de Urbanismo' })).toBeVisible();
  await expect(page.locator('body')).toContainText('Paco');
});
