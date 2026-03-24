# Playwright Smoke Pre-Beta

Suite smoke E2E para ejecutar localmente en la máquina del usuario con navegador y red reales.

## Cobertura

- journey beta gate candidato -> verificación -> empresa -> perfil público
- signup/login por OTP con paso manual configurable
- onboarding empresa
- onboarding candidato
- creación de experiencia
- edición de experiencia y comprobación de persistencia
- subida de evidencia válida
- validación negativa de evidencia incompatible
- apertura de verificaciones
- revisión de solicitud por empresa
- preview y perfil público

## Preparación

1. Instala dependencias:

```bash
npm install
npm run playwright:install
```

2. Copia el ejemplo de variables:

```bash
cp tests/smoke/.env.example .env.smoke.local
```

3. Exporta las variables o cárgalas en tu shell:

```bash
set -a
source .env.smoke.local
set +a
```

## OTP manual

Si defines `SMOKE_COMPANY_OTP` o `SMOKE_CANDIDATE_OTP`, la suite rellena el código automáticamente.

Si no defines OTP:

- ejecuta en modo headed
- Playwright pausará en el paso del código
- introduces el OTP manualmente en el navegador
- reanudas la ejecución desde el inspector

## Comandos

```bash
npm run test:smoke:auth
npm run test:smoke:beta
npm run test:smoke:company
npm run test:smoke:candidate
npm run test:smoke:public-profile
npm run test:smoke:headed
```

## Orden recomendado

Para validar el journey completo sin conflicto entre actores:

```bash
npm run test:smoke:beta
```

La spec beta gate ejecuta:

1. candidato en contexto aislado
2. cierre del contexto candidato
3. empresa en contexto aislado
4. cierre del contexto empresa
5. candidato de nuevo en contexto aislado
6. perfil público en contexto aislado

## Notas operativas

- `SMOKE_*_AUTH_MODE=signup` usa cuenta nueva.
- `SMOKE_*_AUTH_MODE=login` reutiliza cuenta existente.
- Si no defines `SMOKE_CANDIDATE_VERIFIER_EMAIL`, la suite deriva por defecto `rrhh@<dominio empresa>` a partir de `SMOKE_COMPANY_CONTACT_EMAIL` o `SMOKE_COMPANY_EMAIL`.
- `PLAYWRIGHT_SKIP_WEBSERVER=1` evita arrancar `next dev` si ya tienes la app levantada.
- `PLAYWRIGHT_BASE_URL` permite apuntar a staging o a otro puerto local.
