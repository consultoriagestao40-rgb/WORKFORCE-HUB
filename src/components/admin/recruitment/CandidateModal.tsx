import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { createCandidate } from "@/actions/recruitment";

interface CandidateModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    vacancies: { id: string, title: string }[];
    preSelectedVacancyId?: string;
}

export function CandidateModal({ open, onOpenChange, vacancies, preSelectedVacancyId }: CandidateModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        vacancyId: ""
    });

    useEffect(() => {
        if (open && preSelectedVacancyId) {
            setFormData(prev => ({ ...prev, vacancyId: preSelectedVacancyId }));
        } else if (open && !preSelectedVacancyId) {
            // Reset if opening without pre-selection, but maybe keep name/email if was typing? 
            // Ideally reset full form on close.
            // For now, let's just set vacancy if provided.
        }
    }, [open, preSelectedVacancyId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.vacancyId) {
            toast.error("Selecione uma vaga para o candidato");
            return;
        }

        setIsLoading(true);

        try {
            await createCandidate({
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                vacancyId: formData.vacancyId
            });
            toast.success("Candidato cadastrado com sucesso!");
            onOpenChange(false);
            setFormData({
                name: "",
                email: "",
                phone: "",
                vacancyId: ""
            });
        } catch (error) {
            toast.error("Erro ao cadastrar candidato");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px]">
                <DialogHeader>
                    <DialogTitle>Novo Candidato</DialogTitle>
                    <DialogDescription>
                        Cadastre um novo candidato e associe-o a uma vaga.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Nome Completo</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="João da Silva"
                            required
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="joao@email.com"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="phone">Telefone</Label>
                        <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="(11) 99999-9999"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="vacancy">Vaga</Label>
                        <Select
                            value={formData.vacancyId}
                            onValueChange={(val) => setFormData({ ...formData, vacancyId: val })}
                        >
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecione a vaga..." />
                            </SelectTrigger>
                            <SelectContent>
                                {vacancies.map(v => (
                                    <SelectItem key={v.id} value={v.id} className="max-w-[750px] truncate">
                                        {v.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={isLoading}>Cadastrar</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
