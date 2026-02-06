// api/webhook.js
export const config = {
  runtime: 'edge',
};

const CONFIG = {
  TELEGRAM_BOT_TOKEN: '8338672395:AAH9rbys9zjy-BthubvXyVv2Rr_d_Pr_kiI',
  TELEGRAM_CHAT_ID: '8439448087',
  JSONBIN_BIN_ID: '69859afad0ea881f40a4e526',
  JSONBIN_MASTER_KEY: '$2a$10$DeNPX1R0C0PjshDJf/w1d.9wc8fHLNB0bAGBwXmrnsMCvSVTt/vga'
};

async function updateJsonBin(phone, action) {
  const getRes = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.JSONBIN_BIN_ID}/latest`, {
    headers: { 'X-Master-Key': CONFIG.JSONBIN_MASTER_KEY }
  });
  
  if (!getRes.ok) throw new Error('获取数据失败');
  
  const { record } = await getRes.json();
  
  if (!record.allowed_phones) record.allowed_phones = [];
  if (!record.rejected_phones) record.rejected_phones = [];
  
  if (action === '通过') {
    if (!record.allowed_phones.includes(phone)) {
      record.allowed_phones.push(phone);
    }
    record.rejected_phones = record.rejected_phones.filter(p => p !== phone);
  } else if (action === '拒绝') {
    if (!record.rejected_phones.includes(phone)) {
      record.rejected_phones.push(phone);
    }
    record.allowed_phones = record.allowed_phones.filter(p => p !== phone);
  }
  
  const putRes = await fetch(`https://api.jsonbin.io/v3/b/${CONFIG.JSONBIN_BIN_ID}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': CONFIG.JSONBIN_MASTER_KEY
    },
    body: JSON.stringify(record)
  });
  
  if (!putRes.ok) throw new Error('更新数据失败');
  return true;
}

async function sendTelegramMessage(text) {
  await fetch(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CONFIG.TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'HTML'
    })
  });
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const update = await request.json();
    
    if (!update.message || !update.message.text) {
      return new Response('OK');
    }
    
    const text = update.message.text.trim();
    const chatId = update.message.chat.id.toString();
    
    if (chatId !== CONFIG.TELEGRAM_CHAT_ID) {
      return new Response('Unauthorized');
    }
    
    const match = text.match(/^(通过|拒绝)\s*(1[3-9]\d{9})$/);
    if (!match) {
      return new Response('OK');
    }
    
    const action = match[1];
    const phone = match[2];
    
    await updateJsonBin(phone, action);
    await sendTelegramMessage(
      `✅ <b>审核${action}成功</b>\n\n` +
      `手机号：${phone}\n` +
      `操作：${action}\n` +
      `时间：${new Date().toLocaleString('zh-CN')}\n\n` +
      `用户页面将自动更新状态`
    );
    
    return new Response('OK');
  } catch (err) {
    console.error('Error:', err);
    return new Response('Error', { status: 500 });
  }
}

