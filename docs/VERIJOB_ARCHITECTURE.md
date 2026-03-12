# VERIJOB SYSTEM ARCHITECTURE

Location:
/Users/xavibocanegra/VERIJOB/verijob-app/docs/VERIJOB_ARCHITECTURE.md


--------------------------------------------------
SYSTEM OVERVIEW
--------------------------------------------------

VERIJOB is a professional verification platform.

Purpose:

Verify candidate employment history using:

- company confirmation
- documentary evidence
- trust scoring


Main actors:

Candidate
Company
Owner (platform operator)


--------------------------------------------------
TECH STACK
--------------------------------------------------

Frontend

Next.js


Backend

Next.js API routes


Database

Supabase (PostgreSQL)


Storage

Supabase Storage


Auth

Supabase Auth


Payments

Stripe


Deployment

Vercel


Domains

Marketing
verijob.es

Application
app.verijob.es


--------------------------------------------------
USER ROLES
--------------------------------------------------

Candidate

Creates profile
Adds experiences
Uploads evidences
Requests verifications


Company

Receives verification requests
Confirms or rejects employment


Owner

Operates the platform
Accesses metrics
Controls system health


--------------------------------------------------
CORE MODULES
--------------------------------------------------

Candidate profile

Experience
Education
Languages
Achievements


Verification engine

Candidate requests verification
Company confirms employment


Evidence system

Documents uploaded by candidate

Examples:

contract
payroll
work-life report


Trust score

Calculated based on:

verified experiences
documentary evidence
verification reliability


--------------------------------------------------
PUBLIC PROFILE
--------------------------------------------------

Accessible via token

/p/[token]


Displays:

profile
experience
education
recommendations
skills
trust score


Documents are NEVER public.


--------------------------------------------------
QR PROFILE
--------------------------------------------------

Candidates with subscription get:

QR profile link

QR endpoint:

/api/public/candidate/[token]/qr.svg


--------------------------------------------------
VERIFICATION FLOW
--------------------------------------------------

Candidate adds experience

↓

Candidate requests verification

↓

Company receives request

↓

Company confirms or rejects

↓

Verification stored

↓

Trust score updated


--------------------------------------------------
EVIDENCE FLOW
--------------------------------------------------

Candidate uploads document

↓

Document analyzed

↓

Linked to experience

↓

Evidence strengthens trust score


--------------------------------------------------
TRUST SCORE
--------------------------------------------------

Factors:

company verification
documentary evidence
multiple confirmations


Used to:

increase credibility
improve hiring decisions


--------------------------------------------------
OWNER DASHBOARD
--------------------------------------------------

Owner panel monitors:

system health
growth metrics
verification volume
trust signals
anomalies


--------------------------------------------------
API STRUCTURE
--------------------------------------------------

Public endpoints

/api/public/candidate/[token]


Verification endpoints

/api/verification


Owner endpoints

/api/owner


--------------------------------------------------
FILE STRUCTURE
--------------------------------------------------

Public profile renderer

src/components/public/CandidatePublicProfileRenderer.tsx


Layout components

src/app/(private)/_components/layout


Public auth shell

src/components/public/PublicAuthShell.tsx


--------------------------------------------------
END
--------------------------------------------------
