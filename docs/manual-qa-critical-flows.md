# Manual QA Critical Flows

Guía de validación manual de los flujos críticos de VERIJOB.

## Flujo 1. Empresa importa candidato y lo gestiona en RRHH

1. Acceder como empresa.
2. Importar CV o usar un candidato ya importado.
3. Ir a `/company/candidates`.
4. Verificar que el candidato aparece con:
   - estado
   - encaje rápido
   - acciones consistentes
5. Abrir `Vista rápida`.
6. Abrir `Ver resumen`.
7. Si aplica, desbloquear perfil completo.

Resultado esperado:
- El candidato aparece en base RRHH.
- Quick view y resumen cargan.
- El desbloqueo abre el perfil completo sin romper el flujo.

Bloqueo:
- Sí, si el candidato no aparece o el resumen falla.

## Flujo 2. Verificación pública de experiencia

1. Obtener un token válido.
2. Abrir `/verify-experience/[token]`.
3. Confirmar o revisar la experiencia.
4. Comprobar que la solicitud cambia de estado.

Resultado esperado:
- Página pública accesible.
- Acción posible.
- Estado visible desde candidate/company/owner.

Bloqueo:
- Sí.

## Flujo 3. Subida documental de empresa

1. Acceder a `/company/profile`.
2. Subir documento de verificación.
3. Esperar confirmación.
4. Revisar `Histórico documental`.
5. Si hay datos detectados, usar `Completar perfil con este documento`.

Resultado esperado:
- Archivo subido.
- Registro visible en histórico.
- Estado documental comprensible.
- Importar al perfil no se presenta como validación automática.

Bloqueo:
- Sí, si el documento no aparece en el histórico tras subida correcta.

## Flujo 4. Owner gestiona plan de usuario

1. Abrir `/owner/users`.
2. Localizar el usuario.
3. Abrir ficha owner.
4. Cambiar plan si el caso está preparado.
5. Volver a la lista.

Resultado esperado:
- La ficha aplica el plan.
- La lista refleja el mismo plan efectivo.

Bloqueo:
- Sí, si detalle y listado divergen.

## Flujo 5. Compra y capacidad empresa

1. Abrir `/company/subscription`.
2. Revisar plan actual, renovación y CTA.
3. Iniciar compra de acceso o mejora de plan si el entorno lo permite.

Resultado esperado:
- Capacidad clara.
- CTA correcta.
- Sin rutas rotas ni copy confuso.

Bloqueo:
- Sí, si el checkout o la ruta comercial fallan.
