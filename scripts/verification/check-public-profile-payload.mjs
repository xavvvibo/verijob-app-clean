const baseUrl = String(process.env.PUBLIC_PROFILE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim();
const token = String(process.env.PUBLIC_PROFILE_TOKEN || "").trim();

if (!baseUrl || !token) {
  console.error("FAIL: define PUBLIC_PROFILE_BASE_URL y PUBLIC_PROFILE_TOKEN");
  process.exit(1);
}

const forbiddenKeys = new Set(["candidate_id", "user_id", "company_id", "storage_path"]);

function walk(value, path = "$") {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) walk(value[i], `${path}[${i}]`);
    return;
  }

  if (!value || typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value)) {
    const lowered = String(key || "").toLowerCase();
    if (forbiddenKeys.has(lowered)) {
      throw new Error(`forbidden_key:${path}.${key}`);
    }
    walk(nested, `${path}.${key}`);
  }
}

const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/public/candidate/${token}`, {
  headers: { accept: "application/json" },
});

if (!response.ok) {
  throw new Error(`public_profile_http_${response.status}`);
}

const payload = await response.json();
walk(payload);

if (!payload?.teaser?.full_name && !payload?.teaser?.public_name) {
  throw new Error("missing_public_identity");
}

if (typeof payload?.teaser?.trust_score !== "number") {
  throw new Error("missing_trust_score");
}

console.log("PASS: public profile payload contract OK");
