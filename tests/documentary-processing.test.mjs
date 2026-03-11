import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDocumentaryExtract,
  computeDocumentaryMatching,
  DOCUMENTARY_EXTRACTION_SCHEMA,
} from "../src/lib/candidate/documentary-processing.js";

test("documentary schema contiene campos críticos del evidence mode", () => {
  const props = DOCUMENTARY_EXTRACTION_SCHEMA.properties || {};
  for (const key of [
    "document_type",
    "candidate_name",
    "company_name",
    "job_title",
    "start_date",
    "end_date",
    "issue_date",
    "confidence_score",
    "extracted_signals",
    "matching_reason",
    "needs_manual_review",
  ]) {
    assert.ok(props[key], `missing schema field: ${key}`);
  }
});

test("normalizeDocumentaryExtract aplica defaults seguros", () => {
  const out = normalizeDocumentaryExtract({
    company_name: " Kiosko Alfresko ",
    confidence_score: 1.2,
    extracted_signals: [" contrato ", ""],
    needs_manual_review: false,
  });

  assert.equal(out.company_name, "Kiosko Alfresko");
  assert.equal(out.confidence_score, 1);
  assert.deepEqual(out.extracted_signals, ["contrato"]);
  assert.equal(typeof out.needs_manual_review, "boolean");
});

test("computeDocumentaryMatching autovincula solo con confianza alta", () => {
  const extraction = {
    document_type: "contrato",
    candidate_name: "Ana García",
    company_name: "Kiosko Alfresko",
    job_title: "Dependiente",
    start_date: "2024-01",
    end_date: "2025-10",
    confidence_score: 0.95,
  };
  const employmentRecords = [
    {
      id: "er-good",
      company_name_freeform: "Kiosko Alfresko S.L.",
      position: "Dependiente de tienda",
      start_date: "2024-01-01",
      end_date: "2025-10-01",
    },
    {
      id: "er-bad",
      company_name_freeform: "Otra Empresa",
      position: "Analista",
      start_date: "2020-01-01",
      end_date: "2020-12-01",
    },
  ];

  const result = computeDocumentaryMatching({ extraction, employmentRecords, candidateName: "Ana Garcia" });
  assert.equal(result.auto_link, true);
  assert.equal(result.link_state, "auto_linked");
  assert.equal(result.best_match.employment_record_id, "er-good");
  assert.ok(result.final_score >= 0.82);
});

test("computeDocumentaryMatching evita autovincular cuando la coincidencia es débil", () => {
  const extraction = {
    document_type: "nomina",
    candidate_name: "Pepe",
    company_name: "Empresa X",
    job_title: "Comercial",
    start_date: null,
    end_date: null,
    confidence_score: 0.4,
  };
  const employmentRecords = [
    {
      id: "er-1",
      company_name_freeform: "Compañía Y",
      position: "Soporte",
      start_date: "2021-01-01",
      end_date: "2022-01-01",
    },
  ];

  const result = computeDocumentaryMatching({ extraction, employmentRecords, candidateName: "Ana Garcia" });
  assert.equal(result.auto_link, false);
  assert.notEqual(result.link_state, "auto_linked");
});
