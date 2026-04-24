import { StreamStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { isAdminAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcast } from "@/lib/socket-bridge";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const stream = await prisma.stream.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!stream) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.stream.delete({
    where: { id },
  });

  if (stream.status === StreamStatus.LIVE) {
    broadcast("stream:status", { status: "no_stream" });
    broadcast("question:close", {});
  }

  return NextResponse.json({ ok: true });
}
