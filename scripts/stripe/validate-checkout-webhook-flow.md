# Stripe checkout/webhook validation

## Prerrequisitos

- `STRIPE_SECRET_KEY` o `STRIPE_SECRET_KEY_LIVE`
- `STRIPE_WEBHOOK_SECRET` o `STRIPE_WEBHOOK_SECRET_LIVE`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Stripe CLI instalada y autenticada

## 1. Aplicar migraciones

```bash
supabase db push
```

## 2. Escuchar webhooks en local

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Guarda el secret temporal que devuelve Stripe CLI como `STRIPE_WEBHOOK_SECRET`.

## 3. Arrancar la app

```bash
npm run dev
```

## 4. Validar checkout válido

Desde la app autenticada:

- candidato: iniciar checkout de `candidate_starter_monthly`
- empresa: iniciar checkout de `company_access_monthly`
- empresa: iniciar checkout de `company_single_cv`

Checks esperados:

- la respuesta de `/api/stripe/checkout` devuelve `url`
- en Stripe Dashboard o CLI la `checkout.session` contiene metadata:
  - `user_id`
  - `company_id` cuando aplica
  - `plan_key`
  - `price_id`
  - `checkout_kind`
  - `actor_role`

## 5. Validar activación de plan

Completa un pago de prueba y luego consulta:

```sql
select stripe_event_id, event_type, status, attempts, processed_at, last_error
from public.stripe_webhook_events
order by last_seen_at desc
limit 20;

select user_id, company_id, plan, status, stripe_customer_id, stripe_subscription_id, metadata, updated_at
from public.subscriptions
order by updated_at desc
limit 20;
```

Checks esperados:

- existe fila `processed` en `stripe_webhook_events`
- `subscriptions.plan` coincide con el `price_id` mapeado
- `subscriptions.metadata->>'price_id'` coincide con Stripe
- `subscriptions.metadata->>'resolved_plan_key'` coincide con el plan comercial esperado

## 6. Validar compra puntual e idempotencia

Completa un pago de `company_single_cv` o `company_pack_5` y luego consulta:

```sql
select stripe_session_id, company_id, buyer_user_id, product_key, price_id, credits_granted, created_at
from public.stripe_oneoff_purchases
order by created_at desc
limit 20;

select user_id, credits, source_type, source_id, metadata, created_at
from public.credit_grants
where source_type = 'stripe_oneoff_purchase'
order by created_at desc
limit 20;
```

Checks esperados:

- una sola fila por `stripe_session_id`
- un solo `credit_grant` por compra

Reenvía el mismo evento desde Stripe CLI:

```bash
stripe events resend <event_id> --webhook-endpoint=<endpoint_id>
```

Checks esperados:

- el webhook responde 200
- `stripe_webhook_events.attempts` sube
- `status` sigue en `processed`
- no aparecen nuevas filas duplicadas en `subscriptions`
- no aparecen nuevos `credit_grants`

## 7. Validar caso inválido

Probar desde cliente autenticado:

- empresa intentando comprar plan candidato
- candidato intentando comprar plan empresa
- `plan_key` inexistente

Checks esperados:

- respuesta 4xx JSON controlada
- sin creación de `checkout.session`
- sin cambios en `subscriptions`, `stripe_oneoff_purchases` ni `credit_grants`
