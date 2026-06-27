const { test, expect } = require('@playwright/test');
const { openDb, magicVerifyPath } = require('./helpers');
const presentaciones = require('../src/domain/presentaciones');

test.describe('Funcionario (RF-05 / RF-06 / RF-07 / RF-08)', () => {
  let client;
  let db;
  let urbId;

  test.beforeAll(async () => {
    ({ client, db } = await openDb());
    urbId = (await db.collection('areas').findOne({ codigo: 'URB' }))._id;
  });
  test.afterAll(async () => { await client.close(); });

  test('abre una presentación de su área, crea expediente y registra una actuación', async ({ page }) => {
    // Arrange: una presentación en Urbanismo (área de Paco).
    const ana = await db.collection('usuarios').findOne({ email: 'ana@ej.com' });
    const marca = `OBRA-${Date.now()}`;
    const pres = await presentaciones.crearPresentacion(db, {
      contribuyenteId: ana._id,
      areaId: urbId,
      interesado: { nombre: 'Ana', direccionFiscal: 'C/ Mayor 1' },
      representante: null,
      expone: 'expone',
      solicita: marca,
      adjuntos: [],
    });

    // RF-05: el funcionario entra y ve la presentación de su área.
    await page.goto(await magicVerifyPath(db, 'paco@ayto.com'));
    await expect(page.getByRole('heading', { name: 'Panel del funcionario' })).toBeVisible();
    await expect(page.locator('body')).toContainText(marca);

    // RF-06: abrir la presentación y crear el expediente.
    await page.goto(`/presentaciones/${pres._id}`);
    await page.fill('input[name="tipo"]', 'Licencia de obra menor');
    await page.click('button:has-text("Crear expediente")');
    await expect(page.getByRole('heading', { name: /Expediente EXP-/ })).toBeVisible();

    // RF-07 / RF-08: registrar una actuación y verla en el expediente.
    const act = `Informe técnico ${Date.now()}`;
    await page.fill('textarea[name="texto"]', act);
    await page.click('button:has-text("Registrar actuación")');
    await expect(page.locator('body')).toContainText(act);
  });
});
