import { NextRequest, NextResponse } from "next/server";
import { analyzeWithGemini } from "@/lib/aiAnalyzer";
import { buildFallbackAnalysis } from "@/lib/fallbackAnalyzer";
import { parseLogLines } from "@/lib/logParser";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawText = typeof body?.logs === "string" ? body.logs : "";

    if (!rawText.trim()) {
      return NextResponse.json({ error: "Log input is empty." }, { status: 400 });
    }

    const { result } = parseLogLines(rawText);

    try {
      const geminiAnalysis = await analyzeWithGemini(rawText);
      if (geminiAnalysis) {
        return NextResponse.json({
          analysis: geminiAnalysis,
          source: geminiAnalysis.source,
          fallbackReason: null,
        });
      }
    } catch (error) {
      console.error("Analysis provider failed:", error);
    }

    const fallback = buildFallbackAnalysis(rawText, result);
    return NextResponse.json({
      analysis: fallback,
      source: "fallback",
      fallbackReason: "The live analysis provider was unavailable, so the built-in diagnostic review was used instead.",
    });
  } catch (error) {
    console.error("Analyze route error:", error);
    return NextResponse.json({ error: "Unable to analyze logs. Please check the input and try again." }, { status: 500 });
  }
}
