import { useLocation } from "@tanstack/react-router";
import {
	AlertTriangle,
	ArrowLeft,
	ArrowRight,
	Bug,
	CheckCircle2,
	Flame,
	Info,
	Loader2,
	Send,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitBug } from "@/features/feedback/post.functions";
import { cn } from "@/lib/utils";

interface BugReportDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

type Severity = "low" | "medium" | "high" | "critical";

interface FormState {
	title: string;
	what: string;
	steps: string;
	expected: string;
	severity: Severity;
}

const INITIAL_FORM: FormState = {
	title: "",
	what: "",
	steps: "",
	expected: "",
	severity: "medium",
};

const SEVERITY_OPTIONS: {
	value: Severity;
	label: string;
	icon: typeof Info;
	color: string;
}[] = [
	{
		value: "low",
		label: "Low",
		icon: Info,
		color: "text-blue-500 bg-blue-500/10 border-blue-500/30",
	},
	{
		value: "medium",
		label: "Medium",
		icon: AlertTriangle,
		color: "text-amber-500 bg-amber-500/10 border-amber-500/30",
	},
	{
		value: "high",
		label: "High",
		icon: Flame,
		color: "text-red-500 bg-red-500/10 border-red-500/30",
	},
	{
		value: "critical",
		label: "Critical",
		icon: Bug,
		color: "text-red-900 dark:text-red-300 bg-red-900/10 border-red-900/30",
	},
];

const STEPS = [
	{ title: "What happened?", description: "A short title and description" },
	{
		title: "How to reproduce",
		description: "Optional steps & expected behavior",
	},
	{ title: "Severity", description: "How badly does this affect you?" },
] as const;

export function BugReportDialog({ open, onOpenChange }: BugReportDialogProps) {
	const [step, setStep] = useState(0);
	const [form, setForm] = useState<FormState>(INITIAL_FORM);
	const [submitting, setSubmitting] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const pathname = useLocation().pathname;

	const resetAndClose = useCallback(() => {
		onOpenChange(false);
		setTimeout(() => {
			setStep(0);
			setForm(INITIAL_FORM);
			setSubmitted(false);
		}, 200);
	}, [onOpenChange]);

	const canAdvance =
		step === 0
			? form.title.trim().length >= 5 && form.what.trim().length >= 10
			: true;

	const handleSubmit = async () => {
		setSubmitting(true);

		try {
			const res = await submitBug({
				data: {
					title: form.title.trim(),
					what: form.what.trim(),
					steps: form.steps.trim() || undefined,
					expected: form.expected.trim() || undefined,
					severity: form.severity,
					page: pathname,
				},
			});

			if (res.error) {
				throw new Error(res.error || "Failed to submit report");
			}

			setSubmitted(true);
			toast.success("Bug report sent! Thank you for your feedback.");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to submit report",
			);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={resetAndClose}>
			<DialogContent className="sm:max-w-lg">
				{submitted ? (
					<div className="flex flex-col items-center gap-4 py-6 text-center">
						<div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
							<CheckCircle2 size={28} className="text-emerald-500" />
						</div>
						<div>
							<p className="text-lg font-semibold">Report submitted</p>
							<p className="mt-1 text-sm text-muted-foreground">
								Thank you! We&apos;ll investigate and get back to you if needed.
							</p>
						</div>
						<Button onClick={resetAndClose} className="mt-2 rounded-2xl">
							Close
						</Button>
					</div>
				) : (
					<>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<Bug size={18} className="text-destructive" />
								Report a Bug
							</DialogTitle>
							<DialogDescription>{STEPS[step].description}</DialogDescription>
						</DialogHeader>

						{/* Step indicator */}
						<div className="flex items-center gap-2">
							{STEPS.map((s, i) => (
								<div key={s.title} className="flex flex-1 items-center gap-2">
									<div
										className={cn(
											"h-1 flex-1 rounded-full transition-colors",
											i <= step ? "bg-primary" : "bg-muted",
										)}
									/>
								</div>
							))}
						</div>

						{/* Step 1: Title + Description */}
						{step === 0 && (
							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="bug-title">
										Title <span className="text-destructive">*</span>
									</Label>
									<input
										id="bug-title"
										type="text"
										value={form.title}
										onChange={(e) =>
											setForm({ ...form, title: e.target.value })
										}
										placeholder="e.g. Profile scan freezes after submitting URL"
										maxLength={100}
										className="h-10 w-full rounded-xl border border-input bg-input/30 px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-[3px] focus:ring-ring/50"
									/>
									<p className="text-xs text-muted-foreground">
										{form.title.length}/100
									</p>
								</div>

								<div className="space-y-2">
									<Label htmlFor="bug-what">
										What happened? <span className="text-destructive">*</span>
									</Label>
									<Textarea
										id="bug-what"
										value={form.what}
										onChange={(e) => setForm({ ...form, what: e.target.value })}
										placeholder="Describe the bug in detail. What were you trying to do? What went wrong?"
										maxLength={1000}
										className="min-h-28"
									/>
									<p className="text-xs text-muted-foreground">
										{form.what.length}/1000
									</p>
								</div>
							</div>
						)}

						{/* Step 2: Steps to reproduce + Expected behavior */}
						{step === 1 && (
							<div className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="bug-steps">
										Steps to reproduce (optional)
									</Label>
									<Textarea
										id="bug-steps"
										value={form.steps}
										onChange={(e) =>
											setForm({ ...form, steps: e.target.value })
										}
										placeholder={
											"1. Go to the Analyze page\n2. Enter a profile URL\n3. Click Analyze\n4. See the error"
										}
										maxLength={1000}
										className="min-h-28"
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="bug-expected">
										Expected behavior (optional)
									</Label>
									<Textarea
										id="bug-expected"
										value={form.expected}
										onChange={(e) =>
											setForm({ ...form, expected: e.target.value })
										}
										placeholder="What did you expect to happen instead?"
										maxLength={500}
										className="min-h-20"
									/>
								</div>
							</div>
						)}

						{/* Step 3: Severity */}
						{step === 2 && (
							<div className="space-y-3">
								<Label>How severe is this bug?</Label>
								<div className="grid grid-cols-2 gap-2">
									{SEVERITY_OPTIONS.map((opt) => {
										const Icon = opt.icon;
										const selected = form.severity === opt.value;
										return (
											<button
												key={opt.value}
												type="button"
												onClick={() =>
													setForm({ ...form, severity: opt.value })
												}
												className={cn(
													"flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all",
													selected
														? opt.color
														: "border-border/60 text-muted-foreground hover:border-border hover:bg-muted/30",
												)}
											>
												<Icon size={16} />
												{opt.label}
											</button>
										);
									})}
								</div>
								<p className="text-xs text-muted-foreground">
									Helps us prioritize which bugs to fix first.
								</p>
							</div>
						)}

						{/* Navigation */}
						<div className="flex items-center justify-between pt-2">
							{step > 0 ? (
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setStep(step - 1)}
									className="gap-1"
								>
									<ArrowLeft size={14} />
									Back
								</Button>
							) : (
								<div />
							)}

							{step < STEPS.length - 1 ? (
								<Button
									size="sm"
									onClick={() => setStep(step + 1)}
									disabled={!canAdvance}
									className="gap-1 rounded-2xl"
								>
									Next
									<ArrowRight size={14} />
								</Button>
							) : (
								<Button
									size="sm"
									onClick={handleSubmit}
									disabled={submitting}
									className="gap-1.5 rounded-2xl"
								>
									{submitting ? (
										<Loader2 size={14} className="animate-spin" />
									) : (
										<Send size={14} />
									)}
									Submit Report
								</Button>
							)}
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
