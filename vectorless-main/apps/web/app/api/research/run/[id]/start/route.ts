import { NextResponse } from "next/server";

import { launchDeepResearch } from "@/lib/orchestrator";

interface RouteParams {
  params: { id: string };
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const result = await launchDeepResearch(params.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}

