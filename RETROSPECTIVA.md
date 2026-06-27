# RETROSPECTIVA

Bitácora de incidencias durante el desarrollo. Una entrada por incidente, con el
patrón **problema → causa → solución**.

<!-- Plantilla de entrada:

## YYYY-MM-DD — Título corto del problema
- **Problema:** qué se observó (síntoma).
- **Causa:** causa raíz identificada.
- **Solución:** qué se hizo para resolverlo y cómo se verificó.
- **Prevención:** test/medida añadida para que no se repita.
-->

## 2026-06-27 — Tests de integración intermitentes (race entre archivos)
- **Problema:** `npm test` fallaba 1 de 38 de forma intermitente (a veces 38/38).
- **Causa:** `node --test` ejecuta los archivos en paralelo. `rf.integration.test.js`
  y `metrics.integration.test.js` usaban la **misma** BD de test
  (`registro_municipal_test`) y ambos hacían `deleteMany` + seed en `beforeEach`/`before`,
  pisándose mutuamente los datos.
- **Solución:** `setup(sufijo)` da a cada archivo su propia BD
  (`..._test_rf`, `..._test_metrics`). Verificado con 3 ejecuciones seguidas: 38/38.
- **Prevención:** todo archivo de integración nuevo debe pasar un sufijo único a `setup()`.
