export default function GlobalLoading() {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/50 backdrop-blur-sm pointer-events-none transition-opacity animate-in fade-in duration-300">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-slate-600 animate-pulse">Carregando dados...</p>
            </div>
        </div>
    );
}
