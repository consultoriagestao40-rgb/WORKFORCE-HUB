import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="space-y-2">
                <div className="h-8 w-64 bg-slate-200 rounded"></div>
                <div className="h-4 w-48 bg-slate-200 rounded"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 mt-8">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i}>
                        <CardHeader className="pb-2">
                            <div className="h-4 w-24 bg-slate-200 rounded"></div>
                        </CardHeader>
                        <CardContent>
                            <div className="h-8 w-32 bg-slate-200 rounded mb-2"></div>
                            <div className="h-3 w-20 bg-slate-200 rounded"></div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader>
                    <div className="h-6 w-40 bg-slate-200 rounded"></div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex gap-4 p-4 border-b border-slate-100 last:border-0">
                                <div className="h-10 w-10 bg-slate-200 rounded"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-1/4 bg-slate-200 rounded"></div>
                                    <div className="h-3 w-1/2 bg-slate-200 rounded"></div>
                                </div>
                                <div className="h-4 w-20 bg-slate-200 rounded"></div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
