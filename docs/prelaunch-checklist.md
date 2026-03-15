# VERIJOB Pre-Launch Checklist

Checklist operativa para decidir si el producto puede abrirse en beta controlada o pre-launch supervisado.

## Criterio de uso

- Ejecutar esta checklist en staging o en entorno real controlado.
- Marcar cada punto como `OK`, `No OK` o `No aplica`.
- Si falla un punto `Bloqueante`, no abrir.
- Si falla un punto `No bloqueante`, documentar owner y fecha objetivo.

## Auth y contexto

| Check | Pasos | Resultado esperado | Severidad |
| --- | --- | --- | --- |
| Signup candidato | Crear cuenta nueva desde flujo candidato | Cuenta creada, sesión iniciada, perfil privado accesible | Bloqueante |
| Signup empresa | Crear cuenta nueva desde flujo empresa | Cuenta creada, contexto empresa activo, acceso a dashboard empresa | Bloqueante |
| Login/logout | Entrar y salir con cuentas reales | Redirecciones correctas, sin loops ni 500 | Bloqueante |
| Guards privados | Abrir rutas privadas sin sesión | Redirección a login | Bloqueante |
| Cambio de contexto empresa | Usuario multiempresa cambia de empresa activa | `active_company_id` cambia y las pantallas cargan sin incoherencias | Bloqueante |

## Candidate core

| Check | Pasos | Resultado esperado | Severidad |
| --- | --- | --- | --- |
| Perfil básico | Editar datos principales del candidato | Cambios persistidos y visibles | Bloqueante |
| Experiencias | Crear y editar experiencia | Experiencia visible en perfil privado y verificable | Bloqueante |
| Evidencias | Subir evidencia y abrir preview | Archivo accesible con guard correcto | Bloqueante |
| Solicitud de verificación | Solicitar verificación desde candidate | Solicitud creada y visible en candidate/company/owner según corresponda | Bloqueante |
| Perfil público | Abrir perfil público compartido | Render correcto, sin datos privados no previstos | Bloqueante |
| Trust score | Revisar perfil con verificaciones/evidencias | Trust visible y sin estados rotos | No bloqueante |

## Company core

| Check | Pasos | Resultado esperado | Severidad |
| --- | --- | --- | --- |
| Onboarding empresa | Completar datos base empresa | Completion coherente y sin errores visibles | Bloqueante |
| Dashboard empresa | Abrir `/company` con datos reales | KPIs, prioridades y bloques RRHH cargan | Bloqueante |
| Base RRHH | Abrir `/company/candidates` | Filtros, quick view y acciones cargan | Bloqueante |
| Resumen candidato | Abrir `Ver resumen` | Snapshot correcto sin consumir acceso | Bloqueante |
| Desbloqueo perfil | Consumir acceso y abrir perfil completo | Descuento/consumo correcto y acceso visible | Bloqueante |
| Solicitudes empresa | Confirmar/rechazar solicitud | Estado final visible y botones bloqueados durante mutación | Bloqueante |
| Suscripción/capacidad | Abrir `/company/subscription` | Plan actual, renovación y CTA claros | No bloqueante |
| Documentación empresa | Subir documento y revisar histórico | Documento visible y estado documental coherente | Bloqueante |

## Public flows

| Check | Pasos | Resultado esperado | Severidad |
| --- | --- | --- | --- |
| Verify experience | Abrir `/verify-experience/[token]` válido | Página accesible, copy correcto y acción posible | Bloqueante |
| Perfil público candidato | Abrir token compartido | Perfil público renderiza sin exponer datos internos | Bloqueante |
| Enlaces inválidos | Abrir token público inexistente | Fallback claro, sin exceptions técnicas | No bloqueante |

## Owner

| Check | Pasos | Resultado esperado | Severidad |
| --- | --- | --- | --- |
| Overview | Abrir `/owner/overview` | KPIs y alertas útiles, sin huecos evidentes | Bloqueante |
| Users | Abrir `/owner/users` y una ficha | Tabla operativa, plan efectivo coherente con detalle | Bloqueante |
| Verifications | Abrir `/owner/verifications` | Filtros, cola y accesos a ficha correctos | Bloqueante |
| Monetization | Abrir `/owner/monetization` | Nomenclatura clara, sin KPIs vacíos falsos | No bloqueante |
| Archive/histórico | Revisar superficies owner disponibles | Estados legibles y sin naming roto | No bloqueante |

## Billing y Stripe

| Check | Pasos | Resultado esperado | Severidad |
| --- | --- | --- | --- |
| Plan actual visible | Revisar candidate/company/owner | Plan consistente según suscripción u override | Bloqueante |
| CTAs comerciales | Abrir upgrade/compra de accesos | CTA clara y sin rutas rotas | Bloqueante |
| Checkout | Revisar inicio de checkout | No 404, no error técnico visible | Bloqueante |
| Stripe live | Verificar cargo real o webhook | Si no se valida, dejar pendiente explícito antes de abrir amplio | Bloqueante |

## Calidad general

| Check | Pasos | Resultado esperado | Severidad |
| --- | --- | --- | --- |
| Navegación | Recorrer rutas críticas | Sin enlaces rotos ni 404 no deseados | Bloqueante |
| Empty states | Revisar tablas vacías | Mensajes comprensibles, no parecen bugs | No bloqueante |
| Copy | Revisar branding, labels y textos visibles | Sin residuos técnicos ni copy roto | No bloqueante |
| Exceptions visibles | Navegar con cuentas reales | Sin `Unhandled Exception`, hydration errors ni detalles internos | Bloqueante |

## Decisión final

- Abrir beta controlada: todos los bloqueantes en `OK`.
- Abrir pre-launch amplio: bloqueantes en `OK` y pendientes no bloqueantes documentados con fecha y owner.
