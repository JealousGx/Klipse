import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";

export type AuthModalMode = "login" | "signUp";

type AuthModalContextValue = {
	isOpen: boolean;
	mode: AuthModalMode;
	openAuthModal: (mode: AuthModalMode) => void;
	closeAuthModal: () => void;
	setMode: (mode: AuthModalMode) => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
	const [isOpen, setIsOpen] = useState(false);
	const [mode, setMode] = useState<AuthModalMode>("login");

	const openAuthModal = useCallback((next: AuthModalMode) => {
		setMode(next);
		setIsOpen(true);
	}, []);

	const closeAuthModal = useCallback(() => {
		setIsOpen(false);
	}, []);

	const value = useMemo(
		() => ({
			isOpen,
			mode,
			openAuthModal,
			closeAuthModal,
			setMode,
		}),
		[isOpen, mode, openAuthModal, closeAuthModal],
	);

	return (
		<AuthModalContext.Provider value={value}>
			{children}
		</AuthModalContext.Provider>
	);
}

export function useAuthModal() {
	const ctx = useContext(AuthModalContext);
	if (!ctx) {
		throw new Error("useAuthModal must be used within AuthModalProvider");
	}
	return ctx;
}
