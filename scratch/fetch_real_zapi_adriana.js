const ZAPI_INSTANCE_ID = "3F1993DFB59E83474F059E648AE68DF9";
const ZAPI_TOKEN = "81087A6B5C1CAB8AAAC801C4";
const ZAPI_CLIENT_TOKEN = "F5c1b8f27f6b049c98c4e779d00f67552S";

async function fetchRealZapiAdriana() {
  console.log("📡 Consultando a API da Z-API para pegar os áudios e mensagens REAIS do WhatsApp da Adriana...");

  const phone = "554196627244";
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/chat-messages/${phone}`;

  try {
    const res = await fetch(url, {
      headers: {
        "Client-Token": ZAPI_CLIENT_TOKEN
      }
    });

    console.log("Status da API Z-API:", res.status);
    const data = await res.json();
    console.log("Mensagens trazidas da Z-API:", Array.isArray(data) ? data.length : data);

    if (Array.isArray(data)) {
      data.forEach((m, idx) => {
        console.log(`\n--- Mensagem #${idx + 1} ---`);
        console.log(`ID: ${m.zaapId || m.id} | FromMe: ${m.fromMe} | Type: ${m.type || m.messageType}`);
        console.log(`Text: ${m.text?.message || m.message || m.caption || m.body}`);
        console.log(`Audio URL: ${m.audio?.audioUrl || m.audio?.url || m.ptt?.audioUrl || m.audio}`);
      });
    }
  } catch (err) {
    console.error("Erro ao buscar Z-API:", err);
  }
}

fetchRealZapiAdriana();
