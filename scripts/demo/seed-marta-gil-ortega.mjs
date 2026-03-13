import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const DEMO = {
  seedVersion: "demo_seed_marta_gil_ortega_v1",
  publicToken: "9f4a8c2d61b0e7f34c5a9d2e18f6ab7c40d19e63b5a8c2d4",
  authEmail: "demo.marta.gil+hosteleria@verijob.test",
  authPassword: "VerijobDemo2026!",
  profile: {
    fullName: "Marta Gil Ortega",
    title: "Encargada | Responsable de turno | Jefa de sala",
    location: "Barcelona",
    phone: "+34 611 222 348",
    summary:
      "Responsable de hosteleria con mas de 10 anos de trayectoria en sala y gestion operativa. Experiencia liderando equipos, organizacion de turnos, control de incidencias, coordinacion con cocina y seguimiento de ventas. Perfil demo pensado para transmitir mando intermedio fiable y entendible por empresa.",
    languages: ["Espanol", "Catalan", "Ingles"],
    skills: [
      "Liderazgo de equipos",
      "Planificacion de turnos",
      "Apertura y cierre",
      "Control de caja",
      "Resolucion de incidencias",
      "Coordinacion sala-cocina",
      "Formacion de personal",
    ],
    certifications: [
      "Curso de gestion de equipos y atencion al cliente en restauracion",
      "Manipulador de alimentos actualizado",
    ],
    education: [
      {
        id: "demo-edu-marta-gestion",
        title: "Curso de Gestion de Equipos en Restauracion",
        institution: "Camara de Comercio de Barcelona",
        start_date: "2018-10-01",
        end_date: "2018-11-30",
        description: "Formacion aplicada a supervision de sala, organizacion de turnos y resolucion de incidencias.",
      },
    ],
  },
  ids: {
    candidateProfile: "d56d0b07-4160-4a54-8f9d-4dfe7d5ce901",
    publicLink: "6de032d3-2678-4f3b-a5c3-160c5a9a4e11",
    employmentCurrent: "8f975f42-5bc9-4bc4-a789-0994ff9c1001",
    employmentShiftLead: "8f975f42-5bc9-4bc4-a789-0994ff9c1002",
    employmentHeadWaiter: "8f975f42-5bc9-4bc4-a789-0994ff9c1003",
    employmentOldSala: "8f975f42-5bc9-4bc4-a789-0994ff9c1004",
    verificationCurrent: "c1d638d3-0f6d-4eb1-9f3c-20f148857001",
    verificationShiftLead: "c1d638d3-0f6d-4eb1-9f3c-20f148857002",
    verificationHeadWaiter: "c1d638d3-0f6d-4eb1-9f3c-20f148857003",
    verificationPending: "c1d638d3-0f6d-4eb1-9f3c-20f148857004",
    evidenceVidaLaboral: "f2b75a37-a8ce-43f1-a9b8-92d8a1002001",
    evidenceNomina: "f2b75a37-a8ce-43f1-a9b8-92d8a1002002",
    evidenceCertificado: "f2b75a37-a8ce-43f1-a9b8-92d8a1002003",
    evidenceContrato: "f2b75a37-a8ce-43f1-a9b8-92d8a1002004",
  },
};

const EMPLOYMENTS = [
  {
    id: DEMO.ids.employmentCurrent,
    company_name_freeform: "Braseria Rambla Alta",
    position: "Encargada",
    start_date: "2022-03-01",
    end_date: "2026-02-28",
    is_current: false,
    verification_status: "verified",
    verification_result: "verified_by_company",
    verification_channel: "email",
    verification_request_id: DEMO.ids.verificationCurrent,
    requested_at: "2026-02-10T09:15:00.000Z",
    resolved_at: "2026-02-12T11:30:00.000Z",
    company_email_target: "direccion@braseriaramblaalta.demo",
    company_name_target: "Braseria Rambla Alta",
    resolution_notes:
      "Experiencia confirmada por empresa. Marta desempeno funciones de encargada, apertura, cierre y coordinacion de equipo.",
    evidences: [
      {
        id: DEMO.ids.evidenceVidaLaboral,
        evidence_type: "vida_laboral",
        document_type: "vida_laboral",
        document_scope: "global",
        trust_weight: 1.0,
        validation_status: "approved",
        document_issue_date: "2026-02-01",
        storage_path: "demo/marta-gil-ortega/vida-laboral-2026.pdf",
        mime_type: "application/pdf",
        file_size: 248120,
        file_sha256: "1111111111111111111111111111111111111111111111111111111111111111",
      },
      {
        id: DEMO.ids.evidenceNomina,
        evidence_type: "nomina",
        document_type: "nomina",
        document_scope: "experience",
        trust_weight: 0.65,
        validation_status: "approved",
        document_issue_date: "2026-01-31",
        storage_path: "demo/marta-gil-ortega/nomina-braseria-rambla-alta-2026-01.pdf",
        mime_type: "application/pdf",
        file_size: 184233,
        file_sha256: "2222222222222222222222222222222222222222222222222222222222222222",
      },
    ],
  },
  {
    id: DEMO.ids.employmentShiftLead,
    company_name_freeform: "Grupo Bocana Tapas",
    position: "Responsable de turno",
    start_date: "2019-01-01",
    end_date: "2022-02-28",
    is_current: false,
    verification_status: "verified",
    verification_result: "verified_by_company",
    verification_channel: "email",
    verification_request_id: DEMO.ids.verificationShiftLead,
    requested_at: "2025-11-20T10:00:00.000Z",
    resolved_at: "2025-11-24T16:20:00.000Z",
    company_email_target: "operaciones@grupobocanatapas.demo",
    company_name_target: "Grupo Bocana Tapas",
    resolution_notes:
      "Experiencia validada por responsable operativo. Confirmadas funciones de supervision de turno y control de caja.",
    evidences: [
      {
        id: DEMO.ids.evidenceCertificado,
        evidence_type: "certificado_empresa",
        document_type: "certificado_empresa",
        document_scope: "experience",
        trust_weight: 0.85,
        validation_status: "approved",
        document_issue_date: "2025-11-22",
        storage_path: "demo/marta-gil-ortega/certificado-grupo-bocana-tapas.pdf",
        mime_type: "application/pdf",
        file_size: 132907,
        file_sha256: "3333333333333333333333333333333333333333333333333333333333333333",
      },
    ],
  },
  {
    id: DEMO.ids.employmentHeadWaiter,
    company_name_freeform: "Hotel Mirador del Port",
    position: "Jefa de sala",
    start_date: "2015-04-01",
    end_date: "2018-12-31",
    is_current: false,
    verification_status: "verified",
    verification_result: "verified_documentary",
    verification_channel: "documentary",
    verification_request_id: DEMO.ids.verificationHeadWaiter,
    requested_at: "2025-10-10T08:40:00.000Z",
    resolved_at: "2025-10-11T12:05:00.000Z",
    company_email_target: null,
    company_name_target: "Hotel Mirador del Port",
    resolution_notes:
      "Experiencia aprobada por verificacion documental con contrato y consistencia temporal correcta.",
    evidences: [
      {
        id: DEMO.ids.evidenceContrato,
        evidence_type: "contrato_trabajo",
        document_type: "contrato_trabajo",
        document_scope: "experience",
        trust_weight: 0.8,
        validation_status: "approved",
        document_issue_date: "2015-04-01",
        storage_path: "demo/marta-gil-ortega/contrato-hotel-mirador-del-port.pdf",
        mime_type: "application/pdf",
        file_size: 201774,
        file_sha256: "4444444444444444444444444444444444444444444444444444444444444444",
      },
    ],
  },
  {
    id: DEMO.ids.employmentOldSala,
    company_name_freeform: "Cafe Teatre Liceu",
    position: "Camarera de sala",
    start_date: "2012-09-01",
    end_date: "2015-03-31",
    is_current: false,
    verification_status: "requested",
    verification_result: "pending_company",
    verification_channel: "email",
    verification_request_id: DEMO.ids.verificationPending,
    requested_at: "2026-03-05T09:10:00.000Z",
    resolved_at: null,
    company_email_target: "gerencia@cafeteatreliceu.demo",
    company_name_target: "Cafe Teatre Liceu",
    resolution_notes: null,
    evidences: [],
  },
];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/g)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2] || "";
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

function ensureEnv() {
  loadEnvFile(path.join(repoRoot, ".env.local"));
  loadEnvFile(path.join(repoRoot, ".env"));
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  }
}

function getAppBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://app.verijob.es").replace(/\/$/, "");
}

function getArg(flag) {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

function hasFlag(flag) {
  return process.argv.slice(2).includes(flag);
}

function getMode() {
  const [mode] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  return mode === "rollback" ? "rollback" : "seed";
}

async function findUserByEmail(admin, email) {
  let page = 1;
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find((user) => String(user.email || "").toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (users.length < 200) break;
    page += 1;
  }
  return null;
}

async function resolveCandidate(admin) {
  const candidateIdArg = getArg("--candidate-id");
  const createAuthUser = hasFlag("--create-auth-user");
  const password = getArg("--auth-password") || DEMO.authPassword;

  if (candidateIdArg) {
    const { data, error } = await admin.auth.admin.getUserById(candidateIdArg);
    if (error || !data?.user) {
      throw new Error(`No existe auth user con id ${candidateIdArg}. Crea primero el usuario demo o usa --create-auth-user.`);
    }
    const authUser = data.user;
    if (String(authUser.email || "").toLowerCase() !== DEMO.authEmail.toLowerCase()) {
      throw new Error(
        `El usuario ${candidateIdArg} no usa el email demo ${DEMO.authEmail}. Para evitar contaminar datos reales, el seed solo opera sobre la cuenta demo dedicada.`
      );
    }
    return { candidateId: String(authUser.id), createdAuthUser: false };
  }

  const existing = await findUserByEmail(admin, DEMO.authEmail);
  if (existing) {
    return { candidateId: String(existing.id), createdAuthUser: false };
  }

  if (!createAuthUser) {
    throw new Error(
      `No existe el usuario demo ${DEMO.authEmail}. Crea ese usuario manualmente en Supabase Auth o ejecuta el script con --create-auth-user.`
    );
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: DEMO.authEmail,
    password,
    email_confirm: true,
    user_metadata: {
      verijob_demo: true,
      seed_version: DEMO.seedVersion,
      display_name: DEMO.profile.fullName,
    },
  });

  if (error || !data?.user) {
    throw new Error(`No se pudo crear el auth user demo: ${String(error?.message || "unknown_error")}`);
  }

  return { candidateId: String(data.user.id), createdAuthUser: true };
}

async function assertSafeDemoTarget(admin, candidateId) {
  const [{ data: profile }, { count: employmentCount }, { count: verificationCount }, { count: evidenceCount }] =
    await Promise.all([
      admin.from("profiles").select("id,email,full_name,title", { count: "exact", head: false }).eq("id", candidateId).maybeSingle(),
      admin.from("employment_records").select("id", { count: "exact", head: true }).eq("candidate_id", candidateId),
      admin.from("verification_requests").select("id", { count: "exact", head: true }).eq("requested_by", candidateId),
      admin.from("evidences").select("id", { count: "exact", head: true }).eq("uploaded_by", candidateId),
    ]);

  if (profile?.id) {
    const profileEmail = String(profile.email || "").toLowerCase();
    const profileName = String(profile.full_name || "").trim();
    if (profileEmail && profileEmail !== DEMO.authEmail.toLowerCase()) {
      throw new Error(
        `El profile ${candidateId} ya existe con email ${profile.email}. El seed solo se aplica sobre la identidad demo ${DEMO.authEmail}.`
      );
    }
    if (profileName && profileName !== DEMO.profile.fullName) {
      throw new Error(
        `El profile ${candidateId} ya existe con nombre ${profile.full_name}. El seed aborta para no sobrescribir una identidad real.`
      );
    }
  }

  const totalExisting = Number(employmentCount || 0) + Number(verificationCount || 0) + Number(evidenceCount || 0);
  if (totalExisting > 0 && !profile?.id) {
    throw new Error(
      `El usuario ${candidateId} ya tiene datos derivados sin profile base. Revisa el estado manualmente antes de aplicar el seed.`
    );
  }
}

function buildCandidateProfilePayload(candidateId, trustScore, trustBreakdown) {
  return {
    id: DEMO.ids.candidateProfile,
    user_id: candidateId,
    summary: DEMO.profile.summary,
    education: DEMO.profile.education,
    certifications: DEMO.profile.certifications,
    skills: DEMO.profile.skills,
    experiences: EMPLOYMENTS.map((item) => ({
      company_name: item.company_name_freeform,
      role_title: item.position,
      start_date: item.start_date,
      end_date: item.end_date,
      verification_state: item.verification_result,
      seed_marker: DEMO.seedVersion,
    })),
    source: DEMO.seedVersion,
    trust_score: trustScore,
    trust_score_breakdown: trustBreakdown,
    show_trust_score: true,
    show_verification_counts: true,
    show_verified_timeline: true,
    allow_company_email_contact: true,
    allow_company_phone_contact: true,
    job_search_status: "abierta_a_proyectos_selectivos",
    availability_start: "30_dias",
    preferred_workday: "completa",
    preferred_roles: ["Encargada", "Responsable de turno", "Jefa de sala"],
    work_zones: "Barcelona ciudad y Hospitalet",
    availability_schedule: ["turno_partido", "tardes", "fin_de_semana"],
    updated_at: new Date().toISOString(),
  };
}

function calculateTrustSeedBreakdown() {
  const verifiedEmploymentCount = EMPLOYMENTS.filter((item) => item.verification_status === "verified").length;
  const verification = verifiedEmploymentCount >= 3 ? 40 : verifiedEmploymentCount === 2 ? 30 : verifiedEmploymentCount === 1 ? 20 : 0;
  const uniqueEvidenceTypes = new Set(
    EMPLOYMENTS.flatMap((item) => item.evidences)
      .filter((item) => item.validation_status !== "rejected")
      .map((item) => item.document_type)
  );
  const evidenceWeights = {
    vida_laboral: 1.0,
    certificado_empresa: 0.85,
    contrato_trabajo: 0.8,
    nomina: 0.65,
    otro_documento: 0.35,
  };
  const evidenceWeightSum = Array.from(uniqueEvidenceTypes).reduce(
    (acc, key) => acc + Number(evidenceWeights[key] || 0),
    0
  );
  const evidence = Math.min(30, Math.round((evidenceWeightSum / 3.65) * 30));
  const consistency = 15;
  const reuse = 0;
  const score = Math.max(0, Math.min(100, Math.round(verification + evidence + consistency + reuse)));
  return {
    score,
    breakdown: {
      verification,
      evidence,
      consistency,
      reuse,
      approved: verifiedEmploymentCount,
      confirmed: 2,
      evidences: EMPLOYMENTS.flatMap((item) => item.evidences).length,
      reuseEvents: 0,
      reuseCompanies: 0,
      model: "seed_mirror_trust_mvp_f28_v2_weighted_evidence",
    },
  };
}

async function upsertSingleRowByLookup({
  admin,
  table,
  lookupColumn,
  lookupValue,
  insertRow,
  updateRow,
  label,
}) {
  const { data: existingRows, error: readErr } = await admin
    .from(table)
    .select("id")
    .eq(lookupColumn, lookupValue)
    .limit(2);

  if (readErr) {
    throw new Error(`${label} lookup failed: ${readErr.message}`);
  }

  const rows = Array.isArray(existingRows) ? existingRows : [];
  if (rows.length > 1) {
    throw new Error(
      `${label} lookup found ${rows.length} filas para ${lookupColumn}=${lookupValue}. El seed aborta para no tocar datos ambiguos.`
    );
  }

  if (rows.length === 1) {
    const targetId = String(rows[0].id || "").trim();
    if (!targetId) {
      throw new Error(`${label} lookup devolvio una fila sin id utilizable.`);
    }
    const { error: updateErr } = await admin
      .from(table)
      .update(updateRow)
      .eq("id", targetId);
    if (updateErr) {
      throw new Error(`${label} update failed: ${updateErr.message}`);
    }
    return { mode: "update", id: targetId };
  }

  const { error: insertErr } = await admin
    .from(table)
    .insert(insertRow);
  if (insertErr) {
    throw new Error(`${label} insert failed: ${insertErr.message}`);
  }
  return { mode: "insert", id: String(insertRow.id || "") };
}

async function seed(admin, candidateId) {
  const trust = calculateTrustSeedBreakdown();
  const expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString();

  const profilePayload = {
    id: candidateId,
    role: "candidate",
    full_name: DEMO.profile.fullName,
    company_name: null,
    onboarding_completed: true,
    email: DEMO.authEmail,
    active_company_id: null,
    avatar_url: null,
    title: DEMO.profile.title,
    location: DEMO.profile.location,
    phone: DEMO.profile.phone,
    city: "Barcelona",
    region: "Barcelona",
    country: "Espana",
    profile_visibility: "public_link",
    show_personal: true,
    show_experience: true,
    show_education: true,
    show_achievements: true,
    updated_at: new Date().toISOString(),
    structured_cv_json: {
      seed_marker: DEMO.seedVersion,
      profile_kind: "demo_candidate",
      target_sector: "hosteleria",
    },
  };

  const candidateProfilePayload = buildCandidateProfilePayload(candidateId, trust.score, trust.breakdown);

  const { error: profileErr } = await admin
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" });
  if (profileErr) throw new Error(`profiles upsert failed: ${profileErr.message}`);

  const { id: _candidateProfileId, ...candidateProfileUpdatePayload } = candidateProfilePayload;

  await upsertSingleRowByLookup({
    admin,
    table: "candidate_profiles",
    lookupColumn: "user_id",
    lookupValue: candidateId,
    insertRow: candidateProfilePayload,
    updateRow: candidateProfileUpdatePayload,
    label: "candidate_profiles",
  });

  for (const item of EMPLOYMENTS) {
    const employmentPayload = {
      id: item.id,
      candidate_id: candidateId,
      company_id: null,
      company_name_freeform: item.company_name_freeform,
      position: item.position,
      start_date: item.start_date,
      end_date: item.end_date,
      source_experience_id: null,
      verification_status: item.verification_status,
      last_verification_requested_at: item.requested_at,
      verification_resolved_at: item.resolved_at,
      verification_result: item.verification_result,
      company_verification_status_snapshot: null,
      verified_by_company_id: null,
      last_verification_request_id: item.verification_request_id,
      is_current: item.is_current,
    };

    const { error: employmentErr } = await admin
      .from("employment_records")
      .upsert(employmentPayload, { onConflict: "id" });
    if (employmentErr) throw new Error(`employment_records upsert failed for ${item.position}: ${employmentErr.message}`);

    const verificationPayload = {
      id: item.verification_request_id,
      employment_record_id: item.id,
      requested_by: candidateId,
      status: item.verification_status === "requested" ? "pending_company" : item.verification_channel === "documentary" ? "approved" : "verified",
      submitted_at: item.requested_at,
      resolved_at: item.resolved_at,
      company_id: null,
      updated_at: new Date().toISOString(),
      public_token: null,
      verification_type: "employment",
      company_email_target: item.company_email_target,
      company_name_target: item.company_name_target,
      verification_channel: item.verification_channel,
      requested_at: item.requested_at,
      resolved_by: null,
      resolution_notes: item.resolution_notes,
      company_id_snapshot: null,
      company_name_snapshot: item.company_name_target,
      company_verification_status_snapshot: null,
      snapshot_at: item.requested_at,
      request_context: {
        seed_marker: DEMO.seedVersion,
        demo_profile: DEMO.profile.fullName,
        purpose: "sales_demo_hosteleria",
        verification_intent: item.verification_result,
      },
      external_email_target: item.company_email_target,
      external_token: item.verification_status === "requested" ? `demo-pending-${item.id.replace(/-/g, "").slice(0, 24)}` : null,
      external_token_expires_at: item.verification_status === "requested" ? expiresAt : null,
    };

    const { error: verificationErr } = await admin
      .from("verification_requests")
      .upsert(verificationPayload, { onConflict: "id" });
    if (verificationErr) throw new Error(`verification_requests upsert failed for ${item.position}: ${verificationErr.message}`);

    for (const evidence of item.evidences) {
      const evidencePayload = {
        id: evidence.id,
        verification_request_id: item.verification_request_id,
        storage_path: evidence.storage_path,
        evidence_type: evidence.evidence_type,
        uploaded_by: candidateId,
        file_sha256: evidence.file_sha256,
        mime_type: evidence.mime_type,
        file_size: evidence.file_size,
        suspicious_duplicate: false,
        document_type: evidence.document_type,
        document_scope: evidence.document_scope,
        trust_weight: evidence.trust_weight,
        validation_status: evidence.validation_status,
        inconsistency_reason: null,
        document_issue_date: evidence.document_issue_date,
      };

      const { error: evidenceErr } = await admin
        .from("evidences")
        .upsert(evidencePayload, { onConflict: "id" });
      if (evidenceErr) throw new Error(`evidences upsert failed for ${evidence.id}: ${evidenceErr.message}`);
    }
  }

  await admin
    .from("candidate_public_links")
    .update({ is_active: false })
    .eq("candidate_id", candidateId)
    .neq("id", DEMO.ids.publicLink);

  const publicLinkPayload = {
    id: DEMO.ids.publicLink,
    candidate_id: candidateId,
    public_token: DEMO.publicToken,
    is_active: true,
    created_by: candidateId,
    expires_at: expiresAt,
    last_viewed_at: null,
  };

  const { error: publicLinkErr } = await admin
    .from("candidate_public_links")
    .upsert(publicLinkPayload, { onConflict: "id" });
  if (publicLinkErr) throw new Error(`candidate_public_links upsert failed: ${publicLinkErr.message}`);

  return {
    candidateId,
    publicToken: DEMO.publicToken,
    publicProfileUrl: `${getAppBaseUrl()}/p/${DEMO.publicToken}`,
    companyProfileUrl: `${getAppBaseUrl()}/company/candidate/${DEMO.publicToken}`,
    trustScore: trust.score,
  };
}

async function rollback(admin, candidateId, options = {}) {
  const deleteAuthUser = Boolean(options.deleteAuthUser);

  const evidenceIds = EMPLOYMENTS.flatMap((item) => item.evidences.map((evidence) => evidence.id));
  const verificationIds = EMPLOYMENTS.map((item) => item.verification_request_id);
  const employmentIds = EMPLOYMENTS.map((item) => item.id);

  if (evidenceIds.length) {
    const { error } = await admin.from("evidences").delete().in("id", evidenceIds);
    if (error) throw new Error(`evidences rollback failed: ${error.message}`);
  }

  const { error: publicLinksErr } = await admin.from("candidate_public_links").delete().eq("candidate_id", candidateId);
  if (publicLinksErr) throw new Error(`candidate_public_links rollback failed: ${publicLinksErr.message}`);

  if (verificationIds.length) {
    const { error } = await admin.from("verification_requests").delete().in("id", verificationIds);
    if (error) throw new Error(`verification_requests rollback failed: ${error.message}`);
  }

  if (employmentIds.length) {
    const { error } = await admin.from("employment_records").delete().in("id", employmentIds);
    if (error) throw new Error(`employment_records rollback failed: ${error.message}`);
  }

  const { error: candidateProfileErr } = await admin.from("candidate_profiles").delete().eq("user_id", candidateId);
  if (candidateProfileErr) throw new Error(`candidate_profiles rollback failed: ${candidateProfileErr.message}`);

  const { error: profileErr } = await admin.from("profiles").delete().eq("id", candidateId);
  if (profileErr) throw new Error(`profiles rollback failed: ${profileErr.message}`);

  if (deleteAuthUser) {
    const { error: authErr } = await admin.auth.admin.deleteUser(candidateId);
    if (authErr) throw new Error(`auth user rollback failed: ${authErr.message}`);
  }
}

function printHelp() {
  console.log(`
Uso:
  node scripts/demo/seed-marta-gil-ortega.mjs seed [--candidate-id <uuid>] [--create-auth-user] [--auth-password <password>]
  node scripts/demo/seed-marta-gil-ortega.mjs rollback [--candidate-id <uuid>] [--delete-auth-user]

Reglas de seguridad:
  - El seed solo opera sobre la cuenta demo ${DEMO.authEmail}
  - Si no existe, puede crearse con --create-auth-user
  - Rollback elimina solo los datos demo sembrados por este script
`);
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp();
    return;
  }

  ensureEnv();
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const mode = getMode();

  if (mode === "rollback") {
    const candidateIdArg = getArg("--candidate-id");
    let candidateId = candidateIdArg;
    if (!candidateId) {
      const existing = await findUserByEmail(supabase, DEMO.authEmail);
      if (!existing) throw new Error(`No existe auth user demo para ${DEMO.authEmail}. Indica --candidate-id si ya conoces el UUID.`);
      candidateId = String(existing.id);
    }
    await rollback(supabase, candidateId, { deleteAuthUser: hasFlag("--delete-auth-user") });
    console.log(JSON.stringify({ ok: true, mode, candidate_id: candidateId, deleted_auth_user: hasFlag("--delete-auth-user") }, null, 2));
    return;
  }

  const { candidateId, createdAuthUser } = await resolveCandidate(supabase);
  await assertSafeDemoTarget(supabase, candidateId);
  const result = await seed(supabase, candidateId);
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode,
        created_auth_user: createdAuthUser,
        seed_version: DEMO.seedVersion,
        candidate_id: result.candidateId,
        demo_email: DEMO.authEmail,
        public_token: result.publicToken,
        public_profile_url: result.publicProfileUrl,
        company_profile_url: result.companyProfileUrl,
        trust_score_expected: result.trustScore,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(String(error?.stack || error?.message || error));
  process.exit(1);
});
