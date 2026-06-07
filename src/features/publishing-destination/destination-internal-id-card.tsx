import { Copy } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

type Props = {
	destinationId: string
}

export function DestinationInternalIdFields({ destinationId }: Props) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<p className="min-w-0 flex-1 font-mono text-xs break-all text-muted-foreground">
				{destinationId}
			</p>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="gap-1.5 shrink-0"
				onClick={() => {
					void navigator.clipboard.writeText(destinationId).then(
						() => toast.success("Destination id copied"),
						() => toast.error("Could not copy"),
					)
				}}
			>
				<Copy className="size-3.5" />
				Copy
			</Button>
		</div>
	)
}
