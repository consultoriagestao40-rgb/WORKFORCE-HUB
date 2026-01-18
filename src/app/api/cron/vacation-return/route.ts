import { NextResponse } from 'next/server';
import { processVacationReturns } from '@/lib/cron/vacation-return';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            // In dev, maybe allow without secret or use a default
            if (process.env.NODE_ENV === 'production') {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        const results = await processVacationReturns();
        return NextResponse.json({ success: true, results });
    } catch (error) {
        console.error('Cron job failed:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
