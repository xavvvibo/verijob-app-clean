# Manual QA Smoke Test

Smoke test corto para verificar que VERIJOB sigue operativo tras cambios relevantes o antes de una demo.

## Preparación

- Tener una cuenta candidata, una cuenta empresa y una cuenta owner.
- Tener al menos una empresa con candidatos importados.
- Tener al menos una verificación y una evidencia en datos de prueba.

## Smoke de 15-20 minutos

### 1. Auth

1. Iniciar sesión como candidato.
2. Cerrar sesión.
3. Iniciar sesión como empresa.
4. Cerrar sesión.
5. Iniciar sesión como owner.

Resultado esperado:
- Todas las sesiones entran y salen sin bucles ni errores visibles.

### 2. Candidate

1. Abrir `/candidate/overview`.
2. Abrir `/candidate/verifications`.
3. Abrir `/candidate/evidence`.
4. Abrir perfil público compartido del candidato.

Resultado esperado:
- Carga correcta, sin errores visibles ni bloques vacíos incoherentes.

### 3. Company

1. Abrir `/company`.
2. Abrir `/company/candidates`.
3. Probar un filtro.
4. Abrir `Vista rápida`.
5. Abrir `Ver resumen`.
6. Abrir `/company/requests`.
7. Abrir `/company/subscription`.
8. Abrir `/company/profile` y revisar histórico documental.

Resultado esperado:
- Dashboard usable.
- Base RRHH operativa.
- Quick view funcional.
- Resumen candidato abre.
- Requests y subscription cargan.
- El histórico documental no desaparece si existen documentos.

### 4. Owner

1. Abrir `/owner/overview`.
2. Abrir `/owner/users`.
3. Buscar un usuario conocido.
4. Abrir su ficha.
5. Abrir `/owner/verifications`.
6. Abrir `/owner/monetization`.

Resultado esperado:
- KPIs y tablas cargan.
- La ficha owner refleja el mismo plan efectivo que la lista.
- La cola de verificaciones filtra y abre detalle.

## Criterio de corte

- Si falla auth, dashboard empresa, base RRHH, ficha owner o verify-experience público: detener release.
- Si falla copy menor o empty state no crítico: documentar y clasificar post-launch.
