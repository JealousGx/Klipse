import "@tanstack/react-start/server-only"

import { eq } from "drizzle-orm"

import { getDb } from "@/db"
import { users } from "@/db/schema/users"

export async function getUserProfileById(userId: string) {
	const db = getDb()
	const [row] = await db
		.select()
		.from(users)
		.where(eq(users.id, userId))
		.limit(1)
	return row ?? null
}
