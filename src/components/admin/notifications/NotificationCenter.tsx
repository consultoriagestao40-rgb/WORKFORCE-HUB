"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "@/actions/notifications";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Notification = {
    id: string;
    title: string;
    message: string;
    type: string;
    link: string | null;
    read: boolean;
    createdAt: Date;
};

export function NotificationCenter() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [open, setOpen] = useState(false);
    const router = useRouter();

    const loadNotifications = async () => {
        try {
            const data = await getUserNotifications();
            setNotifications(data);
            setUnreadCount(data.filter((n: any) => !n.read).length); // Safe access if type issue persists
        } catch (error) {
            console.error("Failed to load notifications", error);
        }
    };

    useEffect(() => {
        // Poll every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleMarkAsRead = async (id: string, link: string | null) => {
        try {
            await markNotificationAsRead(id);
            // Optimistic update
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));

            if (open) setOpen(false); // Close if navigating
            if (link) {
                router.push(link);
            }
        } catch (error) {
            console.error("Error marking read:", error);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await markAllNotificationsAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error("Error marking all read:", error);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-slate-500 hover:text-slate-700 hover:bg-slate-100">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-0 right-0 h-4 w-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white border-2 border-white">
                            {unreadCount}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 mr-4 bg-white border-slate-200 text-slate-900 shadow-lg" align="end">
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                    <h4 className="font-semibold text-sm">Notificações</h4>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-1 text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                            onClick={handleMarkAllRead}
                        >
                            <Check className="h-3 w-3 mr-1" />
                            Ler todas
                        </Button>
                    )}
                </div>
                <ScrollArea className="h-[300px]">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center text-sm text-slate-500">
                            Nenhuma notificação.
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer ${!notification.read ? 'bg-blue-50/50' : ''}`}
                                    onClick={() => handleMarkAsRead(notification.id, notification.link)}
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex-1 space-y-1">
                                            <p className={`text-sm ${!notification.read ? 'font-medium text-slate-900' : 'text-slate-500'}`}>
                                                {notification.title}
                                            </p>
                                            <p className="text-xs text-slate-500 line-clamp-2">
                                                {notification.message}
                                            </p>
                                            <p className="text-[10px] text-slate-400">
                                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: ptBR })}
                                            </p>
                                        </div>
                                        {!notification.read && (
                                            <div className="h-2 w-2 rounded-full bg-blue-500 mt-1.5" />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
