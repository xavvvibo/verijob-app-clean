# VERIJOB Pre-Launch Checklist

Checklist operativa para decidir si VERIJOB está listo para abrir beta controlada.

## Cómo usarla

1. Ejecutar en entorno real controlado o staging equivalente.
2. Marcar cada punto como `OK`, `GO WITH FIXES` o `NO OK`.
3. Si un punto bloqueante falla, la decisión final no puede ser `GO`.
4. Si algo no se corrige en la misma oleada, dejar owner, fecha y riesgo visible.

## Gate técnico obligatorio

| Check | Pasos | Resultado esperado | Severidad |
| --- | --- | --- | --- |
| Build producción | `npm run build` | Build completa, sin errores de TypeScript ni rutas rotas | Bloqueante |
| Smoke beta gate | Ejecutar suite Playwright `@beta-gate` en máquina con navegador/red | Journey candidato→empresa→perfil público ejecutable o fallo claramente localizado | Bloqueante |
| Stripe live validation | Seguir [scripts/stripe/validate-checkout-webhook-flow.md](/Users/xavibocanegra/VERIJOB/verijob-app/scripts/stripe/validate-checkout-webhook-flow.md) | Checkout, webhook, activación e idempotencia verificados | Bloqueante |
| Errores visibles | Navegar rutas críticas | Sin 500 silenciosos, sin pantallas en blanco, sin loops de redirect | Bloqueante |

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
| Evidencias válidas | Subir documento correcto | Se ve `Documento recibido` o estado equivalente claro, sin falsa verificación | Bloqueante |
| Evidencias dudosas | Subir documento dudoso o mal alineado | Se ve `Coincidencia dudosa` o `No alineado`, sin mensaje ambiguo | Bloqueante |
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
| Solicitudes empresa | Abrir `/company/requests` y una solicitud | Se entiende qué experiencia se confirma y qué estado tiene | Bloqueante |
| Resolver verificación | Confirmar/rechazar solicitud | Estado final visible y botones bloqueados durante mutación | Bloqueante |
| Suscripción/capacidad | Abrir `/company/subscription` | Plan actual, renovación y CTA claros | No bloqueante |
| Documentación empresa | Subir documento y revisar histórico | Documento visible y estado documental coherente | Bloqueante |

## Public / share / trust

| Check | Pasos | Resultado esperado | Severidad |
| --- | --- | --- | --- |
| Verify experience | Abrir `/verify-experience/[token]` válido | Página accesible, copy correcto y acción posible | Bloqueante |
| Perfil público candidato | Abrir token compartido | Perfil público renderiza sin exponer datos internos | Bloqueante |
| Datos privados | Revisar `/p/[token]` antes del unlock | Sin email, teléfono ni timeline completo | Bloqueante |
| Trust score público | Revisar bloque de confianza | Score, desglose y señales visibles sin sobrecarga | No bloqueante |
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

## Website / legales / marketing

| Check | Pasos | Resultado esperado | Severidad |
| --- | --- | --- | --- |
| Pricing y marketing | Abrir `/pricing`, `/precios` y landings clave | Sin enlaces rotos ni CTAs muertos | No bloqueante |
| Legales | Abrir privacidad, términos y cookies | Páginas publicadas y accesibles | Bloqueante |
| SEO pública básica | Revisar `robots.txt`, `sitemap.xml`, metadata principal | Responde y no apunta a rutas obsoletas | No bloqueante |

## Calidad general

| Check | Pasos | Resultado esperado | Severidad |
| --- | --- | --- | --- |
| Navegación | Recorrer rutas críticas | Sin enlaces rotos ni 404 no deseados | Bloqueante |
| Empty states | Revisar tablas vacías | Mensajes comprensibles, no parecen bugs | No bloqueante |
| Copy | Revisar branding, labels y textos visibles | Sin residuos técnicos ni copy roto | No bloqueante |
| Exceptions visibles | Navegar con cuentas reales | Sin `Unhandled Exception`, hydration errors ni detalles internos | Bloqueante |

## Decisión final

- `GO`: todos los bloqueantes en `OK`.
- `GO WITH FIXES`: sin bloqueantes abiertos y con pendientes menores documentados con owner y fecha.
- `NO GO`: cualquier bloqueante en `NO OK` o sin validar.

## Registro de salida

Antes de abrir beta, dejar una nota corta con:

- fecha y entorno revisado
- responsable técnico
- responsable de producto
- resultado del smoke
- resultado Stripe live
- lista de pendientes aceptados
