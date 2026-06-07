import { drizzle, type MySql2Database } from "drizzle-orm/mysql2"
import mysql from "mysql2/promise"

import { env } from "@/env"

import * as schema from "./schema"

export type LocalDb = MySql2Database<typeof schema>

let _db: LocalDb | undefined

export function getLocal(): LocalDb {
	if (!_db) {
		const pool = mysql.createPool(env.DATABASE_URL)
		_db = drizzle(pool, { schema, mode: "default" })
	}
	return _db
}
