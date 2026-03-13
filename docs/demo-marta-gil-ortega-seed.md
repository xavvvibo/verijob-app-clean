# Seed tecnico demo - Marta Gil Ortega

Seed reversible para dejar a `Marta Gil Ortega` como candidata demo navegable dentro de VERIJOB, con datos aislados del resto del sistema.

## Modelo real usado

El seed se apoya en tablas reales confirmadas en Supabase:

- `profiles`
- `candidate_profiles`
- `employment_records`
- `verification_requests`
- `evidences`
- `candidate_public_links`

El trust score se persiste en `candidate_profiles.trust_score` y su desglose en `candidate_profiles.trust_score_breakdown`.

## Enfoque de seguridad

- El seed solo opera sobre la cuenta demo `demo.marta.gil+hosteleria@verijob.test`.
- No toca billing.
- No usa empresas reales ni `company_id` reales.
- No mezcla datos demo con usuarios reales.
- El rollback elimina solo los registros demo sembrados por el script.

## Script

Archivo:

- `scripts/demo/seed-marta-gil-ortega.mjs`

Modos:

- `seed`
- `rollback`

## Opcion recomendada

Crear o reutilizar un usuario auth dedicado para demo con este email:

- `demo.marta.gil+hosteleria@verijob.test`

La forma mas simple es:

```bash
npm run demo:seed:marta -- --create-auth-user
```

Si prefieres no crear auth desde script, crea antes ese usuario en Supabase Auth y luego ejecuta:

```bash
npm run demo:seed:marta -- --candidate-id TU_UUID_DEMO
```

## Que siembra

- Identidad candidata completa en `profiles`
- Datos de perfil y disponibilidad en `candidate_profiles`
- 4 experiencias en `employment_records`
- 4 solicitudes/estados de verificacion en `verification_requests`
- 4 evidencias demo en `evidences`
- 1 enlace publico activo en `candidate_public_links`

## Estado funcional resultante

Experiencias:

1. `Braseria Rambla Alta` - `Encargada` - verificada por empresa
2. `Grupo Bocana Tapas` - `Responsable de turno` - verificada por empresa
3. `Hotel Mirador del Port` - `Jefa de sala` - aprobada documentalmente
4. `Cafe Teatre Liceu` - `Camarera de sala` - pendiente empresa

Evidencias:

- `vida_laboral`
- `nomina`
- `certificado_empresa`
- `contrato_trabajo`

Trust score esperado con el algoritmo actual:

- `85`

Nota:
El documento comercial original situaba a Marta en rango `88` aproximado. Con el modelo real actual y sin eventos de reutilizacion (`verification_reuse_events`), el seed aterriza de forma coherente en `85`.

## URLs demo esperadas

El script devuelve:

- `public_profile_url`
- `company_profile_url`
- `public_token`

Formato esperado:

```text
/p/<public_token>
/company/candidate/<public_token>
```

## Prueba recomendada

1. Abrir la URL publica para validar perfil compartible.
2. Abrir la URL de empresa desde una sesion empresa con creditos/contexto activo.
3. Verificar que aparecen trust score, timeline, evidencias y estados.

Si tambien quieres navegar el area privada de candidata, inicia sesion con la cuenta demo sembrada.

## Rollback

Borra todos los datos demo sembrados, manteniendo el usuario auth:

```bash
npm run demo:rollback:marta -- --candidate-id TU_UUID_DEMO
```

Si ademas quieres borrar el usuario auth demo:

```bash
npm run demo:rollback:marta -- --candidate-id TU_UUID_DEMO --delete-auth-user
```

## Limitacion importante

Para tener navegacion privada completa de candidata hace falta un usuario real en Supabase Auth. Por eso el script ofrece dos caminos:

- usar una cuenta demo ya creada
- crear esa cuenta demo de forma controlada con `--create-auth-user`

Sin ese usuario auth, la parte publica y la vista empresa pueden modelarse, pero la experiencia privada del area candidata no queda accesible de forma real.
