"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { addRequestComment, getRequestComments } from "@/app/admin/requests/actions";
import { toast } from "sonner";

interface RequestCommentsSectionProps {
    requestId: string;
    currentUserEmail?: string; // Used to identify "me" roughly if we don't have ID on client
}

export function RequestCommentsSection({ requestId, currentUserEmail }: RequestCommentsSectionProps) {
    const [comments, setComments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState("");
    const [sending, setSending] = useState(false);

    useEffect(() => {
        loadComments();
    }, [requestId]);

    const loadComments = async () => {
        try {
            const data = await getRequestComments(requestId);
            setComments(data);
        } catch (error) {
            console.error("Failed to load comments", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = async () => {
        if (!newComment.trim()) return;
        setSending(true);
        try {
            await addRequestComment(requestId, newComment);
            setNewComment("");
            await loadComments(); // Refresh list
        } catch (error) {
            toast.error("Erro ao enviar comentário");
        } finally {
            setSending(false);
        }
    };

    if (loading) return <div className="py-4 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;

    return (
        <div className="flex flex-col h-[500px] bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-3 border-b bg-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-slate-500" />
                <h3 className="font-bold text-slate-700 text-sm">Comentários e Histórico</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {comments.length === 0 ? (
                    <div className="text-center text-slate-400 text-sm py-10 italic">
                        Nenhum comentário registrado ainda.
                    </div>
                ) : (
                    comments.map((comment) => {
                        // We attempt to guess if it is "ME" by checking if the user role is likely current user or by comparing with a prop if we had it. 
                        // Since I don't have currentUserID prop easily available without server passing it, I will style vaguely.
                        // Actually, actions.ts creates the comment with current user. 
                        // I will style based on Role for now? Or just generic left/right if I can match.
                        // Let's assume standard timeline for now, or use a prop if I update the parent.
                        const isSystem = false; // logic for system messages if any
                        return (
                            <div key={comment.id} className={`flex gap-3`}>
                                <Avatar className="h-8 w-8 border border-white shadow-sm shrink-0">
                                    <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-bold">
                                        {comment.user?.name?.charAt(0) || "?"}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-800">{comment.user?.name}</span>
                                        <span className="text-[10px] text-slate-400">
                                            {format(new Date(comment.createdAt), "dd/MM/yyyy, HH:mm", { locale: ptBR })}
                                        </span>
                                    </div>
                                    <div className="bg-white p-3 rounded-tr-xl rounded-b-xl border border-slate-100 shadow-sm text-sm text-slate-600 leading-relaxed">
                                        {comment.content}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <div className="p-3 bg-white border-t space-y-2">
                <Textarea
                    placeholder="Escreva um comentário... Use @ para mencionar"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    className="min-h-[60px] resize-none bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                />
                <div className="flex justify-end">
                    <Button
                        size="sm"
                        className="bg-pink-500 hover:bg-pink-600 text-white rounded-full px-4"
                        disabled={!newComment.trim() || sending}
                        onClick={handleSend}
                    >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-3 h-3 mr-2" /> Enviar</>}
                    </Button>
                </div>
            </div>
        </div>
    );
}
