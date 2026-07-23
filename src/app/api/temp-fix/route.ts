import { NextRequest, NextResponse } from "next/server";
import { getPayrollPreview } from "@/actions/payroll";

export async function GET(request: NextRequest) {
    try {
        const month = 7;
        const year = 2026;

        console.log(`Running getPayrollPreview for year ${year}, month ${month}...`);
        const result = await getPayrollPreview(year, month);

        const paulo = result.items.find(item => item.employeeName.includes("PAULO SERGIO"));

        return NextResponse.json({
            success: true,
            totalItems: result.items.length,
            pauloDetails: paulo || null
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

