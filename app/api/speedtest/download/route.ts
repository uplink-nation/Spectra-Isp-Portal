import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

// Pre-allocate a 256 KB chunk buffer for fast zero-allocation streaming
const CHUNK_SIZE = 256 * 1024; // 256 KB
const sampleBuffer = new Uint8Array(CHUNK_SIZE);
for (let i = 0; i < CHUNK_SIZE; i++) {
  sampleBuffer[i] = (i * 31 + 17) & 0xff;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // Default to 15 MB, max 50 MB
  const requestedBytes = Math.min(
    Math.max(parseInt(searchParams.get("bytes") || "15728640", 10), 1024 * 1024),
    50 * 1024 * 1024
  );

  let sentBytes = 0;

  const stream = new ReadableStream({
    pull(controller) {
      if (sentBytes >= requestedBytes) {
        controller.close();
        return;
      }

      const remaining = requestedBytes - sentBytes;
      const bytesToSend = Math.min(remaining, CHUNK_SIZE);
      const chunk =
        bytesToSend === CHUNK_SIZE
          ? sampleBuffer
          : sampleBuffer.subarray(0, bytesToSend);

      controller.enqueue(chunk);
      sentBytes += bytesToSend;
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": requestedBytes.toString(),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
