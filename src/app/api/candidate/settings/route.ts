import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const JOB_SEARCH_STATUS = ["buscando_activamente", "abierto_oportunidades", "no_disponible"] as const;
const AVAILABILITY_START = ["inmediata", "7_dias", "15_dias", "30_dias", "mas_adelante"] as const;
const PREFERRED_WORKDAY = ["jornada_completa", "media_jornada", "extras_eventos", "fines_semana", "flexible"] as const;
const PREFERRED_ROLES = [
  "sala",
  "barra",
  "cocina",
  "recepcion",
  "limpieza",
  "encargado_supervision",
  "otros",
] as const;
const AVAILABILITY_SCHEDULE = ["mananas", "tardes", "noches", "fines_semana", "turnos_rotativos"] as const;

function pickEnum<T extends readonly string[]>(value: any, allowed: T) {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value : undefined;
}

function pickArrayEnum<T extends readonly string[]>(value: any, allowed: T) {
  if (!Array.isArray(value)) return undefined;
  const normalized = value
    .filter((v) => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => (allowed as readonly string[]).includes(v));
  return Array.from(new Set(normalized));
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("candidate_profiles")
    .select("show_trust_score,show_verification_counts,show_verified_timeline,allow_company_email_contact,allow_company_phone_contact,job_search_status,availability_start,preferred_workday,preferred_roles,work_zones,availability_schedule")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "read_failed", details: error.message }, { status: 400 });

  return NextResponse.json({
    settings: data || {
      show_trust_score: true,
      show_verification_counts: true,
      show_verified_timeline: true,
      allow_company_email_contact: false,
      allow_company_phone_contact: false,
      job_search_status: "abierto_oportunidades",
      availability_start: "mas_adelante",
      preferred_workday: "flexible",
      preferred_roles: [],
      work_zones: "",
      availability_schedule: [],
    }
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const patch = {
    show_trust_score: typeof body.show_trust_score === "boolean" ? body.show_trust_score : undefined,
    show_verification_counts: typeof body.show_verification_counts === "boolean" ? body.show_verification_counts : undefined,
    show_verified_timeline: typeof body.show_verified_timeline === "boolean" ? body.show_verified_timeline : undefined,
    allow_company_email_contact:
      typeof body.allow_company_email_contact === "boolean" ? body.allow_company_email_contact : undefined,
    allow_company_phone_contact:
      typeof body.allow_company_phone_contact === "boolean" ? body.allow_company_phone_contact : undefined,
    job_search_status: pickEnum(body.job_search_status, JOB_SEARCH_STATUS),
    availability_start: pickEnum(body.availability_start, AVAILABILITY_START),
    preferred_workday: pickEnum(body.preferred_workday, PREFERRED_WORKDAY),
    preferred_roles: pickArrayEnum(body.preferred_roles, PREFERRED_ROLES),
    work_zones: typeof body.work_zones === "string" ? body.work_zones.trim().slice(0, 200) : undefined,
    availability_schedule: pickArrayEnum(body.availability_schedule, AVAILABILITY_SCHEDULE),
    updated_at: new Date().toISOString(),
  } as any;

  Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);

  const { error } = await supabase
    .from("candidate_profiles")
    .update(patch)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: "update_failed", details: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
