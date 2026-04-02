import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'BASE CAMP — 강한 세일즈 팀은 여기서 시작합니다',
  description:
    '세일즈 직군(SDR, AE, AM) 인센티브 전략 자동화. 조직 구조, 매출 목표, 영업 방식을 입력하면 BASE CAMP가 전략적 보상 설계를 완성합니다.',
  openGraph: {
    title: 'BASE CAMP',
    description: '강한 세일즈 조직은 보상 설계부터 다르다.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  )
}
