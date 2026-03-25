#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "FAIL: DATABASE_URL no esta definido"
  echo "Expected: export DATABASE_URL='postgresql://...'"
  exit 1
fi

if [[ -z "${CANDIDATE_A_ID:-}" || -z "${CANDIDATE_B_ID:-}" ]]; then
  echo "FAIL: define CANDIDATE_A_ID y CANDIDATE_B_ID"
  echo "Expected: export CANDIDATE_A_ID='uuid-a' CANDIDATE_B_ID='uuid-b'"
  exit 1
fi

psql "$DATABASE_URL" \
  -v candidate_a="'${CANDIDATE_A_ID}'" \
  -v candidate_b="'${CANDIDATE_B_ID}'" \
  -f scripts/sql/assert_candidate_cvs_rls.sql

echo "PASS: candidate_cvs RLS audit completado"
