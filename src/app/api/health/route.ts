import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/utils/supabase/service";

export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    // Query mínima no sensible
    const { error } = await supabase
      .from("verification_public_links")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json(
        { status: "degraded" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { status: "ok" },
      { status: 200 }
    );

  } catch {
    return NextResponse.json(
      { status: "down" },
      { status: 500 }
    );
  }
}
