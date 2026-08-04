const fs = require('fs');

async function main() {
    const username = "cristiano@grupojvsserv.com.br";
    const password = "8Gmw.@DzuuHEz9";
    const bankId = "85740";
    const authUrl = "https://autenticador.secullum.com.br/Token";
    const baseUrl = "https://pontowebintegracaoexterna.secullum.com.br/IntegracaoExterna";

    const body = new URLSearchParams({
        grant_type: "password",
        username: username,
        password: password,
        client_id: "3"
    });

    const tokenRes = await fetch(authUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
    });
    const tokenData = await tokenRes.json();
    const token = tokenData.access_token;

    const headers = {
        "Authorization": `Bearer ${token}`,
        "secullumidbancoselecionado": bankId,
        "Accept": "application/json"
    };

    const windows = [
        { name: "Month 7", start: "2026-06-26", end: "2026-07-25" },
        { name: "Month 6", start: "2026-05-26", end: "2026-06-25" },
        { name: "Month 5", start: "2026-04-26", end: "2026-05-25" }
    ];

    for (const w of windows) {
        console.log(`\n--- Fetching for ${w.name} (${w.start} to ${w.end}) ---`);
        try {
            const url = `${baseUrl}/Batidas?DataInicio=${w.start}&DataFim=${w.end}`;
            const res = await fetch(url, { headers });
            const batidas = await res.json();
            
            const atestados = [];
            for (const b of batidas) {
                const rawObs = (b.Observacoes || "").toLowerCase();
                const rawEntrada = (b.Entrada1 || "").toLowerCase();

                const isAtestado = /at\.?\s*med/i.test(rawEntrada) || /at\.?\s*med/i.test(rawObs) ||
                                   rawEntrada.includes("atestado") || rawEntrada.includes("medico") || rawEntrada.includes("médico") || rawEntrada.includes("atest") ||
                                   rawObs.includes("atestado") || rawObs.includes("medico") || rawObs.includes("médico") || rawObs.includes("atest");
                if (isAtestado) {
                    atestados.push(b);
                }
            }

            console.log(`Total batidas: ${batidas.length}`);
            console.log(`Atestados found in batidas (NEW regex): ${atestados.length}`);
            if (atestados.length > 0) {
                console.log("Sample Atestado:", JSON.stringify(atestados[0], null, 2));
            }
        } catch (err) {
            console.error(err);
        }
    }
}

main().catch(e => console.error(e));
