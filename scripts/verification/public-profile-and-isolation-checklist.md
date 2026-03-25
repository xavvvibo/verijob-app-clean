# Public Profile and Isolation Checklist

Objetivo: certificar H4 y H7 con pasos reproducibles cuando no hay browser real utilizable en el sandbox.

## 1. Perfil publico canonico

### Preparacion

1. Iniciar sesion como candidato
2. Abrir `/candidate/share`
3. Confirmar:
- aparece `Enlace publico`
- aparece `Abrir enlace publico real`
- el texto visible contiene `https://app.verijob.es/p/`

### Validacion manual

1. Copiar el enlace
2. Abrirlo en ventana privada o navegador sin sesion
3. Esperado:
- carga `/p/[token]`
- no redirige a marketing
- no redirige a `/`
- muestra trust score
- no muestra email
- no muestra telefono
- no muestra ids internos

### Validacion automatica de payload

```bash
PUBLIC_PROFILE_BASE_URL=https://app.verijob.es \
PUBLIC_PROFILE_TOKEN=<token_real> \
node scripts/verification/check-public-profile-payload.mjs
```

Expected:
- `PASS: public profile payload contract OK`

## 2. FREE plan

Esperado:
- el candidato FREE puede generar enlace publico real
- no queda bloqueado en flujo ambiguo
- si no tiene QR, la UI lo dice de forma explicita

## 3. Aislamiento por actor

### Candidate -> surfaces empresa

Con sesion de candidato:
- abrir `/company`
- abrir `/company/requests`
- abrir `/company/candidates`

Expected:
- redirect a login o area permitida
- nunca datos empresa

### Company A -> datos Company B

Con sesion empresa A:
- abrir token/perfil/imports asociados a otra empresa si existen
- intentar `/company/candidate/[token]` de un candidato no accesible por A

Expected:
- 403, 404 o redirect seguro
- nunca snapshot completo ajeno

### Public/anon

Abrir sin sesion:
- `/api/public/cv/<user_id>`
- `/api/public/candidate/<token>`
- `/api/candidate/evidence/<id>`
- `/api/company/candidate/<token>`

Expected:
- `/api/public/cv/<user_id>` => `410 route_deprecated`
- `/api/public/candidate/<token>` => `200` sin ids internos
- endpoints privados => `401`, `403` o redirect

## 4. Evidencias y documentos

Validar que no son listables publicamente:
- sin sesion no debe existir una ruta publica que devuelva `storage_path`
- cualquier intento sobre endpoints privados de evidencias debe fallar

## Criterio PASS

- `/candidate/share` deja claro el enlace real
- `/p/[token]` carga en anon
- payload publico sin `candidate_id`, `user_id`, `company_id`, `storage_path`
- candidato no entra en superficies empresa
- empresa A no accede a datos de empresa B
- evidencias no son publicas

## Criterio FAIL

- link ambiguo o roto
- `/p/[token]` cae en marketing/fallback incorrecto
- fuga de ids internos
- acceso cruzado entre actores
- evidencia listable publicamente
