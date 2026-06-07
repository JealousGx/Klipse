import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

import { Button } from "../ui/button"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select"

interface CursorPaginationProps {
	hasPrev: boolean
	hasNext: boolean
	onPrev: () => void
	onNext: () => void
	currentPage: number
	pageSize: number
	onPageSizeChange: (size: number) => void
	pageSizeOptions?: number[]
	className?: string
}

export function CursorPagination({
	hasPrev,
	hasNext,
	onPrev,
	onNext,
	currentPage,
	pageSize,
	onPageSizeChange,
	pageSizeOptions = [5, 10, 20, 50],
	className,
}: CursorPaginationProps) {
	return (
		<div
			className={cn(
				"flex w-full flex-col-reverse items-center justify-between gap-4 sm:flex-row mt-6",
				className,
			)}
		>
			<div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
				<span className="text-sm text-muted-foreground">Page size:</span>
				<Select
					value={pageSize.toString()}
					onValueChange={(v) => onPageSizeChange(Number(v))}
				>
					<SelectTrigger className="w-20">
						<SelectValue placeholder={pageSize} />
					</SelectTrigger>
					<SelectContent>
						{pageSizeOptions.map((opt) => (
							<SelectItem key={opt} value={opt.toString()}>
								{opt}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					onClick={onPrev}
					disabled={!hasPrev}
					aria-label="Previous page"
				>
					<ChevronLeft className="h-4 w-4" />
				</Button>
				<span className="min-w-16 text-center text-sm text-muted-foreground">
					Page {currentPage}
				</span>
				<Button
					variant="outline"
					size="sm"
					onClick={onNext}
					disabled={!hasNext}
					aria-label="Next page"
				>
					<ChevronRight className="h-4 w-4" />
				</Button>
			</div>
		</div>
	)
}
