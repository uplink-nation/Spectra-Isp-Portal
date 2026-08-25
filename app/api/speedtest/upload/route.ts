import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let receivedBytes = 0;

  try {
    const reader = request.body?.getReader();

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          receivedBytes += value.length;
        }
      }
    } else {
      const buffer = await request.arrayBuffer();
      receivedBytes = buffer.byteLength;
    }

    const durationMs = Math.max(Date.now() - startTime, 1);

    return NextResponse.json({
      status: "ok",
      receivedBytes,
      durationMs,
      mbps: Number(((receivedBytes * 8) / (durationMs / 1000) / (1024 * 1024)).toFixed(2)),
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "Upload failed", details: String(err) },
      { status: 500 }
    );
  }
}
