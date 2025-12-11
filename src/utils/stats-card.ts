import { Resvg } from '@resvg/resvg-js'
import type { ReactNode } from 'react'
import satori from 'satori'

// フォントキャッシュ
let fontCache: ArrayBuffer | null = null

// フォント取得
async function loadFont(): Promise<ArrayBuffer> {
	if (fontCache) return fontCache

	// Inter font from Google Fonts CDN
	const fontResponse = await fetch(
		'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50ujGVKXmsT2cfcw.woff2',
	)
	fontCache = await fontResponse.arrayBuffer()
	return fontCache
}

// 試合履歴の型
export type MatchHistoryItem = {
	won: boolean
	change: number
}

// 統計カードデータの型
export type StatsCardData = {
	displayName: string
	avatarUrl: string
	rank: string
	rating: number
	wins: number
	losses: number
	winRate: number
	position: number | null
	isPlacement: boolean
	placementGames?: number
	matchHistory: MatchHistoryItem[]
}

// Tier色定義
const tierColors: Record<string, string> = {
	Iron: '#6B5344',
	Bronze: '#8B6914',
	Silver: '#7B8B8B',
	Gold: '#FFD700',
	Platinum: '#00CED1',
	Emerald: '#50C878',
	Diamond: '#B9F2FF',
	Master: '#9370DB',
	Grandmaster: '#DC143C',
	Challenger: '#00BFFF',
}

function getTierColor(rank: string): string {
	for (const [tier, color] of Object.entries(tierColors)) {
		if (rank.startsWith(tier)) return color
	}
	return '#FFFFFF'
}

// ヘルパー関数（ReactNode互換のVirtual DOM）
function h(type: string, props: Record<string, unknown>, ...children: unknown[]): ReactNode {
	return {
		type,
		props: {
			...props,
			children: children.length === 1 ? children[0] : children.length > 0 ? children : undefined,
		},
	} as ReactNode
}

// 統計行のセル
function statCell(label: string, value: string, color: string): ReactNode {
	return h(
		'div',
		{
			style: {
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
			},
		},
		h('div', { style: { fontSize: '12px', color: '#a0a0a0' } }, label),
		h('div', { style: { fontSize: '20px', fontWeight: 700, color } }, value),
	)
}

// 試合履歴アイテム
function matchHistoryItem(match: MatchHistoryItem): ReactNode {
	const color = match.won ? '#4ade80' : '#f87171'
	const bgColor = match.won ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'
	return h(
		'div',
		{
			style: {
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				backgroundColor: bgColor,
				borderRadius: '8px',
				padding: '8px 12px',
				minWidth: '60px',
			},
		},
		h('div', { style: { fontSize: '12px', fontWeight: 700, color } }, match.won ? 'WIN' : 'LOSE'),
		h('div', { style: { fontSize: '12px', color } }, `${match.change > 0 ? '+' : ''}${match.change}`),
	)
}

// 統計カード作成
function createStatsCard(data: StatsCardData): ReactNode {
	const tierColor = getTierColor(data.rank)
	const totalGames = data.wins + data.losses

	const matchHistoryElements =
		data.matchHistory.length > 0
			? data.matchHistory.slice(0, 5).map((match) => matchHistoryItem(match))
			: [h('div', { style: { fontSize: '14px', color: '#a0a0a0' } }, 'No matches yet')]

	return h(
		'div',
		{
			style: {
				display: 'flex',
				flexDirection: 'column',
				width: '500px',
				height: '280px',
				background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
				borderRadius: '16px',
				padding: '24px',
				fontFamily: 'Inter',
				color: '#ffffff',
			},
		},
		// Header
		h(
			'div',
			{
				style: {
					display: 'flex',
					alignItems: 'center',
					marginBottom: '16px',
				},
			},
			// Avatar
			h('img', {
				src: data.avatarUrl,
				style: {
					width: '56px',
					height: '56px',
					borderRadius: '50%',
					marginRight: '16px',
				},
			}),
			// Name + Position
			h(
				'div',
				{
					style: {
						display: 'flex',
						flexDirection: 'column',
						flex: 1,
					},
				},
				h('div', { style: { fontSize: '20px', fontWeight: 700, color: '#ffffff' } }, data.displayName),
				h(
					'div',
					{ style: { fontSize: '14px', color: '#a0a0a0', marginTop: '4px' } },
					data.isPlacement
						? `Placement (${data.placementGames ?? 0}/5)`
						: data.position
							? `Rank #${data.position}`
							: 'Unranked',
				),
			),
			// Rank + MMR
			h(
				'div',
				{
					style: {
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'flex-end',
					},
				},
				h(
					'div',
					{ style: { fontSize: '24px', fontWeight: 700, color: tierColor } },
					data.isPlacement ? 'Placement' : data.rank,
				),
				h('div', { style: { fontSize: '14px', color: '#a0a0a0' } }, `${data.rating} MMR`),
			),
		),
		// Stats Row
		h(
			'div',
			{
				style: {
					display: 'flex',
					justifyContent: 'space-between',
					backgroundColor: 'rgba(255,255,255,0.05)',
					borderRadius: '12px',
					padding: '16px',
					marginBottom: '16px',
				},
			},
			statCell('WINS', String(data.wins), '#4ade80'),
			statCell('LOSSES', String(data.losses), '#f87171'),
			statCell('GAMES', String(totalGames), '#ffffff'),
			statCell('WINRATE', `${data.winRate}%`, data.winRate >= 50 ? '#4ade80' : '#f87171'),
		),
		// Match History
		h(
			'div',
			{
				style: {
					display: 'flex',
					flexDirection: 'column',
				},
			},
			h('div', { style: { fontSize: '12px', color: '#a0a0a0', marginBottom: '8px' } }, 'RECENT MATCHES'),
			h(
				'div',
				{
					style: {
						display: 'flex',
						gap: '8px',
					},
				},
				...matchHistoryElements,
			),
		),
	)
}

// PNG画像を生成
export async function generateStatsCard(data: StatsCardData): Promise<Buffer> {
	const font = await loadFont()

	const svg = await satori(createStatsCard(data), {
		width: 500,
		height: 280,
		fonts: [
			{
				name: 'Inter',
				data: font,
				weight: 400,
				style: 'normal',
			},
			{
				name: 'Inter',
				data: font,
				weight: 700,
				style: 'normal',
			},
		],
	})

	const resvg = new Resvg(svg)
	const pngData = resvg.render()
	return Buffer.from(pngData.asPng())
}
