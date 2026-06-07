// ---------------------------------------------------------------------------
// Shared types and constants for the Admin Keys pages
// ---------------------------------------------------------------------------

export const PROVIDERS = [
	"openrouter",
	"google_tts",
	"replicate",
	"unreal_speech",
	"elevenlabs",
	"gemini",
	"pollinations",
	"openai",
	"kling",
	"luma",
] as const

export type Provider = (typeof PROVIDERS)[number]

export const PROVIDER_DOT_COLOR: Record<Provider, string> = {
	openrouter: "bg-violet-400",
	google_tts: "bg-emerald-400",
	replicate: "bg-blue-400",
	unreal_speech: "bg-sky-400",
	elevenlabs: "bg-yellow-400",
	gemini: "bg-zinc-500",
	pollinations: "bg-zinc-500",
	openai: "bg-zinc-500",
	kling: "bg-zinc-500",
	luma: "bg-zinc-500",
}

export const PROVIDER_LABEL: Record<Provider, string> = {
	openrouter: "OpenRouter",
	google_tts: "Google TTS",
	replicate: "Replicate",
	unreal_speech: "Unreal Speech",
	elevenlabs: "ElevenLabs",
	gemini: "Gemini (legacy)",
	pollinations: "Pollinations (legacy)",
	openai: "OpenAI",
	kling: "Kling",
	luma: "Luma",
}

export const TASK_TYPES = [
	"any",
	"script",
	"image",
	"tts",
	"voice",
	"sound",
] as const
export type TaskType = (typeof TASK_TYPES)[number]

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
	any: "Any",
	script: "Script",
	image: "Image",
	tts: "TTS",
	voice: "Voice",
	sound: "Sound",
}

export const fieldClass =
	"w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none ring-offset-0 transition placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
