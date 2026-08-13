/**
 * SCRIPT DE EXTRAÇÃO E IMPORTAÇÃO DO WHATSAPP WEB
 * Execute este script no Console (F12) do Chrome Beta na aba do web.whatsapp.com
 */
(async function syncWhatsAppWebToSystem() {
  console.log("🚀 Iniciando extração e envio do histórico do WhatsApp Web...");

  const SYSTEM_ENDPOINT = "https://workforce-hub-henna.vercel.app/api/whatsapp/import-history";

  // Obter chats do WhatsApp Web DOM / State
  let storeChats = [];
  try {
    if (window.Store && window.Store.Chat) {
      storeChats = window.Store.Chat.getModelsArray();
    }
  } catch (e) {}

  if (storeChats.length > 0) {
    console.log(`📋 Encontradas ${storeChats.length} conversas na memória do WhatsApp Web!`);
    let totalSynced = 0;

    for (const chat of storeChats) {
      try {
        const phone = chat.id._serialized || chat.id.user || "";
        const contactName = chat.name || chat.formattedTitle || phone;
        const msgs = chat.msgs ? chat.msgs.getModelsArray() : [];

        if (msgs.length === 0) continue;

        const payloadMsgs = msgs.map(m => ({
          senderType: m.id.fromMe ? "ATTENDANT" : "EMPLOYEE",
          senderName: m.id.fromMe ? "Atendente RH" : (m.sender?.pushname || contactName),
          content: m.body || m.caption || (m.type === "image" ? "📷 Imagem" : m.type === "document" ? "📎 Documento" : "Mensagem"),
          messageType: m.type === "image" ? "IMAGE" : m.type === "document" ? "DOCUMENT" : m.type === "audio" || m.type === "ptt" ? "AUDIO" : "TEXT",
          createdAt: new Date(m.t * 1000).toISOString()
        }));

        const res = await fetch(SYSTEM_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone,
            contactName,
            isGroup: chat.isGroup || false,
            messages: payloadMsgs
          })
        });

        if (res.ok) {
          totalSynced++;
        }
      } catch (err) {
        console.error("Erro ao sincronizar chat:", err);
      }
    }

    console.log(`🎉 CONCLUÍDO! ${totalSynced} conversas sincronizadas com o banco de dados do sistema!`);
  } else {
    console.log("ℹ️ Injetando extrator por varredura de DOM...");
    // Fallback: Varredura de DOM do WhatsApp Web
    const chatElements = document.querySelectorAll('div[role="listitem"]');
    console.log(`Encontrados ${chatElements.length} chats visíveis na tela.`);
  }
})();
