import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { Button } from "../ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";

interface PaginationProps {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	className?: string;
	maxPageButtons?: number;
}

export const PaginationWithPageSize = ({
	currentPage,
	totalPages,
	itemsPerPage,
	handlePageChange,
	handlePageSizeChange,
	pageSizeOptions = [5, 10, 20, 50],
}: {
	currentPage: number;
	totalPages: number;
	itemsPerPage: number;
	handlePageChange: (page: number) => void;
	handlePageSizeChange: (pageSize: string) => void;
	className?: string;
	pageSizeOptions?: number[];
}) => {
	return (
		<div className="flex w-full flex-col-reverse items-center justify-between gap-4 sm:flex-row mt-6">
			<div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
				<span className="text-sm">Page size:</span>
				<Select
					value={itemsPerPage.toString()}
					onValueChange={handlePageSizeChange}
				>
					<SelectTrigger className="w-20">
						<SelectValue placeholder={itemsPerPage} />
					</SelectTrigger>
					<SelectContent className="bg-white border-gray-200">
						{pageSizeOptions?.map((option) => (
							<SelectItem key={option} value={option.toString()}>
								{option}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<Pagination
				currentPage={currentPage}
				totalPages={totalPages}
				onPageChange={handlePageChange}
			/>
		</div>
	);
};

export function Pagination({
	currentPage,
	totalPages,
	onPageChange,
	className = "",
	maxPageButtons = 5,
}: PaginationProps) {
	if (totalPages <= 1) {
		return null;
	}
	const getPageNumbers = () => {
		const pageNumbers = [];

		pageNumbers.push(1);

		const startPage = Math.max(2, currentPage - Math.floor(maxPageButtons / 2));
		const endPage = Math.min(totalPages - 1, startPage + maxPageButtons - 3);

		if (startPage > 2) {
			pageNumbers.push("...");
		}

		for (let i = startPage; i <= endPage; i++) {
			pageNumbers.push(i);
		}

		if (endPage < totalPages - 1) {
			pageNumbers.push("...");
		}

		if (totalPages > 1) {
			pageNumbers.push(totalPages);
		}

		return pageNumbers;
	};

	const pageNumbers = getPageNumbers();

	return (
		<div className={cn("flex flex-wrap items-center gap-2", className)}>
			<Button
				variant="outline"
				size="sm"
				onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
				disabled={currentPage === 1}
				aria-label="Previous page"
			>
				<ChevronLeft className="h-4 w-4" />
				<span className="sr-only">Previous Page</span>
			</Button>

			{pageNumbers.map((page) => {
				if (page === "...") {
					return (
						<span key={`ellipsis-${page}`} className="px-2">
							...
						</span>
					);
				}

				return (
					<Button
						key={`page-${page}`}
						variant={currentPage === page ? "default" : "outline"}
						size="sm"
						onClick={() => onPageChange(page as number)}
						aria-current={currentPage === page ? "page" : undefined}
						aria-label={`Page ${page}`}
					>
						{page}
					</Button>
				);
			})}

			<Button
				variant="outline"
				size="sm"
				onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
				disabled={currentPage === totalPages}
				aria-label="Next page"
			>
				<ChevronRight className="h-4 w-4" />
				<span className="sr-only">Next Page</span>
			</Button>
		</div>
	);
}
