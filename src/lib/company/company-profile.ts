export type CompanyChecklistItem = {
  id: string;
  title: string;
  description: string;
  status: "completed" | "pending" | "recommended" | "optional";
  priority: "required" | "recommended" | "optional";
  completed: number;
  total: number;
};

export const COMPANY_TYPE_OPTIONS = [
  "Autónomo/a",
  "Startup / scaleup",
  "Pyme",
  "Gran empresa",
  "ETT / agencia de selección",
  "Consultora / servicios profesionales",
  "Administración / entidad pública",
  "ONG / fundación",
] as const;

export const COMPANY_SECTOR_OPTIONS = [
  "Hostelería y turismo",
  "Retail y comercio",
  "Logística y transporte",
  "Industria y producción",
  "Construcción e inmobiliario",
  "Tecnología y digital",
  "Sanidad y sociosanitario",
  "Servicios profesionales",
] as const;

export const COMPANY_SUBSECTOR_OPTIONS: Record<string, readonly string[]> = {
  "Hostelería y turismo": [
    "Restauración",
    "Hoteles y alojamientos",
    "Catering y colectividades",
    "Ocio y eventos",
  ],
  "Retail y comercio": [
    "Tienda especializada",
    "Gran distribución",
    "Moda y belleza",
    "E-commerce",
  ],
  "Logística y transporte": [
    "Almacén y operaciones",
    "Reparto última milla",
    "Transporte por carretera",
    "Mensajería y paquetería",
  ],
  "Industria y producción": [
    "Alimentación",
    "Manufactura",
    "Automoción",
    "Mantenimiento industrial",
  ],
  "Construcción e inmobiliario": [
    "Edificación",
    "Obra civil",
    "Instalaciones y mantenimiento",
    "Gestión de activos",
  ],
  "Tecnología y digital": [
    "Software / SaaS",
    "Servicios IT",
    "Datos, IA y ciberseguridad",
    "Producto digital",
  ],
  "Sanidad y sociosanitario": [
    "Clínica y hospital",
    "Residencias y cuidados",
    "Farmacia y laboratorio",
    "Atención domiciliaria",
  ],
  "Servicios profesionales": [
    "Limpieza y facility services",
    "Seguridad",
    "Contact center",
    "Formación y consultoría",
  ],
};

export const COMPANY_BUSINESS_MODEL_OPTIONS = [
  "B2B",
  "B2C",
  "B2B2C",
  "Marketplace / plataforma",
  "Franquicia",
  "Outsourcing / servicios gestionados",
  "Suscripción / SaaS",
] as const;

export const COMPANY_MARKET_SEGMENT_OPTIONS = [
  "Consumidor final",
  "Microempresas",
  "Pymes",
  "Mid-market",
  "Grandes empresas",
  "Sector público",
] as const;

type CompanyProfileShape = {
  legal_name?: string | null;
  trade_name?: string | null;
  display_name?: string | null;
  name?: string | null;
  company_name?: string | null;
  companyName?: string | null;
  tax_id?: string | null;
  website_url?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_person_name?: string | null;
  contact_person_role?: string | null;
  country?: string | null;
  province?: string | null;
  city?: string | null;
  fiscal_address?: string | null;
  sector?: string | null;
  subsector?: string | null;
  primary_activity?: string | null;
  employee_count_range?: string | null;
  annual_hiring_volume_range?: string | null;
  business_description?: string | null;
  business_model?: string | null;
  market_segment?: string | null;
  operating_address?: string | null;
  postal_code?: string | null;
  founding_year?: number | null;
  locations_count?: number | null;
  common_roles_hired?: string[] | null;
  common_contract_types?: string[] | null;
  common_workday_types?: string[] | null;
  common_languages_required?: string[] | null;
  hiring_zones?: string[] | null;
};

const GENERIC_COMPANY_PLACEHOLDERS = new Set([
  "",
  "-",
  "company",
  "company name",
  "empresa",
  "tu empresa",
  "(empresa)",
]);

export function asTrimmedText(value: unknown) {
  if (value === null || value === undefined) return null;
  const compact = String(value).replace(/\s+/g, " ").trim();
  if (!compact) return null;
  const normalized = compact.toLowerCase();
  if (GENERIC_COMPANY_PLACEHOLDERS.has(normalized)) return null;
  return compact
    .replace(/\s*-\s*-\s*/g, " - ")
    .replace(/\s{2,}/g, " ")
    .replace(/^\-+|\-+$/g, "")
    .replace(/^\(+|\)+$/g, "")
    .trim();
}

export function resolveCompanyDisplayName(
  source?: CompanyProfileShape | string | null,
  fallback = "Tu empresa",
) {
  if (typeof source === "string") {
    return asTrimmedText(source) || fallback;
  }

  const company = source || {};
  return (
    asTrimmedText(company.trade_name) ||
    asTrimmedText(company.legal_name) ||
    asTrimmedText(company.display_name) ||
    asTrimmedText(company.name) ||
    asTrimmedText(company.company_name) ||
    asTrimmedText(company.companyName) ||
    fallback
  );
}

export function getCompanySubsectorOptions(sector: unknown) {
  const key = asTrimmedText(sector);
  return key ? [...(COMPANY_SUBSECTOR_OPTIONS[key] || [])] : [];
}

function isFilledArray(value: unknown) {
  return Array.isArray(value) && value.map((x) => String(x || "").trim()).filter(Boolean).length > 0;
}

export function buildCompanyProfileCompletionModel(args: {
  profile: Partial<CompanyProfileShape> | null | undefined;
  activeDocumentsCount: number;
  memberCount: number;
}) {
  const profile = args.profile || {};
  const activeDocumentsCount = Number(args.activeDocumentsCount || 0);
  const memberCount = Number(args.memberCount || 0);

  const requiredChecks = [
    !!asTrimmedText(profile.legal_name),
    !!asTrimmedText(profile.tax_id),
    !!asTrimmedText(profile.contact_email),
    !!asTrimmedText(profile.contact_phone),
    !!asTrimmedText(profile.contact_person_name),
    !!asTrimmedText(profile.country),
    !!asTrimmedText(profile.province),
    !!asTrimmedText(profile.city),
    !!asTrimmedText(profile.fiscal_address),
    !!asTrimmedText(profile.sector),
    isFilledArray(profile.hiring_zones),
  ];

  const recommendedChecks = [
    !!asTrimmedText(profile.trade_name),
    !!asTrimmedText(profile.contact_person_role),
    !!asTrimmedText(profile.primary_activity),
    !!asTrimmedText(profile.employee_count_range),
    !!asTrimmedText(profile.annual_hiring_volume_range),
    isFilledArray(profile.common_roles_hired),
    isFilledArray(profile.common_contract_types),
    isFilledArray(profile.common_workday_types),
    isFilledArray(profile.common_languages_required),
    !!asTrimmedText(profile.business_description),
    !!asTrimmedText(profile.website_url),
    memberCount > 0,
    activeDocumentsCount > 0,
  ];

  const optionalChecks = [
    !!asTrimmedText(profile.subsector),
    !!asTrimmedText(profile.business_model),
    !!asTrimmedText(profile.market_segment),
    !!asTrimmedText(profile.operating_address),
    !!asTrimmedText(profile.postal_code),
    typeof profile.locations_count === "number" && profile.locations_count > 0,
    typeof profile.founding_year === "number" && profile.founding_year > 1900,
  ];

  const requiredCompleted = requiredChecks.filter(Boolean).length;
  const recommendedCompleted = recommendedChecks.filter(Boolean).length;
  const optionalCompleted = optionalChecks.filter(Boolean).length;

  const requiredScore = requiredChecks.length ? (requiredCompleted / requiredChecks.length) * 70 : 0;
  const recommendedScore = recommendedChecks.length ? (recommendedCompleted / recommendedChecks.length) * 30 : 0;
  const score = Math.round(requiredScore + recommendedScore);

  const checklist: CompanyChecklistItem[] = [
    {
      id: "identity_legal",
      title: "Identidad legal",
      description: "Razón social, NIF/CIF y base legal de empresa.",
      priority: "required",
      completed: [profile.legal_name, profile.tax_id].filter((x) => !!asTrimmedText(x)).length,
      total: 2,
      status:
        !!asTrimmedText(profile.legal_name) && !!asTrimmedText(profile.tax_id) ? "completed" : "pending",
    },
    {
      id: "contact_primary",
      title: "Contacto principal",
      description: "Persona y canales para operar con candidatos y revisiones.",
      priority: "required",
      completed: [profile.contact_email, profile.contact_phone, profile.contact_person_name].filter((x) => !!asTrimmedText(x)).length,
      total: 3,
      status:
        !!asTrimmedText(profile.contact_email) &&
        !!asTrimmedText(profile.contact_phone) &&
        !!asTrimmedText(profile.contact_person_name)
          ? "completed"
          : "pending",
    },
    {
      id: "hiring_coverage",
      title: "Contratación y cobertura",
      description: "Sector, zonas y necesidades reales de contratación.",
      priority: "required",
      completed: [
        profile.sector,
        isFilledArray(profile.hiring_zones) ? "ok" : null,
        isFilledArray(profile.common_roles_hired) ? "ok" : null,
        isFilledArray(profile.common_languages_required) ? "ok" : null,
      ].filter(Boolean).length,
      total: 4,
      status:
        !!asTrimmedText(profile.sector) && isFilledArray(profile.hiring_zones)
          ? isFilledArray(profile.common_roles_hired) || isFilledArray(profile.common_languages_required)
            ? "completed"
            : "recommended"
          : "pending",
    },
    {
      id: "team_permissions",
      title: "Equipo y permisos",
      description: "Miembros activos con acceso al espacio empresa.",
      priority: "recommended",
      completed: memberCount > 1 ? 2 : memberCount > 0 ? 1 : 0,
      total: 2,
      status: memberCount > 1 ? "completed" : memberCount > 0 ? "recommended" : "pending",
    },
    {
      id: "company_documents",
      title: "Documentación empresa",
      description: "Documentos para revisión manual y trazabilidad.",
      priority: "recommended",
      completed: activeDocumentsCount > 0 ? 1 : 0,
      total: 1,
      status: activeDocumentsCount > 0 ? "completed" : "recommended",
    },
    {
      id: "optional_details",
      title: "Detalles opcionales",
      description: "Web, descripción ampliada y datos complementarios.",
      priority: "optional",
      completed: optionalCompleted,
      total: optionalChecks.length,
      status: "optional",
    },
  ];

  return {
    score,
    required: { completed: requiredCompleted, total: requiredChecks.length },
    recommended: { completed: recommendedCompleted, total: recommendedChecks.length },
    optional: { completed: optionalCompleted, total: optionalChecks.length },
    checklist,
  };
}
