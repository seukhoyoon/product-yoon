import { NextRequest, NextResponse } from "next/server";

/**
 * AI 보상 구조 진단 API 라우트
 * 클라이언트에서 Anthropic API 키를 노출하지 않기 위해 서버에서 프록시
 */
export async function POST(req: NextRequest) {
  const { painPoints, teamSize, interest, email } = await req.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "API 키가 설정되지 않았습니다." },
      { status: 500 }
    );
  }

  const userContext = [
    `고통 포인트: ${painPoints.join(", ")}`,
    `팀 규모: ${teamSize}`,
    `관심 기능: ${interest}`,
    `이메일: ${email}`,
  ].join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `당신은 B2B SaaS 세일즈 보상 구조 전문 컨설턴트입니다.
아래 고객 정보를 보고, 최적 보상 철학 1가지 추천 + 즉시 실행 액션 1가지를 한국어 200자 이내로 답해주세요.
결과는 "추천 철학:" 과 "즉시 액션:" 형식으로 작성하세요.

${userContext}`,
          },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Anthropic API 오류: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const text =
      data.content?.[0]?.text ?? "진단 결과를 생성하지 못했습니다.";
    return NextResponse.json({ result: text });
  } catch {
    return NextResponse.json(
      { error: "API 요청 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
