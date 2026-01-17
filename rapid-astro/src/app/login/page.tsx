"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { login } from "@/app/actions";

function LoginButton() {
    const { pending } = useFormStatus();

    return (
        <Button className="w-full h-12 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20" disabled={pending}>
            {pending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Entrar no Sistema"}
        </Button>
    );
}

export default function LoginPage() {
    const [errorMessage, setErrorMessage] = useState("");

    async function handleSubmit(formData: FormData) {
        setErrorMessage("");
        try {
            await login(formData);
        } catch (error) {
            setErrorMessage("Credenciais inválidas. Tente novamente.");
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(79,70,229,0.15),transparent_50%)]" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-500/10 blur-[100px] rounded-full" />
            <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500/10 blur-[80px] rounded-full" />

            <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/30">
                        <ShieldCheck className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">Workforce Hub</h1>
                    <p className="text-slate-400 font-medium">Acesso Restrito</p>
                </div>

                <form action={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Usuário</label>
                        <Input
                            name="username"
                            className="bg-slate-900/50 border-white/10 text-white h-12 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Seu usuário de acesso"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Senha</label>
                        <Input
                            name="password"
                            type="password"
                            className="bg-slate-900/50 border-white/10 text-white h-12 focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {errorMessage && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium text-center">
                            {errorMessage}
                        </div>
                    )}

                    <div className="pt-2">
                        <LoginButton />
                    </div>

                    <p className="text-center text-xs text-slate-500 mt-6">
                        Problemas com acesso? Contate o Suporte TI.
                    </p>
                </form>
            </div>
        </div>
    );
}
