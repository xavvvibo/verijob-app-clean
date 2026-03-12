# VERIJOB CODEX RULES

Location:
/Users/xavibocanegra/VERIJOB/verijob-app/docs/CODEX_RULES.md

Purpose:
Provide guardrails for AI agents (Codex) and developers when modifying the VERIJOB codebase.

These rules aim to prevent breaking authentication, routing, verification flows, or branding.


--------------------------------------------------
GENERAL PRINCIPLES
--------------------------------------------------

1. Do NOT break existing routes.

2. Do NOT modify authentication logic unless explicitly requested.

3. Do NOT rename or move API routes that are already in production.

4. Always respect existing data structures in Supabase.

5. Never expose private data in public endpoints.


--------------------------------------------------
ROUTING RULES
--------------------------------------------------

Application routes:

/candidate
/company
/owner

Public profile:

/p/[token]

Public API:

/api/public/candidate/[token]

Do not change these routes without explicit instruction.


--------------------------------------------------
AUTH RULES
--------------------------------------------------

Authentication is handled by Supabase.

Rules:

- Do not modify Supabase auth flow.
- Do not change session handling.
- Do not modify OTP flow.
- Do not break login redirects.

Auth pages:

/login
/signup


--------------------------------------------------
VERIFICATION ENGINE RULES
--------------------------------------------------

Verification flow must remain intact:

Candidate creates experience

↓

Candidate requests verification

↓

Company confirms or rejects

↓

Verification stored

↓

Trust score recalculated


Never bypass this flow.


--------------------------------------------------
EVIDENCE SYSTEM RULES
--------------------------------------------------

Evidence documents are private.

Rules:

- Never expose storage_path publicly.
- Never expose Supabase storage URLs.
- Public profile can only display verification signals.


--------------------------------------------------
PUBLIC PROFILE RULES
--------------------------------------------------

Public profile route:

/p/[token]

Public data may include:

- candidate name
- experience
- education
- trust score
- verification badges

Public profile must NEVER expose:

- raw documents
- Supabase storage paths
- private metadata


--------------------------------------------------
UI RULES
--------------------------------------------------

Always follow:

docs/DESIGN_SYSTEM.md


Key rules:

- Sidebar uses wordmark only
- Topbar has no logo
- Use official assets in /public/brand
- Do not introduce new logo variants


--------------------------------------------------
FILE MODIFICATION RULE
--------------------------------------------------

When modifying files:

Prefer editing existing components rather than creating duplicates.

Avoid creating new layout systems.

Respect current folder structure.


--------------------------------------------------
DATA SAFETY
--------------------------------------------------

Never delete:

verification_requests
evidences
owner_actions

These contain historical platform records.


--------------------------------------------------
BUILD RULE
--------------------------------------------------

After any change:

npm run build

The build must succeed with no errors.


--------------------------------------------------
END
--------------------------------------------------
