"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export default function CompanyVerificationViewed({
  verificationId,
}: {
  verificationId: string;
}) {
  useEffect(() => {
    const key = `vj_viewed_${verificationId}`;

    if (sessionStorage.getItem(key)) return;

    trackEvent("first_verification_viewed", {
      verification_id: verificationId,
    });

    sessionStorage.setItem(key, "1");
  }, [verificationId]);

  return null;
}
