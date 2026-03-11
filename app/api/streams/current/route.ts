import { NextResponse } from "next/server";

import { getCurrentStreamStatus } from "@/lib/questions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? Number(yearParam) : null;
  const section = searchParams.get("section");

  if (yearParam !== null && Number.isInteger(year) && section) {
    return NextResponse.json(await getCurrentStreamStatus({ year, section: section.toUpperCase() }));
  }

  return NextResponse.json(await getCurrentStreamStatus());
}
