"use client";

import { useState } from "react";
import { SidebarNav } from "@/components/admin/SidebarNav";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminLayoutWrapperProps {
    children: React.ReactNode;
    user: any;
}

export function AdminLayoutWrapper({ children, user }: AdminLayoutWrapperProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div className="flex min-h-screen bg-slate-50/50 relative">
            {/* Sidebar */}
            <aside
                className={cn(
                    "bg-slate-950 text-white p-6 hidden md:flex flex-col fixed h-[calc(100vh-2rem)] m-4 rounded-3xl shadow-2xl overflow-hidden border border-white/5 z-40 transition-all duration-300 ease-in-out",
                    isCollapsed ? "w-24 px-4" : "w-72"
                )}
            >
                {/* Toggle Button - Vertically Centered */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:text-blue-600 hover:scale-110 transition-all shadow-md z-50 cursor-pointer"
                >
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>

                {/* Decorative Background Elements */}
                <div className="absolute bottom-20 -left-20 w-40 h-40 bg-accent/20 blur-3xl pointer-events-none" />

                <div className="relative z-10 mb-8 px-0">
                    <div className={cn(
                        "flex items-center gap-3 h-20 border-b border-white/5 bg-gradient-to-r from-transparent to-white/[0.02] transition-all duration-300",
                        isCollapsed ? "justify-center px-0" : "px-4"
                    )}>
                        <div className={cn(
                            "w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0",
                            !isCollapsed && "group-hover:scale-105"
                        )}>
                            <span className="font-bold text-white text-lg tracking-tight">WH</span>
                        </div>

                        {!isCollapsed && (
                            <div className="flex flex-col overflow-hidden whitespace-nowrap">
                                <h1 className="text-lg font-black tracking-tighter leading-none animate-in fade-in slide-in-from-left-2 duration-300">WORKFORCE HUB</h1>
                                <span className="text-[10px] font-medium text-slate-400 tracking-widest uppercase mt-0.5">Personnel Management</span>
                            </div>
                        )}
                    </div>
                </div>

                <SidebarNav user={user} isCollapsed={isCollapsed} />

                <div className={cn(
                    "mt-auto py-4 border-t border-white/5 flex items-center transition-all duration-300",
                    isCollapsed ? "justify-center flex-col gap-2" : "justify-between px-2"
                )}>
                    {!isCollapsed && <div className="text-[10px] text-slate-500 font-bold whitespace-nowrap">PRO VERSION v2.0</div>}
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Online" />
                </div>
            </aside>

            {/* Main Content */}
            <main className={cn(
                "flex-1 p-10 transition-all duration-300 ease-in-out",
                isCollapsed ? "md:ml-28" : "md:ml-80"
            )}>
                {children}
            </main>
        </div>
    );
}
