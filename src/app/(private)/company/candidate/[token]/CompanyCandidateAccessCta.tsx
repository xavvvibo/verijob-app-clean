"use client";

import ProfileUnlockAction from "@/components/company/ProfileUnlockAction";

export default function CompanyCandidateAccessCta(props: {
  candidateToken?: string;
  href: string;
  requestHref: string;
  availableAccesses: number;
  alreadyUnlocked?: boolean;
  unlockedAt?: string | null;
  unlockedUntil?: string | null;
  primaryLabel?: string;
}) {
  return <ProfileUnlockAction {...props} />;
}
