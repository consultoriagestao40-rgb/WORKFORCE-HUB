"use client";

import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { toast } from "sonner";

interface ResignationLetterDownloadButtonProps {
    fileName: string;
    fileData: string;
}

export function ResignationLetterDownloadButton({ fileName, fileData }: ResignationLetterDownloadButtonProps) {
    const handleDownload = () => {
        try {
            const link = document.createElement("a");
            link.href = fileData;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Carta de demissão baixada com sucesso!");
        } catch (e) {
            toast.error("Erro ao baixar arquivo.");
        }
    };

    return (
        <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleDownload} 
            title={`Baixar ${fileName}`}
            className="h-8 px-2 hover:bg-emerald-50 hover:text-emerald-700 text-emerald-600 font-black text-xs flex items-center gap-1"
        >
            <FileText className="w-3.5 h-3.5" />
            <span>Carta</span>
        </Button>
    );
}
