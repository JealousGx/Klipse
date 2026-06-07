import { cn } from "@/lib/utils"

const proseStyles = [
	// Headings
	"[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:text-foreground [&_h1]:mb-2",
	"[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h2]:mt-10 [&_h2]:mb-3",
	"[&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-foreground [&_h3]:mt-6 [&_h3]:mb-2",
	// Lead paragraph
	"[&_.lead]:text-lg [&_.lead]:text-muted-foreground [&_.lead]:mb-8",
	// Body text
	"[&_p]:text-[0.938rem] [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_p]:mb-4",
	// Lists
	"[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-5 [&_ul]:space-y-1.5",
	"[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-5 [&_ol]:space-y-1.5",
	"[&_li]:text-[0.938rem] [&_li]:leading-relaxed [&_li]:text-muted-foreground",
	// Links
	"[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:decoration-primary/40 [&_a]:transition-colors hover:[&_a]:decoration-primary",
	// Emphasis
	"[&_strong]:font-semibold [&_strong]:text-foreground",
	// Horizontal rule
	"[&_hr]:my-8 [&_hr]:border-border/50",
].join(" ")

export function LegalArticle({
	children,
	className,
}: {
	children: React.ReactNode
	className?: string
}) {
	return <article className={cn(proseStyles, className)}>{children}</article>
}
