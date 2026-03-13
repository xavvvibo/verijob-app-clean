# Harness de testing: importación empresa -> candidato

Este harness valida la lógica de negocio del flujo de importación de CV sin depender de OpenAI, Supabase Storage ni envíos de email reales.

## Qué cubre

- Candidato nuevo: creación de import preliminar sin publicación automática.
- Candidato existente: detección por email, enlace a perfil y generación de `candidate_public_token` si falta.
- Duplicados: clasificación de experiencias como `duplicate`, `new` o `update`.
- Aceptación legal: persistencia mínima trazable del consentimiento.

## Cómo se ejecuta

```bash
npm run test:company-candidate-import
```

## Fixtures

Se usan fixtures controladas en:

- `tests/fixtures/company-candidate-import/new-candidate.json`
- `tests/fixtures/company-candidate-import/existing-candidate.json`
- `tests/fixtures/company-candidate-import/existing-candidate-duplicates.json`

## Qué no cubre

- Llamadas reales a OpenAI para parseo de CV.
- Upload real a Supabase Storage.
- Inserciones reales en Supabase.
- Navegación E2E de navegador.

El objetivo es validar de forma repetible la lógica crítica del flujo y detectar regresiones en el manejo de candidatos existentes, duplicados y aceptación legal.
