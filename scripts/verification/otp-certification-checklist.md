# OTP Certification Checklist

Objetivo: certificar login/signup OTP de candidato y empresa en entorno real cuando el sandbox no puede completar browser+correo.

## Precondiciones

- `PLAYWRIGHT_SKIP_WEBSERVER=1`
- `PLAYWRIGHT_BASE_URL=https://app.verijob.es` o entorno equivalente
- `.env.smoke.local` con:
  - `SMOKE_CANDIDATE_EMAIL`
  - `SMOKE_COMPANY_EMAIL`
  - `SMOKE_CANDIDATE_AUTH_MODE`
  - `SMOKE_COMPANY_AUTH_MODE`
- Navegador real disponible
- Acceso al inbox real de ambos emails

## Runner recomendado

```bash
set -a
source .env.smoke.local
set +a
PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=https://app.verijob.es PLAYWRIGHT_HEADED=1 npx playwright test tests/smoke/smoke-auth.spec.ts
```

## Rutas exactas

- Candidato signup: `/signup?mode=candidate`
- Candidato login: `/login`
- Empresa signup: `/signup?mode=company`
- Empresa login: `/login?mode=company`

## Casos a validar

1. Candidate signup OTP
- Paso: abrir `/signup?mode=candidate`
- Esperado:
  - selector candidato activo
  - mensaje de envio de codigo visible
  - al enviar, aparece paso OTP
  - aparece copy: `Usa siempre el ultimo codigo enviado`

2. Candidate resend OTP
- Paso: pulsar `Reenviar codigo` cuando el cooldown termine
- Esperado:
  - mensaje `Hemos reenviado un nuevo codigo a tu email`
  - el codigo anterior deja de servir
  - el codigo nuevo si sirve

3. Candidate login OTP
- Paso: abrir `/login`
- Esperado:
  - envio OTP OK
  - validacion OTP OK
  - redirect a `/candidate/overview`

4. Company signup OTP
- Paso: abrir `/signup?mode=company`
- Esperado:
  - selector empresa activo
  - bootstrap perfil empresa OK
  - redirect final sin error visible

5. Company login OTP
- Paso: abrir `/login?mode=company`
- Esperado:
  - envio OTP OK
  - validacion OTP OK
  - acceso a dashboard empresa

## Evidencia a recoger

- screenshot formulario email
- screenshot paso OTP
- screenshot mensaje de reenvio
- screenshot error esperado al usar codigo viejo
- screenshot landing final candidato
- screenshot landing final empresa

## Criterio PASS

- signup/login candidato OK
- signup/login empresa OK
- reenvio funciona
- codigo viejo invalido
- codigo nuevo valido
- sin mensajes falsos de expirado inmediato

## Criterio FAIL

- OTP no llega en ventana razonable
- codigo nuevo sigue fallando sin reenvio adicional
- codigo viejo sigue valiendo tras reenvio
- redirect final incorrecto
- errores ambiguos o 500
