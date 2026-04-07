"use client";

import { useState, useCallback } from "react";

/* ================================================================
   타입 & 상수
   ================================================================ */

/** 단계별 선택지 데이터 */
const STEPS = [
  {
    title: "현재 보상 구조에서 가장 큰 고통은?",
    subtitle: "복수 선택 가능",
    multi: true,
    options: [
      "동기부여 부재",
      "역할간 형평성 불만",
      "마진 계산 어려움",
      "스프레드시트 비효율",
    ],
  },
  {
    title: "현재 팀 구성이 어떻게 되나요?",
    subtitle: "하나만 선택",
    multi: false,
    options: ["10명 미만", "10~30명", "30~100명", "100명 이상"],
  },
  {
    title: "가장 관심 있는 기능은?",
    subtitle: "하나만 선택",
    multi: false,
    options: [
      "역할별 차등 커미션",
      "마진 대비 인센 시뮬레이션",
      "철학별 보상 설계",
      "CRM 연동 자동화",
    ],
  },
] as const;

const TOTAL_STEPS = 4; // 3단계 선택 + 1단계 이메일/결과

/* ================================================================
   메인 컴포넌트
   ================================================================ */

export default function FeedbackWidget() {
  // 모달 상태
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);

  // 폼 데이터
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [teamSize, setTeamSize] = useState("");
  const [interest, setInterest] = useState("");
  const [email, setEmail] = useState("");

  // AI 결과 상태
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  // 모달 열기/닫기
  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setStep(0);
    setPainPoints([]);
    setTeamSize("");
    setInterest("");
    setEmail("");
    setResult("");
    setError("");
  }, []);

  // 복수 선택 토글 (1단계)
  const togglePainPoint = useCallback((item: string) => {
    setPainPoints((prev) =>
      prev.includes(item) ? prev.filter((p) => p !== item) : [...prev, item]
    );
  }, []);

  // 다음 버튼 활성화 여부
  const canProceed =
    (step === 0 && painPoints.length > 0) ||
    (step === 1 && teamSize !== "") ||
    (step === 2 && interest !== "") ||
    (step === 3 && email.includes("@"));

  // AI 진단 제출
  const handleSubmit = useCallback(async () => {
    if (!email.includes("@")) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ painPoints, teamSize, interest, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "요청에 실패했습니다.");
      } else {
        setResult(data.result);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [painPoints, teamSize, interest, email]);

  // 다음/제출 핸들러
  const handleNext = useCallback(() => {
    if (step < 3) {
      setStep((s) => s + 1);
    } else {
      handleSubmit();
    }
  }, [step, handleSubmit]);

  return (
    <>
      {/* 플로팅 버튼 */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 z-50
                     rounded-full bg-emerald-600 hover:bg-emerald-500
                     px-5 py-3 text-sm font-bold text-white
                     shadow-lg shadow-emerald-900/40
                     transition-all duration-200 hover:scale-105"
        >
          무료 보상 구조 진단
        </button>
      )}

      {/* 모달 오버레이 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          {/* 백드롭 */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* 모달 본체 */}
          <div
            className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl
                        bg-slate-900 border border-slate-700
                        shadow-2xl shadow-black/50
                        animate-slideUp"
          >
            {/* 상단: 진행률 바 + 닫기 */}
            <div className="flex items-center justify-between px-6 pt-5 pb-2">
              <div className="flex-1 mr-4">
                <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-emerald-500 transition-all duration-300
                      ${step === 0 ? "w-1/4" : ""}
                      ${step === 1 ? "w-2/4" : ""}
                      ${step === 2 ? "w-3/4" : ""}
                      ${step === 3 ? "w-full" : ""}
                    `}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {result ? "완료" : `${step + 1} / ${TOTAL_STEPS}`}
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-500 hover:text-white transition-colors text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* 콘텐츠 영역 */}
            <div className="px-6 pb-6 min-h-[320px] flex flex-col">
              {/* AI 결과 화면 */}
              {result ? (
                <div className="flex-1 flex flex-col justify-center">
                  <h3 className="text-lg font-bold text-white mb-4">
                    AI 진단 결과
                  </h3>
                  <div className="rounded-lg bg-slate-800 border border-slate-700 p-4">
                    <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                      {result}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="mt-6 w-full rounded-lg bg-emerald-600 hover:bg-emerald-500
                               py-3 text-sm font-bold text-white transition-colors"
                  >
                    확인했습니다
                  </button>
                </div>
              ) : (
                <>
                  {/* 선택 단계 (0~2) */}
                  {step < 3 && (
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-1">
                        {STEPS[step].title}
                      </h3>
                      <p className="text-xs text-slate-400 mb-4">
                        {STEPS[step].subtitle}
                      </p>
                      <div className="space-y-2">
                        {STEPS[step].options.map((option) => {
                          // 현재 단계에 맞는 선택 상태
                          const isSelected =
                            step === 0
                              ? painPoints.includes(option)
                              : step === 1
                                ? teamSize === option
                                : interest === option;

                          const handleClick = () => {
                            if (step === 0) togglePainPoint(option);
                            else if (step === 1) setTeamSize(option);
                            else setInterest(option);
                          };

                          return (
                            <button
                              key={option}
                              onClick={handleClick}
                              className={`w-full rounded-lg border px-4 py-3 text-left text-sm
                                         transition-all duration-150
                                ${
                                  isSelected
                                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                                    : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
                                }`}
                            >
                              {/* 체크 표시 */}
                              <span className="mr-2">
                                {isSelected ? "✓" : "○"}
                              </span>
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 4단계: 이메일 입력 */}
                  {step === 3 && (
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white mb-1">
                        진단 결과를 받을 이메일
                      </h3>
                      <p className="text-xs text-slate-400 mb-4">
                        AI가 맞춤 보상 전략을 분석해드립니다
                      </p>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ceo@company.com"
                        className="w-full rounded-lg bg-slate-800 border border-slate-700
                                   px-4 py-3 text-sm text-white placeholder-slate-500
                                   focus:border-emerald-500 focus:outline-none"
                      />
                      {error && (
                        <p className="mt-2 text-xs text-red-400">{error}</p>
                      )}
                    </div>
                  )}

                  {/* 하단 버튼 */}
                  <div className="flex gap-3 mt-6">
                    {step > 0 && (
                      <button
                        onClick={() => setStep((s) => s - 1)}
                        className="flex-1 rounded-lg border border-slate-600
                                   py-3 text-sm font-medium text-slate-300
                                   hover:bg-slate-800 transition-colors"
                      >
                        이전
                      </button>
                    )}
                    <button
                      onClick={handleNext}
                      disabled={!canProceed || loading}
                      className={`flex-1 rounded-lg py-3 text-sm font-bold text-white transition-colors
                        ${
                          canProceed && !loading
                            ? "bg-emerald-600 hover:bg-emerald-500"
                            : "bg-slate-700 text-slate-500 cursor-not-allowed"
                        }`}
                    >
                      {loading
                        ? "AI 분석 중..."
                        : step === 3
                          ? "무료 진단 받기"
                          : "다음"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
