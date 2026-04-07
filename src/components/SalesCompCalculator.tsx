"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
} from "recharts";

/* ================================================================
   타입 정의
   ================================================================ */

/** 역할 키 */
type RoleKey = "leader" | "enterpriseAE" | "smbAE" | "sdr";

/** 철학 키 */
type PhilosophyKey = "margin" | "motivation" | "activity";

/** 탭 키 */
type TabKey = "calculator" | "settings" | "costAnalysis";

/** 역할별 설정 */
interface RoleConfig {
  label: string;
  baseSalary: number; // 연 기본급 (만원)
  quarterlyQuota: number; // 분기 쿼터 (억원) - 일반 역할용
  commissionRate: number; // 커미션 요율 (%)
  personalQuota: number; // 리더 개인 쿼터 (억원)
  teamQuota: number; // 리더 팀 쿼터 (억원)
  meetingCommission: number; // SDR 미팅당 커미션 (만원)
  pipelineRate: number; // SDR 파이프라인 요율 (%)
}

/** 철학별 설정 */
interface PhilosophyConfig {
  margin: { baseMarginRate: number; maxMultiplier: number };
  motivation: {
    cliffThreshold: number;
    tier1Multiplier: number;
    tier2Multiplier: number;
  };
  activity: { activityWeight: number; maxActivityBonus: number };
}

/** 전체 설정 */
interface Settings {
  roles: Record<RoleKey, RoleConfig>;
  philosophy: PhilosophyConfig;
  bigDealThreshold: number; // 빅딜 기준 (쿼터 대비 %)
  bigDealBonusRate: number; // 빅딜 추가 보너스 요율 (%)
}

/* ================================================================
   기본값 상수
   ================================================================ */

const ROLE_KEYS: RoleKey[] = ["leader", "enterpriseAE", "smbAE", "sdr"];
const PHILOSOPHY_KEYS: PhilosophyKey[] = ["margin", "motivation", "activity"];

const PHILOSOPHY_LABELS: Record<PhilosophyKey, string> = {
  margin: "마진 중심",
  motivation: "동기부여 극대화",
  activity: "성실도 반영",
};

// 차트 색상
const COLORS = {
  baseSalary: "#64748b", // slate-500
  incentive: "#10b981", // emerald-500
  revenue: "#fbbf24", // amber-400
  pie: ["#10b981", "#f59e0b", "#64748b", "#6366f1"],
};

/** 기본 설정값 */
const DEFAULT_SETTINGS: Settings = {
  roles: {
    leader: {
      label: "세일즈 리더",
      baseSalary: 8000,
      quarterlyQuota: 0,
      commissionRate: 8,
      personalQuota: 3,
      teamQuota: 15,
      meetingCommission: 0,
      pipelineRate: 0,
    },
    enterpriseAE: {
      label: "엔터프라이즈 AE",
      baseSalary: 6000,
      quarterlyQuota: 5,
      commissionRate: 10,
      personalQuota: 0,
      teamQuota: 0,
      meetingCommission: 0,
      pipelineRate: 0,
    },
    smbAE: {
      label: "SMB AE",
      baseSalary: 4000,
      quarterlyQuota: 2,
      commissionRate: 12,
      personalQuota: 0,
      teamQuota: 0,
      meetingCommission: 0,
      pipelineRate: 0,
    },
    sdr: {
      label: "SDR",
      baseSalary: 3000,
      quarterlyQuota: 0,
      commissionRate: 0,
      personalQuota: 0,
      teamQuota: 0,
      meetingCommission: 20,
      pipelineRate: 3,
    },
  },
  philosophy: {
    margin: { baseMarginRate: 30, maxMultiplier: 2 },
    motivation: {
      cliffThreshold: 60,
      tier1Multiplier: 1.5,
      tier2Multiplier: 2,
    },
    activity: { activityWeight: 30, maxActivityBonus: 20 },
  },
  bigDealThreshold: 50,
  bigDealBonusRate: 5,
};

const STORAGE_KEY = "salesCompSettings";

/* ================================================================
   유틸리티 함수
   ================================================================ */

/** localStorage에서 설정 로드 */
function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    /* 파싱 실패 시 기본값 */
  }
  return DEFAULT_SETTINGS;
}

/** localStorage에 설정 저장 */
function saveSettings(settings: Settings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** 숫자 포맷: 1234 → "1,234" */
function fmt(n: number, decimals = 0): string {
  return n.toLocaleString("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/* ================================================================
   커미션 계산 엔진
   ================================================================ */

/** 역할의 기본 분기 커미션 (달성률 100% 기준, 만원) */
function getBaseCommission(role: RoleConfig, roleKey: RoleKey): number {
  if (roleKey === "leader") {
    // 리더: 개인 + 팀 쿼터 기반
    return (
      (role.personalQuota + role.teamQuota) *
      10000 *
      (role.commissionRate / 100)
    );
  }
  if (roleKey === "sdr") {
    // SDR: 별도 계산 (여기선 0 반환, 별도 함수 사용)
    return 0;
  }
  // AE 역할
  return role.quarterlyQuota * 10000 * (role.commissionRate / 100);
}

/** SDR 분기 커미션 계산 (만원) */
function calcSDRCommission(
  role: RoleConfig,
  meetings: number,
  pipelineAmount: number // 억원
): number {
  const meetingPay = meetings * role.meetingCommission;
  const pipelinePay = pipelineAmount * 10000 * (role.pipelineRate / 100);
  return meetingPay + pipelinePay;
}

/**
 * 철학별 커미션 계산 (만원)
 * @param baseCommission - 100% 달성 시 기본 커미션
 * @param achievement - 달성률 (%)
 * @param settings - 전체 설정
 * @param activityScore - 활동 점수 0-100 (성실도 철학용)
 * @param quarterlyBaseSalary - 분기 기본급 (만원)
 * @param marginRate - 실제 마진율 (%) (마진 중심 철학용)
 */
function calcByPhilosophy(
  philosophy: PhilosophyKey,
  baseCommission: number,
  achievement: number,
  settings: Settings,
  activityScore: number,
  quarterlyBaseSalary: number,
  marginRate: number
): number {
  const rawCommission = baseCommission * (achievement / 100);
  const p = settings.philosophy;

  switch (philosophy) {
    case "margin": {
      // 마진 중심: 마진율에 따라 커미션 배수 조정
      const multiplier = Math.min(
        marginRate / p.margin.baseMarginRate,
        p.margin.maxMultiplier
      );
      return rawCommission * multiplier;
    }
    case "motivation": {
      // 동기부여 극대화: 클리프 + 가속 구간
      const { cliffThreshold, tier1Multiplier, tier2Multiplier } =
        p.motivation;
      if (achievement < cliffThreshold) return 0;
      // 클리프~100%: 선형 증가
      if (achievement <= 100) {
        const fraction =
          (achievement - cliffThreshold) / (100 - cliffThreshold);
        return baseCommission * fraction;
      }
      // 100% 달성분
      let total = baseCommission;
      // 100~120%: 가속 구간 1
      const tier1Achievement = Math.min(achievement, 120) - 100;
      total += baseCommission * (tier1Achievement / 100) * tier1Multiplier;
      // 120%+: 가속 구간 2
      if (achievement > 120) {
        const tier2Achievement = achievement - 120;
        total += baseCommission * (tier2Achievement / 100) * tier2Multiplier;
      }
      return total;
    }
    case "activity": {
      // 성실도 반영: 성과 + 활동 가중 혼합
      const weight = p.activity.activityWeight / 100;
      const resultsCommission = rawCommission * (1 - weight);
      const activityBonus =
        quarterlyBaseSalary *
        (p.activity.maxActivityBonus / 100) *
        (activityScore / 100);
      return resultsCommission + activityBonus;
    }
  }
}

/* ================================================================
   공통 UI 컴포넌트
   ================================================================ */

/** 숫자 입력 필드 */
function NumberField({
  label,
  value,
  onChange,
  suffix = "",
  step = 1,
  min = 0,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          step={step}
          min={min}
          max={max}
          className="w-full rounded bg-slate-700 px-2 py-1 text-sm text-white
                     border border-slate-600 focus:border-emerald-500 focus:outline-none"
        />
        {suffix && <span className="text-xs text-slate-400 shrink-0">{suffix}</span>}
      </div>
    </label>
  );
}

/** 슬라이더 + 숫자 입력 */
function SliderField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix = "%",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="range"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className="flex-1 accent-emerald-500"
        />
        <span className="text-sm text-white w-16 text-right">
          {value}
          {suffix}
        </span>
      </div>
    </label>
  );
}

/** 카드 래퍼 */
function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg bg-slate-800 p-4 ${className}`}>
      {title && (
        <h3 className="text-sm font-semibold text-slate-300 mb-3">{title}</h3>
      )}
      {children}
    </div>
  );
}

/** 요약 카드 */
function SummaryCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-lg bg-slate-800 border border-slate-700 p-4 text-center">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-emerald-400">
        {value}
        <span className="text-sm text-slate-400 ml-1">{unit}</span>
      </p>
    </div>
  );
}

/* ================================================================
   탭1: 계산기 (개인 시뮬레이션)
   ================================================================ */

function CalculatorTab({ settings }: { settings: Settings }) {
  const [selectedRole, setSelectedRole] = useState<RoleKey>("enterpriseAE");
  const [achievement, setAchievement] = useState(100);
  const [activityScore, setActivityScore] = useState(80);
  const [marginRate, setMarginRate] = useState(
    settings.philosophy.margin.baseMarginRate
  );
  // SDR 전용 입력
  const [meetings, setMeetings] = useState(30);
  const [pipelineAmount, setPipelineAmount] = useState(2); // 억원

  // 설정 변경 시 마진율 동기화
  useEffect(() => {
    setMarginRate(settings.philosophy.margin.baseMarginRate);
  }, [settings.philosophy.margin.baseMarginRate]);

  const role = settings.roles[selectedRole];
  const quarterlyBaseSalary = role.baseSalary / 4;

  // 철학별 커미션 계산
  const commissionResults = useMemo(() => {
    const isSDR = selectedRole === "sdr";
    const baseComm = isSDR
      ? calcSDRCommission(role, meetings, pipelineAmount)
      : getBaseCommission(role, selectedRole) * (achievement / 100);

    return PHILOSOPHY_KEYS.map((key) => {
      let commission: number;
      if (isSDR) {
        // SDR은 철학 적용 시 baseComm을 기반으로 조정
        commission = calcByPhilosophy(
          key,
          isSDR ? baseComm : getBaseCommission(role, selectedRole),
          isSDR ? 100 : achievement, // SDR은 미팅/파이프라인 기반이므로 100%로 처리
          settings,
          activityScore,
          quarterlyBaseSalary,
          marginRate
        );
      } else {
        commission = calcByPhilosophy(
          key,
          getBaseCommission(role, selectedRole),
          achievement,
          settings,
          activityScore,
          quarterlyBaseSalary,
          marginRate
        );
      }
      return {
        key,
        label: PHILOSOPHY_LABELS[key],
        commission: Math.round(commission),
        totalQuarterly: Math.round(quarterlyBaseSalary + commission),
      };
    });
  }, [
    selectedRole,
    achievement,
    activityScore,
    marginRate,
    meetings,
    pipelineAmount,
    role,
    quarterlyBaseSalary,
    settings,
  ]);

  // 달성률별 커미션 커브 (라인차트 데이터)
  const curveData = useMemo(() => {
    if (selectedRole === "sdr") return [];
    const baseComm = getBaseCommission(role, selectedRole);
    const points: { achievement: number; margin: number; motivation: number; activity: number }[] = [];
    for (let a = 0; a <= 200; a += 5) {
      const point: { achievement: number; margin: number; motivation: number; activity: number } = {
        achievement: a, margin: 0, motivation: 0, activity: 0,
      };
      PHILOSOPHY_KEYS.forEach((key) => {
        point[key] = Math.round(
          calcByPhilosophy(
            key,
            baseComm,
            a,
            settings,
            activityScore,
            quarterlyBaseSalary,
            marginRate
          )
        );
      });
      points.push(point);
    }
    return points;
  }, [selectedRole, role, settings, activityScore, quarterlyBaseSalary, marginRate]);

  return (
    <div className="space-y-6">
      {/* 역할 선택 + 입력 */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 역할 선택 */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-400">역할 선택</span>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as RoleKey)}
              className="rounded bg-slate-700 px-2 py-1.5 text-sm text-white
                         border border-slate-600 focus:border-emerald-500 focus:outline-none"
            >
              {ROLE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {settings.roles[k].label}
                </option>
              ))}
            </select>
          </label>

          {/* 달성률 (SDR 제외) */}
          {selectedRole !== "sdr" && (
            <SliderField
              label="달성률"
              value={achievement}
              onChange={setAchievement}
              max={200}
            />
          )}

          {/* SDR 전용 입력 */}
          {selectedRole === "sdr" && (
            <>
              <NumberField
                label="분기 미팅 건수"
                value={meetings}
                onChange={setMeetings}
                suffix="건"
              />
              <NumberField
                label="생성 파이프라인"
                value={pipelineAmount}
                onChange={setPipelineAmount}
                suffix="억원"
                step={0.5}
              />
            </>
          )}

          {/* 마진율 (마진 중심 철학용) */}
          <SliderField
            label="실제 마진율"
            value={marginRate}
            onChange={setMarginRate}
            max={80}
          />

          {/* 활동 점수 (성실도 철학용) */}
          <SliderField
            label="활동 점수"
            value={activityScore}
            onChange={setActivityScore}
          />
        </div>
      </Card>

      {/* 철학별 결과 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {commissionResults.map((r) => (
          <Card key={r.key} className="border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">{r.label}</p>
            <p className="text-2xl font-bold text-emerald-400">
              {fmt(r.commission)}<span className="text-sm text-slate-400 ml-1">만원</span>
            </p>
            <p className="text-xs text-slate-500 mt-2">
              분기 총 보상: {fmt(r.totalQuarterly)}만원
              (기본급 {fmt(quarterlyBaseSalary)} + 인센 {fmt(r.commission)})
            </p>
          </Card>
        ))}
      </div>

      {/* 달성률별 커미션 커브 차트 */}
      {selectedRole !== "sdr" && curveData.length > 0 && (
        <Card title="달성률별 커미션 커브">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={curveData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="achievement"
                stroke="#94a3b8"
                tick={{ fontSize: 12 }}
                label={{ value: "달성률 (%)", position: "insideBottom", offset: -5, fill: "#94a3b8" }}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fontSize: 12 }}
                label={{ value: "만원", angle: -90, position: "insideLeft", fill: "#94a3b8" }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: 8 }}
                labelStyle={{ color: "#94a3b8" }}
                formatter={(value) => [`${fmt(Number(value))}만원`]}
                labelFormatter={(v) => `달성률: ${v}%`}
              />
              <Legend />
              <ReferenceLine x={100} stroke="#fbbf24" strokeDasharray="5 5" label={{ value: "100%", fill: "#fbbf24" }} />
              <Line type="monotone" dataKey="margin" name="마진 중심" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="motivation" name="동기부여 극대화" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="activity" name="성실도 반영" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}

/* ================================================================
   탭2: 설정 패널
   ================================================================ */

function SettingsTab({
  settings,
  onChange,
  onReset,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onReset: () => void;
}) {
  // 역할 설정 업데이트 헬퍼
  const updateRole = useCallback(
    (roleKey: RoleKey, field: keyof RoleConfig, value: number) => {
      onChange({
        ...settings,
        roles: {
          ...settings.roles,
          [roleKey]: { ...settings.roles[roleKey], [field]: value },
        },
      });
    },
    [settings, onChange]
  );

  return (
    <div className="space-y-6">
      {/* 초기화 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={onReset}
          className="rounded bg-red-600 hover:bg-red-700 px-3 py-1.5 text-sm text-white
                     transition-colors"
        >
          기본값으로 초기화
        </button>
      </div>

      {/* 역할별 설정 */}
      <h2 className="text-sm font-semibold text-slate-300">역할별 설정</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ROLE_KEYS.map((roleKey) => {
          const role = settings.roles[roleKey];
          const isLeader = roleKey === "leader";
          const isSDR = roleKey === "sdr";
          return (
            <Card key={roleKey} title={role.label} className="border border-slate-700">
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="연 기본급"
                  value={role.baseSalary}
                  onChange={(v) => updateRole(roleKey, "baseSalary", v)}
                  suffix="만원"
                  step={100}
                />
                {/* 리더: 개인/팀 쿼터 분리 */}
                {isLeader && (
                  <>
                    <NumberField
                      label="개인 쿼터 (분기)"
                      value={role.personalQuota}
                      onChange={(v) => updateRole(roleKey, "personalQuota", v)}
                      suffix="억원"
                      step={0.5}
                    />
                    <NumberField
                      label="팀 쿼터 (분기)"
                      value={role.teamQuota}
                      onChange={(v) => updateRole(roleKey, "teamQuota", v)}
                      suffix="억원"
                      step={1}
                    />
                    <NumberField
                      label="커미션 요율"
                      value={role.commissionRate}
                      onChange={(v) => updateRole(roleKey, "commissionRate", v)}
                      suffix="%"
                      step={0.5}
                    />
                  </>
                )}
                {/* 일반 AE */}
                {!isLeader && !isSDR && (
                  <>
                    <NumberField
                      label="분기 쿼터"
                      value={role.quarterlyQuota}
                      onChange={(v) => updateRole(roleKey, "quarterlyQuota", v)}
                      suffix="억원"
                      step={0.5}
                    />
                    <NumberField
                      label="커미션 요율"
                      value={role.commissionRate}
                      onChange={(v) => updateRole(roleKey, "commissionRate", v)}
                      suffix="%"
                      step={0.5}
                    />
                  </>
                )}
                {/* SDR */}
                {isSDR && (
                  <>
                    <NumberField
                      label="미팅당 커미션"
                      value={role.meetingCommission}
                      onChange={(v) => updateRole(roleKey, "meetingCommission", v)}
                      suffix="만원"
                      step={5}
                    />
                    <NumberField
                      label="파이프라인 요율"
                      value={role.pipelineRate}
                      onChange={(v) => updateRole(roleKey, "pipelineRate", v)}
                      suffix="%"
                      step={0.5}
                    />
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* 철학별 설정 */}
      <h2 className="text-sm font-semibold text-slate-300 mt-6">철학별 설정</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 마진 중심 */}
        <Card title="마진 중심" className="border border-slate-700">
          <div className="space-y-3">
            <NumberField
              label="기준 마진율"
              value={settings.philosophy.margin.baseMarginRate}
              onChange={(v) =>
                onChange({
                  ...settings,
                  philosophy: {
                    ...settings.philosophy,
                    margin: { ...settings.philosophy.margin, baseMarginRate: v },
                  },
                })
              }
              suffix="%"
            />
            <NumberField
              label="최대 배수"
              value={settings.philosophy.margin.maxMultiplier}
              onChange={(v) =>
                onChange({
                  ...settings,
                  philosophy: {
                    ...settings.philosophy,
                    margin: { ...settings.philosophy.margin, maxMultiplier: v },
                  },
                })
              }
              suffix="x"
              step={0.1}
            />
          </div>
        </Card>

        {/* 동기부여 극대화 */}
        <Card title="동기부여 극대화" className="border border-slate-700">
          <div className="space-y-3">
            <NumberField
              label="클리프 임계치"
              value={settings.philosophy.motivation.cliffThreshold}
              onChange={(v) =>
                onChange({
                  ...settings,
                  philosophy: {
                    ...settings.philosophy,
                    motivation: { ...settings.philosophy.motivation, cliffThreshold: v },
                  },
                })
              }
              suffix="%"
            />
            <NumberField
              label="100-120% 배수"
              value={settings.philosophy.motivation.tier1Multiplier}
              onChange={(v) =>
                onChange({
                  ...settings,
                  philosophy: {
                    ...settings.philosophy,
                    motivation: { ...settings.philosophy.motivation, tier1Multiplier: v },
                  },
                })
              }
              suffix="x"
              step={0.1}
            />
            <NumberField
              label="120%+ 배수"
              value={settings.philosophy.motivation.tier2Multiplier}
              onChange={(v) =>
                onChange({
                  ...settings,
                  philosophy: {
                    ...settings.philosophy,
                    motivation: { ...settings.philosophy.motivation, tier2Multiplier: v },
                  },
                })
              }
              suffix="x"
              step={0.1}
            />
          </div>
        </Card>

        {/* 성실도 반영 */}
        <Card title="성실도 반영" className="border border-slate-700">
          <div className="space-y-3">
            <NumberField
              label="활동 가중치"
              value={settings.philosophy.activity.activityWeight}
              onChange={(v) =>
                onChange({
                  ...settings,
                  philosophy: {
                    ...settings.philosophy,
                    activity: { ...settings.philosophy.activity, activityWeight: v },
                  },
                })
              }
              suffix="%"
            />
            <NumberField
              label="최대 활동 보너스"
              value={settings.philosophy.activity.maxActivityBonus}
              onChange={(v) =>
                onChange({
                  ...settings,
                  philosophy: {
                    ...settings.philosophy,
                    activity: { ...settings.philosophy.activity, maxActivityBonus: v },
                  },
                })
              }
              suffix="%"
            />
          </div>
        </Card>
      </div>

      {/* 기타 설정 */}
      <h2 className="text-sm font-semibold text-slate-300 mt-6">기타 설정</h2>
      <Card className="border border-slate-700">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberField
            label="엔터프라이즈 빅딜 기준 (쿼터 대비)"
            value={settings.bigDealThreshold}
            onChange={(v) => onChange({ ...settings, bigDealThreshold: v })}
            suffix="%"
          />
          <NumberField
            label="빅딜 추가 보너스 요율"
            value={settings.bigDealBonusRate}
            onChange={(v) => onChange({ ...settings, bigDealBonusRate: v })}
            suffix="%"
            step={0.5}
          />
        </div>
      </Card>
    </div>
  );
}

/* ================================================================
   탭3: 비용 포션 분석
   ================================================================ */

function CostAnalysisTab({ settings }: { settings: Settings }) {
  // 팀 구성 입력
  const [revenue, setRevenue] = useState(30); // 분기 총 매출 (억원)
  const [marginRate, setMarginRate] = useState(
    settings.philosophy.margin.baseMarginRate
  ); // 매출 마진율 (%)
  const [headcount, setHeadcount] = useState<Record<RoleKey, number>>({
    leader: 1,
    enterpriseAE: 3,
    smbAE: 4,
    sdr: 3,
  });
  const [avgAchievement, setAvgAchievement] = useState<Record<RoleKey, number>>({
    leader: 100,
    enterpriseAE: 90,
    smbAE: 95,
    sdr: 100,
  });
  const [selectedPhilosophy, setSelectedPhilosophy] = useState<PhilosophyKey>("margin");
  const [mounted, setMounted] = useState(false);

  // SSR 방지 (recharts 호환)
  useEffect(() => setMounted(true), []);

  // 설정 변경 시 마진율 동기화
  useEffect(() => {
    setMarginRate(settings.philosophy.margin.baseMarginRate);
  }, [settings.philosophy.margin.baseMarginRate]);

  // 역할별 비용 계산
  const analysis = useMemo(() => {
    const revenueWon = revenue * 10000; // 만원 단위
    const marginWon = revenueWon * (marginRate / 100);

    // 각 철학별, 각 역할별 계산
    const byPhilosophy: Record<
      PhilosophyKey,
      {
        totalBaseSalary: number;
        totalIncentive: number;
        roleBreakdown: { role: string; baseSalary: number; incentive: number }[];
      }
    > = {} as never;

    PHILOSOPHY_KEYS.forEach((pKey) => {
      let totalBase = 0;
      let totalInc = 0;
      const breakdown: { role: string; baseSalary: number; incentive: number }[] = [];

      ROLE_KEYS.forEach((rKey) => {
        const role = settings.roles[rKey];
        const count = headcount[rKey];
        const ach = avgAchievement[rKey];
        const qBase = role.baseSalary / 4; // 분기 기본급
        const roleBaseCost = qBase * count;

        let roleIncentive: number;
        if (rKey === "sdr") {
          // SDR: 평균 미팅 20건, 파이프라인 1.5억 가정 (달성률로 스케일)
          const sdrComm = calcSDRCommission(role, 20 * (ach / 100), 1.5 * (ach / 100));
          roleIncentive = sdrComm * count;
        } else {
          const baseComm = getBaseCommission(role, rKey);
          const commission = calcByPhilosophy(
            pKey,
            baseComm,
            ach,
            settings,
            80, // 기본 활동 점수
            qBase,
            marginRate
          );
          roleIncentive = commission * count;
        }

        totalBase += roleBaseCost;
        totalInc += roleIncentive;
        breakdown.push({
          role: role.label,
          baseSalary: Math.round(roleBaseCost),
          incentive: Math.round(roleIncentive),
        });
      });

      byPhilosophy[pKey] = {
        totalBaseSalary: Math.round(totalBase),
        totalIncentive: Math.round(totalInc),
        roleBreakdown: breakdown,
      };
    });

    // 비율 계산 (현재 선택된 철학 기준)
    const current = byPhilosophy[selectedPhilosophy];
    const totalCost = current.totalBaseSalary + current.totalIncentive;
    const incToRevenue =
      revenueWon > 0 ? (current.totalIncentive / revenueWon) * 100 : 0;
    const incToMargin =
      marginWon > 0 ? (current.totalIncentive / marginWon) * 100 : 0;

    return { revenueWon, marginWon, byPhilosophy, totalCost, incToRevenue, incToMargin };
  }, [revenue, marginRate, headcount, avgAchievement, settings, selectedPhilosophy]);

  // 스택 바차트 데이터
  const barData = useMemo(
    () =>
      PHILOSOPHY_KEYS.map((pKey) => ({
        name: PHILOSOPHY_LABELS[pKey],
        기본급: analysis.byPhilosophy[pKey].totalBaseSalary,
        인센티브: analysis.byPhilosophy[pKey].totalIncentive,
        매출: analysis.revenueWon,
      })),
    [analysis]
  );

  // 파이차트 데이터 (현재 선택 철학 기준)
  const current = analysis.byPhilosophy[selectedPhilosophy];
  const pieData = useMemo(() => {
    const incentive = current.totalIncentive;
    const remainingMargin = Math.max(0, analysis.marginWon - incentive);
    const otherCost = Math.max(0, analysis.revenueWon - analysis.marginWon);
    return [
      { name: "인센티브", value: incentive },
      { name: "나머지 마진", value: remainingMargin },
      { name: "기타 비용", value: otherCost },
    ];
  }, [current, analysis]);

  return (
    <div className="space-y-6">
      {/* 입력 패널 */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <NumberField
            label="분기 총 매출"
            value={revenue}
            onChange={setRevenue}
            suffix="억원"
            step={1}
          />
          <SliderField
            label="매출 마진율"
            value={marginRate}
            onChange={setMarginRate}
            max={80}
          />
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-xs text-slate-400">비교 기준 철학</span>
            <select
              value={selectedPhilosophy}
              onChange={(e) => setSelectedPhilosophy(e.target.value as PhilosophyKey)}
              className="rounded bg-slate-700 px-2 py-1.5 text-sm text-white
                         border border-slate-600 focus:border-emerald-500 focus:outline-none"
            >
              {PHILOSOPHY_KEYS.map((k) => (
                <option key={k} value={k}>
                  {PHILOSOPHY_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* 팀 구성 & 달성률 */}
        <h3 className="text-xs font-semibold text-slate-400 mb-2">팀 구성 & 평균 달성률</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ROLE_KEYS.map((rKey) => (
            <div key={rKey} className="space-y-2">
              <p className="text-xs text-slate-300 font-medium">
                {settings.roles[rKey].label}
              </p>
              <NumberField
                label="인원"
                value={headcount[rKey]}
                onChange={(v) => setHeadcount((h) => ({ ...h, [rKey]: v }))}
                suffix="명"
              />
              <SliderField
                label="달성률"
                value={avgAchievement[rKey]}
                onChange={(v) => setAvgAchievement((a) => ({ ...a, [rKey]: v }))}
                max={200}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* 요약 카드 3개 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          label="분기 총 인건비 (기본급 + 인센)"
          value={fmt(analysis.totalCost)}
          unit="만원"
        />
        <SummaryCard
          label="매출 대비 세일즈 비용 비중"
          value={fmt(analysis.incToRevenue, 1)}
          unit="%"
        />
        <SummaryCard
          label="마진 대비 인센 소진율"
          value={fmt(analysis.incToMargin, 1)}
          unit="%"
        />
      </div>

      {/* 차트 영역 */}
      {mounted && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* A) 스택 바차트 */}
          <Card title="철학별 인건비 구조 비교">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: 8 }}
                  formatter={(value, name) => [
                    `${fmt(Number(value))}만원`,
                    String(name),
                  ]}
                />
                <Legend />
                <Bar dataKey="기본급" stackId="cost" fill={COLORS.baseSalary} />
                <Bar dataKey="인센티브" stackId="cost" fill={COLORS.incentive} />
                <Line
                  type="monotone"
                  dataKey="매출"
                  stroke={COLORS.revenue}
                  strokeDasharray="5 5"
                  strokeWidth={2}
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* B) 도넛 차트 */}
          <Card title={`${PHILOSOPHY_LABELS[selectedPhilosophy]} - 매출 구성`}>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${((percent ?? 0) * 100).toFixed(1)}%`
                  }
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS.pie[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569", borderRadius: 8 }}
                  formatter={(value) => [`${fmt(Number(value))}만원`]}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   메인 컴포넌트
   ================================================================ */

/** 영업 보상 구조 시뮬레이터 */
export default function SalesCompCalculator() {
  const [activeTab, setActiveTab] = useState<TabKey>("calculator");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  // 초기 로드 시 localStorage에서 설정 복원
  useEffect(() => {
    setSettings(loadSettings());
    setLoaded(true);
  }, []);

  // 설정 변경 시 localStorage에 저장
  useEffect(() => {
    if (loaded) saveSettings(settings);
  }, [settings, loaded]);

  // 기본값 초기화
  const handleReset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    saveSettings(DEFAULT_SETTINGS);
  }, []);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "calculator", label: "계산기" },
    { key: "settings", label: "설정" },
    { key: "costAnalysis", label: "비용 포션 분석" },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-6 lg:p-8">
      {/* 헤더 */}
      <div className="max-w-6xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
          영업 보상 구조 시뮬레이터
        </h1>
        <p className="text-sm text-slate-400 mb-6">
          세일즈 팀의 인센티브 구조를 설계하고 비용을 시뮬레이션하세요
        </p>

        {/* 탭 네비게이션 */}
        <div className="flex gap-1 mb-6 border-b border-slate-700">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors
                ${
                  activeTab === tab.key
                    ? "bg-emerald-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 콘텐츠 */}
        {activeTab === "calculator" && <CalculatorTab settings={settings} />}
        {activeTab === "settings" && (
          <SettingsTab settings={settings} onChange={setSettings} onReset={handleReset} />
        )}
        {activeTab === "costAnalysis" && <CostAnalysisTab settings={settings} />}
      </div>
    </div>
  );
}
