import { NextResponse } from "next/server";
import { runScenario, SCENARIOS, type Scenario } from "../../../lib/demo";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const scenario = body?.scenario as Scenario;
  if (!scenario || !(scenario in SCENARIOS)) {
    return NextResponse.json({ error: "Unknown scenario" }, { status: 400 });
  }
  return NextResponse.json(await runScenario(scenario));
}
