import { NextResponse } from "next/server";
import { resolveCompanyDisplayName } from "@/lib/company/company-profile";
import { requireOwner } from "../_lib";

function json(status: number, body: any) {
  const res = NextResponse.json(body, { status });
  res.headers.set("Cache-Control", "no-store");
  return res;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(req: Request) {
  const owner = await requireOwner();
  if (!owner.ok) return json(owner.status, { error: owner.error });

  const url = new URL(req.url);
  const q = String(url.searchParams.get("q") || "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 8), 1), 12);

  if (q.length < 2) {
    return json(200, { users: [], companies: [], verifications: [] });
  }

  const [usersRes, companiesRes, verificationsRes] = await Promise.all([
    owner.admin
      .from("profiles")
      .select("id,email,full_name,role,created_at")
      .or(`email.ilike.%${q}%,full_name.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(limit),
    owner.admin
      .from("companies")
      .select("id,name,trade_name,legal_name,status,created_at")
      .or(`name.ilike.%${q}%,trade_name.ilike.%${q}%,legal_name.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(limit),
    owner.admin
      .from("verification_requests")
      .select("id,status,requested_by,company_id,created_at")
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  if (usersRes.error) return json(400, { error: "owner_search_users_failed", details: usersRes.error.message });
  if (companiesRes.error) return json(400, { error: "owner_search_companies_failed", details: companiesRes.error.message });
  if (verificationsRes.error) return json(400, { error: "owner_search_verifications_failed", details: verificationsRes.error.message });

  const verifications = Array.isArray(verificationsRes.data) ? verificationsRes.data : [];
  const verificationUserIds = Array.from(new Set(verifications.map((row: any) => String(row.requested_by || "")).filter(Boolean)));
  const verificationCompanyIds = Array.from(new Set(verifications.map((row: any) => String(row.company_id || "")).filter(Boolean)));

  const [verificationProfilesRes, verificationCompaniesRes] = await Promise.all([
    verificationUserIds.length
      ? owner.admin.from("profiles").select("id,full_name,email").in("id", verificationUserIds)
      : Promise.resolve({ data: [] } as any),
    verificationCompanyIds.length
      ? owner.admin.from("companies").select("id,name,trade_name,legal_name").in("id", verificationCompanyIds)
      : Promise.resolve({ data: [] } as any),
  ]);

  const profileById = new Map(
    (Array.isArray(verificationProfilesRes.data) ? verificationProfilesRes.data : []).map((row: any) => [String(row.id), row]),
  );
  const companyById = new Map(
    (Array.isArray(verificationCompaniesRes.data) ? verificationCompaniesRes.data : []).map((row: any) => [String(row.id), row]),
  );

  const verificationMatches = verifications
    .map((row: any) => {
      const candidate = profileById.get(String(row.requested_by || "")) as any;
      const company = companyById.get(String(row.company_id || "")) as any;
      const companyName = resolveCompanyDisplayName(company, "");
      const haystack = [row.id, row.status, candidate?.full_name, candidate?.email, companyName]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return {
        id: String(row.id || ""),
        status: String(row.status || ""),
        created_at: String(row.created_at || ""),
        candidate_name: String(candidate?.full_name || candidate?.email || ""),
        company_name: companyName,
        matched: haystack.includes(q.toLowerCase()) || (isUuid(q) && String(row.id || "") === q),
      };
    })
    .filter((row) => row.matched)
    .slice(0, limit)
    .map(({ matched: _matched, ...row }) => row);

  return json(200, {
    users: Array.isArray(usersRes.data) ? usersRes.data : [],
    companies: (Array.isArray(companiesRes.data) ? companiesRes.data : []).map((row: any) => ({
      ...row,
      name: resolveCompanyDisplayName(row, "Tu empresa"),
    })),
    verifications: verificationMatches,
  });
}
