import { NextResponse } from "next/server";

import { prisma } from "@vectorless/db";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const entries = await prisma.methodologyEntry.findMany({
    where: { runId: params.id },
    orderBy: { createdAt: "asc" }
  });

  if (!entries.length) {
    return NextResponse.json(
      { error: "No methodology entries for this run" },
      { status: 404 }
    );
  }

  const header = "timestamp,action,details";
  const rows = entries.map((entry) => {
    const details =
      typeof entry.details === "object"
        ? JSON.stringify(entry.details).replace(/"/g, '""')
        : "";
    return `${entry.createdAt.toISOString()},${entry.action},"${details}"`;
  });

  const csv = [header, ...rows].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="methodology-${params.id}.csv"`
    }
  });
}

