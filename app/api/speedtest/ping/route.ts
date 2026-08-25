import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return new NextResponse(
    JSON.stringify({
      status: "ok",
      timestamp: Date.now(),
      server: "Spectra NOC Edge Gateway (BLR-EAST-04)",
      location: "Bengaluru, Karnataka, IN",
      asn: "AS133280 Spectra Broadband",
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
