# VERIJOB DESIGN SYSTEM

Location:
/Users/xavibocanegra/VERIJOB/verijob-app/docs/DESIGN_SYSTEM.md

Purpose:
Define visual and branding rules of the VERIJOB platform to ensure UI consistency across the product.

Applies to:

- app.verijob.es
- verijob.es
- public candidate profiles
- CV exports
- QR profiles
- candidate dashboard
- company dashboard
- owner dashboard


--------------------------------------------------
BRAND ASSETS
--------------------------------------------------

Location inside project:

/public/brand

Official assets:

/brand/verijob-wordmark.png
/brand/verijob-logo-no-tagline.png
/brand/verijob-logo-white-bg.png
/brand/verijob-favicon-tick.ico


--------------------------------------------------
LOGO USAGE
--------------------------------------------------

Dashboard navigation:

Use
/brand/verijob-wordmark.png


Auth pages:

Use
/brand/verijob-logo-no-tagline.png

Screens:

/login
/signup
/reset


Public pages:

Use
/brand/verijob-logo-no-tagline.png


PDF / CV export:

Use
/brand/verijob-logo-white-bg.png


--------------------------------------------------
FAVICON
--------------------------------------------------

Main favicon:

/brand/verijob-favicon-tick.ico

Configured in:

src/app/layout.tsx


--------------------------------------------------
BRAND COLORS
--------------------------------------------------

Primary blue

#1F6BFF


Dark UI blue

#243B7A


Neutral gray

#3F4654


Success green

#7CC043


Warning yellow

#F2C94C


--------------------------------------------------
TYPOGRAPHY
--------------------------------------------------

Primary font:

Inter


Sizes:

H1 40–48px
H2 32–36px
H3 24–28px
Body 16px
Small 14px


--------------------------------------------------
LOGO SAFE AREA
--------------------------------------------------

Minimum margin around logo:

0.5 × logo height


--------------------------------------------------
SIDEBAR RULES
--------------------------------------------------

Sidebar must display:

- wordmark only
- no tagline
- no large logo


--------------------------------------------------
TOPBAR RULES
--------------------------------------------------

Topbar contains:

- user plan badge
- profile menu
- notifications

Topbar must NOT display logo.


--------------------------------------------------
PUBLIC PROFILE STRUCTURE
--------------------------------------------------

Header
Sidebar
Tabs


Tabs:

Profile
Experience
Education
Recommendations
Languages & Achievements


Sidebar elements:

Trust score
Verification summary
Skills
Education highlights
Recommendations
QR profile (if subscription active)


--------------------------------------------------
VERIFICATION BADGES
--------------------------------------------------

Possible public badges:

Verificado por empresa
Verificación documental
Contrato validado
Nómina validada
Informe de vida laboral validado
Referencia empresarial verificada

Documents must never be public.


--------------------------------------------------
EMPTY STATE RULE
--------------------------------------------------

External view:

Hide empty sections completely.

Internal candidate preview:

Show completion hints.


--------------------------------------------------
QR RULE
--------------------------------------------------

QR visible only if candidate subscription:

active
trialing

Endpoint:

/api/public/candidate/[token]/qr.svg


--------------------------------------------------
PRINT RULE
--------------------------------------------------

PDF export must avoid layout breaks.

Use:

break-inside: avoid


--------------------------------------------------
END
--------------------------------------------------
