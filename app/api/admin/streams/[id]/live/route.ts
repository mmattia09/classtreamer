import { StreamStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPublicUrl } from "@/lib/server-config";
import { broadcast } from "@/lib/socket-bridge";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const stream = await prisma.$transaction(async (tx) => {
    await tx.stream.updateMany({
      where: { status: StreamStatus.LIVE },
      data: { status: StreamStatus.ENDED },
    });

    return tx.stream.update({
      where: { id },
      data: { status: StreamStatus.LIVE },
    });
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
