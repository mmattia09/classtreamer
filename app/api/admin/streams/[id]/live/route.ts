import { StreamStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getPublicUrl } from "@/lib/server-config";
import { broadcast } from "@/lib/socket-bridge";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  await prisma.stream.updateMany({
    where: { status: StreamStatus.LIVE },
    data: { status: StreamStatus.ENDED },
  });

  const stream = await prisma.stream.update({
    where: { id },
    data: { status: StreamStatus.LIVE },
  });

  broadcast("stream:status", {
    status: "live",
    embedUrl: stream.embedUrl,
    streamId: stream.id,
    title: stream.title,
    liveStartedAt: stream.updatedAt.toISOString(),
  });

  return NextResponse.redirect(new URL(`/admin/streams/${id}`, getPublicUrl()), 303);
}
