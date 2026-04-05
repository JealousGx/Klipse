import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
	isRemoving: boolean;
	onRemove: () => void;
	className?: string;
};

export function DestinationRemoveFields({
	isRemoving,
	onRemove,
	className,
}: Props) {
	return (
		<Button
			type="button"
			variant="destructive"
			className={cn("gap-2", className)}
			disabled={isRemoving}
			onClick={onRemove}
		>
			{isRemoving ? (
				<Loader2 className="size-4 animate-spin" />
			) : (
				<Trash2 className="size-4" />
			)}
			Remove destination
		</Button>
	);
}
