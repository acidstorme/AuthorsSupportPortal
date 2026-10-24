export type DraftDto = { text: string; provider: "MOCK" | "OPENAI" | null; model: string | null; generatedAt: string | null; stale: boolean; cached: boolean };
