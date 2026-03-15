# Post-Deploy Regression

Checklist corta para ejecutar justo después de desplegar.

## En los primeros 10 minutos

### Auth y guards

1. Abrir login.
2. Iniciar sesión como empresa.
3. Abrir una ruta privada sin sesión en otra ventana.

Esperado:
- Login operativo.
- Guards redirigen correctamente.

### Superficies críticas

1. `/company`
2. `/company/candidates`
3. `/company/profile`
4. `/owner/overview`
5. `/owner/users`
6. `/owner/verifications`
7. `/v/[token]` con token válido
8. `/verify-experience/[token]` con token válido

Esperado:
- Sin 500.
- Sin errores visibles de hidratación.
- Sin copy técnica inesperada.

### Monetización

1. Abrir `/company/subscription`.
2. Abrir `/owner/monetization`.

Esperado:
- Plan actual visible.
- CTA comercial operativa.
- Owner monetization carga sin tablas rotas.

## En la primera hora

### RRHH empresa

1. Filtrar candidatos.
2. Abrir una vista rápida.
3. Abrir un resumen candidato.

Esperado:
- Base RRHH responde bien.
- Quick view y resumen funcionan.

### Owner operación

1. Buscar un usuario en `/owner/users`.
2. Abrir una verificación en `/owner/verifications`.

Esperado:
- Cola owner operativa y legible.

## Clasificación de incidencias

- Bloqueante:
  - 500 en rutas críticas
  - auth rota
  - dashboard empresa roto
  - owner roto
  - verify-experience o perfil público rotos
- Alta:
  - plan inconsistente
  - quick view rota
  - histórico documental desaparece
- Media:
  - copy mejorable
  - empty state pobre
  - CTA secundaria confusa
