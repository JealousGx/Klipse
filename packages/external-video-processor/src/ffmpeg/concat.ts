import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { promisify } from "node:util";

import { ffmpegBin } from "./probe";

const execFileAsync = promisify(execFile);

/**
 * Concatenates multiple silent video segments into one using the concat demuxer.
 * Writes a temporary concat list file at `listPath` then cleans it up via the caller.
 */
export async function concatSegments(
	segPaths: string[],
	listPath: string,
	outputPath: string,
): Promise<void> {
	const body = segPaths
		.map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
		.join("\n");
	await writeFile(listPath, body, "utf8");

	await execFileAsync(
		ffmpegBin(),
		[
			"-y",
			"-f",
			"concat",
			"-safe",
			"0",
			"-i",
			listPath,
			"-c",
			"copy",
			outputPath,
		],
		{ timeout: 600_000, maxBuffer: 80 * 1024 * 1024 },
	);
}
