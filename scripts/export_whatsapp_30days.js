const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID || "3F1993DFB59E83474F059E648AE68DF9";
const ZAPI_TOKEN = process.env.ZAPI_TOKEN || "81087A6B5C1CAB8AAAC801C4";
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN || "F5c1b8f27f6b049c98c4e779d00f67552S";

const ZAPI_HEADERS = {
  "Content-Type": "application/json",
  "Client-Token": ZAPI_CLIENT_TOKEN
};

// Data limite: 30 dias atrás
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const BASE_DIR = path.join(__dirname, '..', 'whatsapp_export_30_dias');
const CONVERSAS_DIR = path.join(BASE_DIR, 'conversas');
const GRUPOS_DIR = path.join(BASE_DIR, 'grupos');
const MIDIAS_GERAIS_DIR = path.join(BASE_DIR, 'midias_gerais');

// Helper para sanitizar nomes de arquivos e pastas
function sanitizeName(name) {
  if (!name) return 'sem_nome';
  return name.toString()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .trim();
}

// Helper para baixar mídia via HTTP/HTTPS
async function downloadFile(url, targetPath) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
  
  if (fs.existsSync(targetPath)) {
    return targetPath; // já baixado
  }

  return new Promise((resolve) => {
    try {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          if (res.headers.location) {
            return downloadFile(res.headers.location, targetPath).then(resolve);
          }
        }
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }

        const fileStream = fs.createWriteStream(targetPath);
        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          resolve(targetPath);
        });

        fileStream.on('error', (err) => {
          fs.unlink(targetPath, () => {});
          resolve(null);
        });
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

// Extensão sugerida por tipo de mídia ou mime
function getExtension(mimeType, mediaType, originalName, url) {
  if (originalName && originalName.includes('.')) {
    const ext = path.extname(originalName);
    if (ext.length <= 5) return ext;
  }
  if (mimeType) {
    if (mimeType.includes('pdf')) return '.pdf';
    if (mimeType.includes('png')) return '.png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return '.jpg';
    if (mimeType.includes('ogg')) return '.ogg';
    if (mimeType.includes('opus')) return '.opus';
    if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return '.mp3';
    if (mimeType.includes('mp4')) return '.mp4';
    if (mimeType.includes('webp')) return '.webp';
  }
  if (url) {
    const cleanUrl = url.split('?')[0];
    const ext = path.extname(cleanUrl);
    if (ext && ext.length <= 5) return ext;
  }
  if (mediaType === 'AUDIO') return '.ogg';
  if (mediaType === 'IMAGE') return '.jpg';
  if (mediaType === 'VIDEO') return '.mp4';
  if (mediaType === 'DOCUMENT') return '.pdf';
  return '.bin';
}

async function fetchZapiApi(endpoint) {
  try {
    const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/${endpoint}`;
    const res = await fetch(url, { headers: ZAPI_HEADERS, next: { revalidate: 0 } });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error(`[Z-API Fetch Error - ${endpoint}]:`, e.message);
    return null;
  }
}

async function runExport() {
  console.log("=================================================");
  console.log("🚀 INICIANDO EXPORTAÇÃO HISTÓRICO WHATSAPP (30 DIAS)");
  console.log(`📅 Período: ${thirtyDaysAgo.toISOString().split('T')[0]} até ${new Date().toISOString().split('T')[0]}`);
  console.log("=================================================\n");

  // Preparar pastas
  if (fs.existsSync(BASE_DIR)) {
    fs.rmSync(BASE_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(CONVERSAS_DIR, { recursive: true });
  fs.mkdirSync(GRUPOS_DIR, { recursive: true });
  fs.mkdirSync(MIDIAS_GERAIS_DIR, { recursive: true });

  // 1. Buscar Grupos via Z-API
  console.log("🔍 [1/6] Buscando grupos de WhatsApp via Z-API...");
  const zapiGroups = await fetchZapiApi("groups") || [];
  const detailedGroups = [];

  for (const g of zapiGroups) {
    const phone = g.phone;
    const metadata = await fetchZapiApi(`group-metadata/${phone}`) || {};
    detailedGroups.push({
      phone: g.phone,
      name: g.name || metadata.subject || "Grupo Sem Nome",
      description: metadata.description || "",
      owner: metadata.owner || "",
      participantsCount: metadata.participants ? metadata.participants.length : 0,
      participants: metadata.participants || [],
      lastMessageTime: g.lastMessageTime ? new Date(Number(g.lastMessageTime)) : null,
      isGroup: true
    });
  }

  fs.writeFileSync(
    path.join(GRUPOS_DIR, 'lista_grupos.json'),
    JSON.stringify(detailedGroups, null, 2),
    'utf-8'
  );
  console.log(`✅ ${detailedGroups.length} grupos de WhatsApp catalogados.`);

  // 2. Buscar Chats via Z-API
  console.log("🔍 [2/6] Buscando lista de conversas ativas via Z-API...");
  const zapiChats = await fetchZapiApi("chats?page=1&pageSize=100") || [];
  console.log(`✅ ${zapiChats.length} chats obtidos da API Z-API.`);

  // 3. Buscar mensagens de HR tickets no Banco de Dados dos últimos 30 dias
  console.log("🔍 [3/6] Extraindo mensagens de Atendimento RH dos últimos 30 dias no BD...");
  const hrTickets = await prisma.hrTicket.findMany({
    include: {
      messages: {
        where: { createdAt: { gte: thirtyDaysAgo } },
        orderBy: { createdAt: 'asc' }
      },
      employee: true
    }
  });

  // 4. Buscar mensagens de Candidatos Recrutamento dos últimos 30 dias
  console.log("🔍 [4/6] Extraindo mensagens de Candidatos/Recrutamento dos últimos 30 dias no BD...");
  const recruitmentMessages = await prisma.recruitmentWhatsAppMessage.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    include: { candidate: true },
    orderBy: { createdAt: 'asc' }
  });

  // Agrupar todas as conversas por chave (Telefone / Grupo)
  const conversationMap = new Map();

  // Processar Grupos do Z-API
  for (const group of detailedGroups) {
    const key = group.phone;
    conversationMap.set(key, {
      id: key,
      isGroup: true,
      name: group.name,
      phone: group.phone,
      photoUrl: null,
      description: group.description,
      participants: group.participants,
      messages: []
    });
  }

  // Processar Tickets de RH
  for (const t of hrTickets) {
    const key = t.contactPhone;
    if (!key) continue;

    if (!conversationMap.has(key)) {
      conversationMap.set(key, {
        id: key,
        isGroup: false,
        name: t.contactName || (t.employee ? t.employee.name : `Contato ${key}`),
        phone: key,
        photoUrl: t.contactPhotoUrl,
        employee: t.employee ? { name: t.employee.name, cpf: t.employee.cpf, role: t.employee.role } : null,
        messages: []
      });
    }

    const conv = conversationMap.get(key);
    for (const m of t.messages) {
      conv.messages.push({
        id: m.id,
        senderType: m.senderType,
        senderName: m.senderName || (m.senderType === 'ATTENDANT' ? 'Atendente RH' : conv.name),
        messageType: m.messageType,
        content: m.content,
        mediaUrl: m.mediaUrl,
        mediaFileName: m.mediaFileName,
        mediaMimeType: m.mediaMimeType,
        createdAt: m.createdAt,
        zapiMessageId: m.zapiMessageId
      });
    }
  }

  // Processar Mensagens de Recrutamento
  for (const rm of recruitmentMessages) {
    const key = rm.candidate?.phone || `candidato_${rm.candidateId}`;
    if (!conversationMap.has(key)) {
      conversationMap.set(key, {
        id: key,
        isGroup: false,
        name: rm.candidate?.name || `Candidato ${key}`,
        phone: key,
        photoUrl: null,
        candidate: rm.candidate ? { name: rm.candidate.name, email: rm.candidate.email, vacancy: rm.candidate.vacancyTitle } : null,
        messages: []
      });
    }

    const conv = conversationMap.get(key);
    conv.messages.push({
      id: rm.id,
      senderType: rm.senderType,
      senderName: rm.senderName || (rm.senderType === 'RECRUITER' ? 'Recrutador' : conv.name),
      messageType: rm.messageType,
      content: rm.content,
      mediaUrl: rm.mediaUrl,
      mediaFileName: rm.mediaFileName,
      mediaMimeType: rm.mediaMimeType,
      createdAt: rm.createdAt,
      zapiMessageId: rm.zapiMessageId
    });
  }

  // Adicionar conversas do Z-API que não tenham tickets de BD ainda
  for (const zc of zapiChats) {
    const key = zc.phone;
    if (!key) continue;
    if (!conversationMap.has(key)) {
      conversationMap.set(key, {
        id: key,
        isGroup: zc.isGroup || key.includes('group'),
        name: zc.name || `Conversa ${key}`,
        phone: key,
        photoUrl: null,
        messages: []
      });
    }
  }

  // Ordenar mensagens de cada conversa por data e remover duplicatas por ID/content+date
  let totalDownloadedFiles = 0;
  let totalAudioFiles = 0;
  let totalDocFiles = 0;
  let totalImageFiles = 0;
  let totalMessagesProcessed = 0;

  console.log(`\n📥 [5/6] Baixando mídias, áudios e gerando transcrições para ${conversationMap.size} conversas/grupos...`);

  const conversationsList = [];

  for (const [key, conv] of conversationMap.entries()) {
    // Dedup mensagens
    const msgSeen = new Set();
    const uniqueMsgs = [];
    for (const m of conv.messages) {
      const msgKey = m.id || `${m.senderName}_${m.content}_${new Date(m.createdAt).getTime()}`;
      if (!msgSeen.has(msgKey)) {
        msgSeen.add(msgKey);
        uniqueMsgs.push(m);
      }
    }
    uniqueMsgs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    conv.messages = uniqueMsgs;
    totalMessagesProcessed += uniqueMsgs.length;

    // Nome da pasta da conversa
    const folderPrefix = conv.isGroup ? 'Grupo_' : '';
    const safeFolderName = `${folderPrefix}${sanitizeName(conv.name)}_${sanitizeName(conv.phone.slice(-10))}`;
    const convDir = path.join(CONVERSAS_DIR, safeFolderName);
    const audiosDir = path.join(convDir, 'audios');
    const imagensDir = path.join(convDir, 'imagens');
    const documentosDir = path.join(convDir, 'documentos');

    fs.mkdirSync(convDir, { recursive: true });

    let txtContent = `======================================================\n`;
    txtContent += `HISTÓRICO WHATSAPP (ÚLTIMOS 30 DIAS)\n`;
    txtContent += `Nome/Contato: ${conv.name}\n`;
    txtContent += `Telefone/ID: ${conv.phone}\n`;
    txtContent += `Tipo: ${conv.isGroup ? 'Grupo de WhatsApp' : 'Conversa Individual'}\n`;
    txtContent += `Total de Mensagens no Período: ${conv.messages.length}\n`;
    txtContent += `Exportado em: ${new Date().toLocaleString('pt-BR')}\n`;
    txtContent += `======================================================\n\n`;

    let htmlMessagesList = '';

    for (let i = 0; i < conv.messages.length; i++) {
      const m = conv.messages[i];
      const msgDate = new Date(m.createdAt).toLocaleString('pt-BR');
      let mediaRelPath = null;

      if (m.mediaUrl) {
        const ext = getExtension(m.mediaMimeType, m.messageType, m.mediaFileName, m.mediaUrl);
        const fileName = `midia_${i + 1}_${Date.now().toString().slice(-5)}${ext}`;
        let subDir = documentosDir;
        let relFolder = 'documentos';

        if (m.messageType === 'AUDIO' || ext === '.ogg' || ext === '.opus' || ext === '.mp3') {
          subDir = audiosDir;
          relFolder = 'audios';
          totalAudioFiles++;
        } else if (m.messageType === 'IMAGE' || ext === '.jpg' || ext === '.png' || ext === '.webp') {
          subDir = imagensDir;
          relFolder = 'imagens';
          totalImageFiles++;
        } else {
          totalDocFiles++;
        }

        const localFile = path.join(subDir, fileName);
        const downloaded = await downloadFile(m.mediaUrl, localFile);
        if (downloaded) {
          mediaRelPath = `${relFolder}/${fileName}`;
          totalDownloadedFiles++;
        }
      }

      // Format Text Log
      txtContent += `[${msgDate}] ${m.senderName}: ${m.content}\n`;
      if (mediaRelPath) {
        txtContent += `   └── [Arquivo Anexo: ${mediaRelPath}]\n`;
      }
      txtContent += `\n`;

      // Format HTML Log Item
      const isOutbound = m.senderType === 'ATTENDANT' || m.senderType === 'RECRUITER';
      const bubbleClass = isOutbound ? 'msg-out' : 'msg-in';

      let mediaHtml = '';
      if (mediaRelPath) {
        if (m.messageType === 'AUDIO' || mediaRelPath.includes('audios/')) {
          mediaHtml = `<div class="media-container"><audio controls src="${mediaRelPath}"></audio></div>`;
        } else if (m.messageType === 'IMAGE' || mediaRelPath.includes('imagens/')) {
          mediaHtml = `<div class="media-container"><a href="${mediaRelPath}" target="_blank"><img src="${mediaRelPath}" class="img-preview" alt="Imagem" /></a></div>`;
        } else {
          mediaHtml = `<div class="media-container"><a href="${mediaRelPath}" download class="doc-link">📄 ${m.mediaFileName || 'Baixar Documento'}</a></div>`;
        }
      }

      htmlMessagesList += `
        <div class="msg-bubble ${bubbleClass}">
          <div class="msg-sender">${m.senderName}</div>
          <div class="msg-text">${escapeHtml(m.content)}</div>
          ${mediaHtml}
          <div class="msg-time">${msgDate}</div>
        </div>
      `;
    }

    // Salvar conversa.txt
    fs.writeFileSync(path.join(convDir, 'conversa.txt'), txtContent, 'utf-8');

    // Salvar conversa.html
    const conversaHtml = generateConversaHtmlPage(conv.name, conv.phone, conv.isGroup, htmlMessagesList);
    fs.writeFileSync(path.join(convDir, 'conversa.html'), conversaHtml, 'utf-8');

    conversationsList.push({
      id: key,
      name: conv.name,
      phone: conv.phone,
      isGroup: conv.isGroup,
      folder: safeFolderName,
      messageCount: conv.messages.length,
      lastMessageDate: conv.messages.length > 0 ? conv.messages[conv.messages.length - 1].createdAt : null
    });
  }

  // 5. Gerar Painel HTML Master Interativo (index.html)
  console.log("🎨 [6/6] Gerando Dashboard HTML Interativo (index.html) e relatórios...");
  const masterHtml = generateMasterDashboardHtml(conversationsList, totalMessagesProcessed, totalDownloadedFiles, totalAudioFiles, totalImageFiles, totalDocFiles);
  fs.writeFileSync(path.join(BASE_DIR, 'index.html'), masterHtml, 'utf-8');

  // Gerar RESUMO_EXPORTACAO.md
  const markdownSummary = `
# 📊 Relatório de Exportação do WhatsApp — Últimos 30 Dias

**Data da Exportação:** ${new Date().toLocaleString('pt-BR')}  
**Período:** ${thirtyDaysAgo.toLocaleDateString('pt-BR')} até ${new Date().toLocaleDateString('pt-BR')}  
**Instância Z-API:** \`${ZAPI_INSTANCE_ID}\`

---

## 📈 Resumo Geral das Estatísticas

| Métrica | Total |
|---|---|
| **Total de Conversas e Grupos Catalogados** | **${conversationsList.length}** |
| **Grupos do WhatsApp** | **${detailedGroups.length}** |
| **Total de Mensagens Processadas** | **${totalMessagesProcessed}** |
| **Arquivos de Mídia Baixados** | **${totalDownloadedFiles}** |
| **Mensagens de Áudio (Notas de Voz / OGG / MP3)** | **${totalAudioFiles}** |
| **Imagens (Fotos / Anexos Visual)** | **${totalImageFiles}** |
| **Documentos (PDFs / Currículos / Arquivos)** | **${totalDocFiles}** |

---

## 📋 Grupos do WhatsApp Identificados (${detailedGroups.length})

${detailedGroups.map(g => `- **${g.name}** (\`${g.phone}\`) — ${g.participantsCount} participantes`).join('\n')}

---

## 📁 Estrutura de Arquivos Criados

- \`index.html\`: **Painel Interativo em HTML** para buscar conversas, ouvir áudios e ver fotos direto no navegador.
- \`conversas/\`: Pastas individuais para cada contato e grupo contendo \`conversa.txt\`, \`conversa.html\` e subpastas de mídias.
- \`grupos/lista_grupos.json\`: Detalhes completos e integrantes dos grupos de WhatsApp.

`;

  fs.writeFileSync(path.join(BASE_DIR, 'RESUMO_EXPORTACAO.md'), markdownSummary, 'utf-8');

  fs.writeFileSync(
    path.join(BASE_DIR, 'RESUMO_EXPORTACAO.json'),
    JSON.stringify({
      exportDate: new Date().toISOString(),
      periodStart: thirtyDaysAgo.toISOString(),
      periodEnd: new Date().toISOString(),
      totalConversations: conversationsList.length,
      totalGroups: detailedGroups.length,
      totalMessages: totalMessagesProcessed,
      mediaStats: {
        totalDownloadedFiles,
        totalAudioFiles,
        totalImageFiles,
        totalDocFiles
      },
      conversations: conversationsList,
      groups: detailedGroups
    }, null, 2),
    'utf-8'
  );

  // Compactar em ZIP
  const zipPath = path.join(__dirname, '..', 'whatsapp_export_30_dias.zip');
  console.log(`\n📦 Compactando tudo em arquivo ZIP: ${zipPath}...`);
  try {
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
    execSync(`zip -r "${zipPath}" whatsapp_export_30_dias`, { cwd: path.join(__dirname, '..') });
    console.log(`✅ Arquivo ZIP gerado com sucesso! (${(fs.statSync(zipPath).size / 1024 / 1024).toFixed(2)} MB)`);
  } catch (err) {
    console.error("⚠️ Não foi possível rodar o comando zip, mas a pasta descompactada está intacta.", err.message);
  }

  console.log("\n=================================================");
  console.log("🎉 EXPORTAÇÃO CONCLUÍDA COM SUCESSO!");
  console.log(`📁 Pasta local: ${BASE_DIR}`);
  console.log(`📦 Arquivo ZIP: ${zipPath}`);
  console.log("=================================================");

  await prisma.$disconnect();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateConversaHtmlPage(name, phone, isGroup, messagesHtml) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Conversa - ${escapeHtml(name)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #0b141a; color: #e9edef; margin: 0; padding: 20px; }
    .chat-container { max-width: 800px; margin: 0 auto; background-color: #111b21; border-radius: 12px; padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
    .chat-header { border-bottom: 1px solid #222d34; padding-bottom: 15px; margin-bottom: 20px; }
    .chat-title { font-size: 20px; font-weight: bold; color: #25d366; margin: 0 0 5px 0; }
    .chat-subtitle { font-size: 13px; color: #8696a0; }
    .msg-bubble { margin-bottom: 15px; max-width: 75%; padding: 10px 14px; border-radius: 8px; position: relative; font-size: 14px; line-height: 1.4; word-wrap: break-word; }
    .msg-in { background-color: #202c33; align-self: flex-start; margin-right: auto; border-top-left-radius: 0; }
    .msg-out { background-color: #005c4b; align-self: flex-end; margin-left: auto; border-top-right-radius: 0; }
    .msg-sender { font-size: 11px; font-weight: bold; color: #53bdeb; margin-bottom: 4px; }
    .msg-text { white-space: pre-wrap; }
    .msg-time { font-size: 10px; color: #8696a0; text-align: right; margin-top: 6px; }
    .media-container { margin-top: 8px; }
    audio { width: 100%; border-radius: 20px; outline: none; }
    .img-preview { max-width: 100%; max-height: 300px; border-radius: 8px; margin-top: 5px; }
    .doc-link { display: inline-block; background-color: rgba(255,255,255,0.1); color: #25d366; text-decoration: none; padding: 8px 12px; border-radius: 6px; font-weight: bold; }
    .doc-link:hover { background-color: rgba(255,255,255,0.2); }
  </style>
</head>
<body>
  <div class="chat-container">
    <div class="chat-header">
      <h1 class="chat-title">${escapeHtml(name)}</h1>
      <div class="chat-subtitle">${isGroup ? '👥 Grupo de WhatsApp' : '👤 Conversa Individual'} • ${escapeHtml(phone)}</div>
    </div>
    <div style="display: flex; flex-direction: column;">
      ${messagesHtml || '<p style="color:#8696a0;">Nenhuma mensagem registrada nos últimos 30 dias.</p>'}
    </div>
  </div>
</body>
</html>`;
}

function generateMasterDashboardHtml(conversations, totalMsgs, totalFiles, totalAudios, totalImages, totalDocs) {
  const convListJson = JSON.stringify(conversations);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp Export Hub — Últimos 30 Dias</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #0b141a; color: #e9edef; display: flex; height: 100vh; overflow: hidden; }
    
    .sidebar { width: 340px; background-color: #111b21; border-right: 1px solid #222d34; display: flex; flex-direction: column; }
    .header { padding: 16px; background-color: #202c33; border-bottom: 1px solid #222d34; }
    .header h2 { font-size: 18px; color: #25d366; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
    .search-box { padding: 10px 16px; background-color: #111b21; }
    .search-input { width: 100%; padding: 10px 14px; background-color: #202c33; border: 1px solid #222d34; border-radius: 8px; color: #e9edef; font-size: 14px; outline: none; }
    .search-input:focus { border-color: #25d366; }
    
    .stats-bar { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; padding: 12px 16px; background-color: #182229; border-bottom: 1px solid #222d34; font-size: 12px; color: #8696a0; }
    .stat-card { background: #202c33; padding: 8px 10px; border-radius: 6px; text-align: center; }
    .stat-card strong { font-size: 16px; color: #25d366; display: block; }

    .conv-list { flex: 1; overflow-y: auto; }
    .conv-item { padding: 14px 16px; border-bottom: 1px solid #1f2c34; cursor: pointer; transition: background 0.2s; display: flex; flex-direction: column; gap: 4px; }
    .conv-item:hover, .conv-item.active { background-color: #2a3942; }
    .conv-name { font-size: 15px; font-weight: 600; color: #e9edef; display: flex; justify-content: space-between; align-items: center; }
    .conv-badge { font-size: 11px; padding: 2px 6px; border-radius: 10px; background: #202c33; color: #8696a0; }
    .conv-badge.group { background: #005c4b; color: #25d366; }
    .conv-sub { font-size: 13px; color: #8696a0; display: flex; justify-content: space-between; }

    .main-content { flex: 1; display: flex; flex-direction: column; background-color: #0b141a; }
    iframe { width: 100%; height: 100%; border: none; }
    .welcome-screen { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #8696a0; text-align: center; padding: 40px; }
    .welcome-screen h1 { font-size: 28px; color: #e9edef; margin-bottom: 12px; }
    .welcome-screen p { font-size: 15px; max-width: 500px; line-height: 1.5; margin-bottom: 24px; }
    .welcome-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; width: 100%; max-width: 600px; }
    .welcome-card { background: #111b21; padding: 16px; border-radius: 10px; border: 1px solid #222d34; }
    .welcome-card font { font-size: 24px; display: block; margin-bottom: 6px; }
  </style>
</head>
<body>

  <div class="sidebar">
    <div class="header">
      <h2>📱 WhatsApp 30 Dias</h2>
      <div style="font-size: 12px; color: #8696a0;">Histórico do Sistema & Z-API</div>
    </div>
    
    <div class="stats-bar">
      <div class="stat-card"><strong>${conversations.length}</strong> Conversas</div>
      <div class="stat-card"><strong>${totalMsgs}</strong> Mensagens</div>
      <div class="stat-card"><strong>${totalAudios}</strong> Áudios</div>
      <div class="stat-card"><strong>${totalFiles}</strong> Anexos</div>
    </div>

    <div class="search-box">
      <input type="text" id="searchInput" class="search-input" placeholder="🔍 Buscar contato ou grupo..." oninput="filterConversations()" />
    </div>

    <div class="conv-list" id="convList"></div>
  </div>

  <div class="main-content">
    <div id="welcomeScreen" class="welcome-screen">
      <h1>🚀 Exportação WhatsApp Concluída</h1>
      <p>Selecione uma conversa ou grupo na lista à esquerda para visualizar o histórico de mensagens, ouvir áudios e abrir anexos.</p>
      
      <div class="welcome-grid">
        <div class="welcome-card">
          <font>🎙️</font>
          <strong>${totalAudios} Áudios</strong>
          <div style="font-size: 12px; color: #8696a0; margin-top: 4px;">Notas de voz salvas</div>
        </div>
        <div class="welcome-card">
          <font>🖼️</font>
          <strong>${totalImages} Fotos</strong>
          <div style="font-size: 12px; color: #8696a0; margin-top: 4px;">Imagens e anexos</div>
        </div>
        <div class="welcome-card">
          <font>📎</font>
          <strong>${totalDocs} Arquivos</strong>
          <div style="font-size: 12px; color: #8696a0; margin-top: 4px;">PDFs e documentos</div>
        </div>
      </div>
    </div>

    <iframe id="chatIframe" style="display: none;"></iframe>
  </div>

  <script>
    const conversations = ${convListJson};

    function renderList(list) {
      const container = document.getElementById('convList');
      container.innerHTML = '';

      if (list.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #8696a0; font-size: 13px;">Nenhuma conversa encontrada</div>';
        return;
      }

      list.forEach(c => {
        const item = document.createElement('div');
        item.className = 'conv-item';
        item.onclick = () => openChat(c, item);

        item.innerHTML = \`
          <div class="conv-name">
            <span>\${escapeHtml(c.name)}</span>
            <span class="conv-badge \${c.isGroup ? 'group' : ''}">\${c.isGroup ? 'Grupo' : 'Chat'}</span>
          </div>
          <div class="conv-sub">
            <span>\${c.phone}</span>
            <span>\${c.messageCount} msgs</span>
          </div>
        \`;
        container.appendChild(item);
      });
    }

    function openChat(c, el) {
      document.querySelectorAll('.conv-item').forEach(i => i.classList.remove('active'));
      if (el) el.classList.add('active');

      document.getElementById('welcomeScreen').style.display = 'none';
      const iframe = document.getElementById('chatIframe');
      iframe.style.display = 'block';
      iframe.src = \`conversas/\${c.folder}/conversa.html\`;
    }

    function filterConversations() {
      const query = document.getElementById('searchInput').value.toLowerCase().trim();
      const filtered = conversations.filter(c => 
        c.name.toLowerCase().includes(query) || 
        c.phone.includes(query)
      );
      renderList(filtered);
    }

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    renderList(conversations);
  </script>
</body>
</html>`;
}

runExport().catch(err => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
