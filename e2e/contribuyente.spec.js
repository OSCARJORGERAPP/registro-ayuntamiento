const { test, expect } = require('@playwright/test');
const { openDb, magicVerifyPath } = require('./helpers');

test.describe('Contribuyente (RF-01 / RF-03 / RF-04)', () => {
  let client;
  let db;

  test.beforeAll(async () => { ({ client, db } = await openDb()); });
  test.afterAll(async () => { await client.close(); });

  test('inicia sesión por magic link, presenta una instancia y la ve en su listado', async ({ page }) => {
    // RF-01: autenticación abriendo el enlace mágico.
    await page.goto(await magicVerifyPath(db, 'ana@ej.com'));
    await expect(page.getByRole('heading', { name: 'Mis presentaciones' })).toBeVisible();

    // RF-03: rellenar y presentar la instancia general.
    await page.goto('/presentaciones/nueva');
    await page.selectOption('select[name="areaId"]', { label: 'Urbanismo' });
    await page.fill('input[name="interesadoNombre"]', 'Ana García');
    await page.fill('input[name="interesadoDireccion"]', 'C/ Mayor 1, 28000');
    await page.fill('textarea[name="expone"]', 'Que soy propietaria de la vivienda.');
    const solicita = `Licencia de obra menor ${Date.now()}`;
    await page.fill('textarea[name="solicita"]', solicita);
    await page.click('button[type="submit"]');

    // Detalle con número de registro.
    await expect(page.getByRole('heading', { name: /Instancia general/ })).toBeVisible();
    await expect(page.locator('body')).toContainText(solicita);

    // RF-04: aparece en "mis presentaciones".
    await page.goto('/presentaciones/mias');
    await expect(page.locator('body')).toContainText(solicita);
  });
});
