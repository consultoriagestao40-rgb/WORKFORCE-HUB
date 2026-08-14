import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const mediaUrl = searchParams.get("url");

    if (!mediaUrl) {
        return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    try {
        const response = await fetch(mediaUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });

        if (!response.ok) {
            // Se falhar o fetch externo, redirecionar para a URL original
            return NextResponse.redirect(mediaUrl);
        }

        const contentType = response.headers.get("content-type") || "application/octet-stream";
        const buffer = await response.arrayBuffer();

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Length": buffer.byteLength.toString(),
                "Accept-Ranges": "bytes",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=31536000, immutable"
            }
        });
    } catch (err) {
        console.error("Error in media proxy:", err);
        return NextResponse.redirect(mediaUrl);
    }
}
