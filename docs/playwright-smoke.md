# Playwright Smoke Pre-Beta

Suite smoke E2E para ejecutar localmente en la máquina del usuario con navegador y red reales.

## Cobertura

- signup/login por OTP con paso manual configurable
- onboarding empresa
- onboarding candidato
- creación de experiencia
- subida de evidencia válida
- validación negativa de evidencia incompatible
- apertura de verificaciones
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
npm run test:smoke:company
npm run test:smoke:candidate
npm run test:smoke:public-profile
npm run test:smoke:headed
```

## Notas operativas

- `SMOKE_*_AUTH_MODE=signup` usa cuenta nueva.
- `SMOKE_*_AUTH_MODE=login` reutiliza cuenta existente.
- `PLAYWRIGHT_SKIP_WEBSERVER=1` evita arrancar `next dev` si ya tienes la app levantada.
- `PLAYWRIGHT_BASE_URL` permite apuntar a staging o a otro puerto local.
