import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-6 text-white">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">WORKFORCE HUB</h1>
          <p className="mt-2 text-slate-400">Sistema Inteligente de Facilities</p>
        </div>

        <div className="space-y-4 pt-10">
          <Link href="/mobile" className="block w-full">
            <Button size="lg" className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/20">
              Acesso Supervisor
            </Button>
          </Link>

          <Link href="/admin" className="block w-full">
            <Button size="lg" variant="outline" className="w-full h-14 text-lg border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white">
              Painel Administrativo
            </Button>
          </Link>
        </div>

        <p className="mt-8 text-xs text-slate-500">
          Versão PWA 1.0.0
        </p>
      </div>
    </div>
  );
}
