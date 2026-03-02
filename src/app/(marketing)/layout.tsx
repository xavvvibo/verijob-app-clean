import CookieConsentBanner from "@/components/privacy/CookieConsentBanner";
import Ga4Client from "@/components/analytics/Ga4Client";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Ga4Client />
      <CookieConsentBanner />
      {children}
    </>
  );
}
