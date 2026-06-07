import { useNavigate, useSearch } from "@tanstack/react-router"
import { useEffect } from "react"

import type { RootSearch } from "@/lib/routes/root-search"

import AuthModal from "./AuthModal"
import { useAuthModal } from "./AuthModalContext"

/**
 * Syncs `?auth=login|signup` with the auth modal and clears the param when the modal closes.
 */
export function AuthModalBridge() {
	const navigate = useNavigate()
	const search = useSearch({ strict: false }) as RootSearch
	const { isOpen, mode, openAuthModal, closeAuthModal } = useAuthModal()

	const authParam = search.auth

	useEffect(() => {
		if (authParam === "login") {
			openAuthModal("login")
		} else if (authParam === "signup") {
			openAuthModal("signUp")
		}
	}, [authParam, openAuthModal])

	const handleClose = () => {
		closeAuthModal()
		const nextSearch: RootSearch = { ...search, auth: undefined }
		void navigate({
			to: ".",
			search: nextSearch,
			replace: true,
		})
	}

	if (!isOpen) {
		return null
	}

	return <AuthModal key={mode} mode={mode} onClose={handleClose} />
}
