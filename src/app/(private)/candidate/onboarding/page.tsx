import { redirect } from "next/navigation";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function toQuery(searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item) params.append(key, item);
      }
      continue;
    }
    if (typeof value === "string" && value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export default async function CandidateOnboardingRedirectPage({ searchParams }: Props) {
  const resolved = (await searchParams) || {};
  redirect(`/onboarding${toQuery(resolved)}`);
}
