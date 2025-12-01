/**
 * Bot de Telegram - Sistema de Tesorería Grande State
 * Desarrollado por Paulo Famá
 * 
 * Comandos disponibles:
 * /start - Iniciar y registrar usuario
 * /cartera - Total en cartera
 * /hoy - Cheques que vencen hoy
 * /manana - Cheques que vencen mañana
 * /semana - Cheques próximos 7 días
 * /saldos - Saldos de tesorería
 * /alertas - Alertas críticas
 * /cuit XXXXX - Consultar CUIT específico
 * /resumen - Resumen ejecutivo completo
 * /ayuda - Lista de comandos
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const supabase = require('./supabaseClient');

// Token del bot
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ Error: Variable TELEGRAM_BOT_TOKEN no configurada');
  process.exit(1);
}

// Crear instancia del bot
const bot = new TelegramBot(token, { polling: true });

// Almacén de usuarios autorizados (chatId -> email)
const usuariosAutorizados = new Map();

console.log('🤖 Bot de Tesorería Grande State iniciado...');

// ============================================================
// FUNCIONES DE UTILIDAD
// ============================================================

/**
 * Formatear moneda en pesos argentinos
 */
function formatearMoneda(valor) {
  if (valor === null || valor === undefined) return '$0,00';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(valor);
}

/**
 * Formatear fecha
 */
function formatearFecha(fecha) {
  if (!fecha) return 'N/A';
  return new Date(fecha).toLocaleDateString('es-AR');
}

/**
 * Verificar si un usuario está autorizado
 */
async function verificarAutorizacion(chatId) {
  // Si ya está en el Map, está autorizado
  if (usuariosAutorizados.has(chatId)) {
    return true;
  }
  return false;
}

/**
 * Obtener fecha de hoy en formato UTC (inicio del día)
 */
function getHoyUTC() {
  const hoy = new Date();
  return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()));
}

/**
 * Obtener fecha de mañana en formato UTC
 */
function getMananaUTC() {
  const hoy = new Date();
  return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate() + 1));
}

// ============================================================
// COMANDO /start - REGISTRO DE USUARIO
// ============================================================

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (usuariosAutorizados.has(chatId)) {
    bot.sendMessage(chatId, 
      `✅ Ya estás registrado.\n\n` +
      `Usá /ayuda para ver los comandos disponibles.`
    );
    return;
  }
  
  bot.sendMessage(chatId, 
    `🏦 *Bot de Tesorería - Grande State*\n\n` +
    `Para usar este bot necesitás estar autorizado.\n\n` +
    `Por favor, ingresá tu email corporativo:`,
    { parse_mode: 'Markdown' }
  );
});

// ============================================================
// MANEJO DE MENSAJES (para capturar email)
// ============================================================

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const texto = msg.text;
  
  // Ignorar comandos
  if (texto && texto.startsWith('/')) return;
  
  // Si el usuario no está autorizado y envía un texto, verificar si es email
  if (!usuariosAutorizados.has(chatId) && texto && texto.includes('@')) {
    const email = texto.toLowerCase().trim();
    
    // Verificar en allowed_users
    const { data, error } = await supabase
      .from('allowed_users')
      .select('email, role')
      .eq('email', email)
      .single();
    
    if (error || !data) {
      bot.sendMessage(chatId, 
        `❌ Email no autorizado.\n\n` +
        `El email *${email}* no está en la lista de usuarios permitidos.\n\n` +
        `Contactá al administrador.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // Registrar usuario
    usuariosAutorizados.set(chatId, { email: data.email, role: data.role });
    
    bot.sendMessage(chatId, 
      `✅ *¡Registro exitoso!*\n\n` +
      `Bienvenido/a al Bot de Tesorería.\n` +
      `Email: ${data.email}\n` +
      `Rol: ${data.role}\n\n` +
      `Usá /ayuda para ver los comandos disponibles.`,
      { parse_mode: 'Markdown' }
    );
  }
});

// ============================================================
// COMANDO /ayuda - LISTA DE COMANDOS
// ============================================================

bot.onText(/\/ayuda/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (!await verificarAutorizacion(chatId)) {
    bot.sendMessage(chatId, '⚠️ No estás autorizado. Usá /start para registrarte.');
    return;
  }
  
  bot.sendMessage(chatId, 
    `📋 *Comandos Disponibles*\n\n` +
    `💰 /cartera - Total en cartera\n` +
    `📅 /hoy - Cheques que vencen hoy\n` +
    `📅 /manana - Cheques que vencen mañana\n` +
    `📅 /semana - Próximos 7 días\n` +
    `🏦 /saldos - Saldos de tesorería\n` +
    `⚠️ /alertas - Alertas críticas\n` +
    `🔍 /cuit [número] - Consultar CUIT\n` +
    `📊 /resumen - Resumen ejecutivo\n` +
    `❓ /ayuda - Esta ayuda`,
    { parse_mode: 'Markdown' }
  );
});

// ============================================================
// COMANDO /cartera - TOTAL EN CARTERA
// ============================================================

bot.onText(/\/cartera/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (!await verificarAutorizacion(chatId)) {
    bot.sendMessage(chatId, '⚠️ No estás autorizado. Usá /start para registrarte.');
    return;
  }
  
  try {
    // Obtener cheques en cartera (sin fecha de salida/entrega)
    const { data: cheques, error } = await supabase
      .from('cheques_valores')
      .select('*')
      .is('fecden', null);
    
    if (error) throw error;
    
    const totalMonto = cheques.reduce((sum, c) => sum + (c.implocal || 0), 0);
    const cantidad = cheques.length;
    
    // Separar por empresa
    const grandEstate = cheques.filter(c => c.empresa === 'GRAND_ESTATE');
    const picoDeOro = cheques.filter(c => c.empresa === 'PICO_DE_ORO');
    
    const montoGE = grandEstate.reduce((sum, c) => sum + (c.implocal || 0), 0);
    const montoPO = picoDeOro.reduce((sum, c) => sum + (c.implocal || 0), 0);
    
    bot.sendMessage(chatId, 
      `💰 *CARTERA DE CHEQUES*\n\n` +
      `📊 *Total:* ${formatearMoneda(totalMonto)}\n` +
      `📋 *Cantidad:* ${cantidad} cheques\n\n` +
      `🏢 *Por Empresa:*\n` +
      `• Grand Estate: ${formatearMoneda(montoGE)} (${grandEstate.length})\n` +
      `• Pico de Oro: ${formatearMoneda(montoPO)} (${picoDeOro.length})\n\n` +
      `⏰ ${new Date().toLocaleString('es-AR')}`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error('Error en /cartera:', error);
    bot.sendMessage(chatId, '❌ Error al obtener datos de cartera.');
  }
});

// ============================================================
// COMANDO /hoy - CHEQUES QUE VENCEN HOY
// ============================================================

bot.onText(/\/hoy/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (!await verificarAutorizacion(chatId)) {
    bot.sendMessage(chatId, '⚠️ No estás autorizado. Usá /start para registrarte.');
    return;
  }
  
  try {
    const hoy = getHoyUTC();
    const hoyStr = hoy.toISOString().split('T')[0];
    
    const { data: cheques, error } = await supabase
      .from('cheques_valores')
      .select('*')
      .is('fecden', null)
      .gte('fvto', hoyStr)
      .lt('fvto', new Date(hoy.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    
    if (error) throw error;
    
    if (cheques.length === 0) {
      bot.sendMessage(chatId, 
        `📅 *VENCIMIENTOS HOY*\n\n` +
        `✅ No hay cheques que venzan hoy.\n\n` +
        `⏰ ${new Date().toLocaleString('es-AR')}`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    const totalMonto = cheques.reduce((sum, c) => sum + (c.implocal || 0), 0);
    
    let detalle = cheques.slice(0, 5).map(c => 
      `• ${c.origen || 'S/N'}: ${formatearMoneda(c.implocal)}`
    ).join('\n');
    
    if (cheques.length > 5) {
      detalle += `\n... y ${cheques.length - 5} más`;
    }
    
    bot.sendMessage(chatId, 
      `📅 *VENCIMIENTOS HOY*\n\n` +
      `⚠️ *Cantidad:* ${cheques.length} cheques\n` +
      `💰 *Total:* ${formatearMoneda(totalMonto)}\n\n` +
      `📋 *Detalle:*\n${detalle}\n\n` +
      `⏰ ${new Date().toLocaleString('es-AR')}`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error('Error en /hoy:', error);
    bot.sendMessage(chatId, '❌ Error al obtener vencimientos de hoy.');
  }
});

// ============================================================
// COMANDO /manana - CHEQUES QUE VENCEN MAÑANA
// ============================================================

bot.onText(/\/manana/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (!await verificarAutorizacion(chatId)) {
    bot.sendMessage(chatId, '⚠️ No estás autorizado. Usá /start para registrarte.');
    return;
  }
  
  try {
    const manana = getMananaUTC();
    const mananaStr = manana.toISOString().split('T')[0];
    const pasadoManana = new Date(manana.getTime() + 24 * 60 * 60 * 1000);
    
    const { data: cheques, error } = await supabase
      .from('cheques_valores')
      .select('*')
      .is('fecden', null)
      .gte('fvto', mananaStr)
      .lt('fvto', pasadoManana.toISOString().split('T')[0]);
    
    if (error) throw error;
    
    if (cheques.length === 0) {
      bot.sendMessage(chatId, 
        `📅 *VENCIMIENTOS MAÑANA*\n\n` +
        `✅ No hay cheques que venzan mañana.\n\n` +
        `⏰ ${new Date().toLocaleString('es-AR')}`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    const totalMonto = cheques.reduce((sum, c) => sum + (c.implocal || 0), 0);
    
    let detalle = cheques.slice(0, 5).map(c => 
      `• ${c.origen || 'S/N'}: ${formatearMoneda(c.implocal)}`
    ).join('\n');
    
    if (cheques.length > 5) {
      detalle += `\n... y ${cheques.length - 5} más`;
    }
    
    bot.sendMessage(chatId, 
      `📅 *VENCIMIENTOS MAÑANA*\n\n` +
      `⚠️ *Cantidad:* ${cheques.length} cheques\n` +
      `💰 *Total:* ${formatearMoneda(totalMonto)}\n\n` +
      `📋 *Detalle:*\n${detalle}\n\n` +
      `⏰ ${new Date().toLocaleString('es-AR')}`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error('Error en /manana:', error);
    bot.sendMessage(chatId, '❌ Error al obtener vencimientos de mañana.');
  }
});

// ============================================================
// COMANDO /semana - CHEQUES PRÓXIMOS 7 DÍAS
// ============================================================

bot.onText(/\/semana/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (!await verificarAutorizacion(chatId)) {
    bot.sendMessage(chatId, '⚠️ No estás autorizado. Usá /start para registrarte.');
    return;
  }
  
  try {
    const hoy = getHoyUTC();
    const en7dias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const { data: cheques, error } = await supabase
      .from('cheques_valores')
      .select('*')
      .is('fecden', null)
      .gte('fvto', hoy.toISOString().split('T')[0])
      .lt('fvto', en7dias.toISOString().split('T')[0])
      .order('fvto', { ascending: true });
    
    if (error) throw error;
    
    if (cheques.length === 0) {
      bot.sendMessage(chatId, 
        `📅 *PRÓXIMOS 7 DÍAS*\n\n` +
        `✅ No hay cheques que venzan en los próximos 7 días.\n\n` +
        `⏰ ${new Date().toLocaleString('es-AR')}`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    const totalMonto = cheques.reduce((sum, c) => sum + (c.implocal || 0), 0);
    
    // Agrupar por día
    const porDia = {};
    cheques.forEach(c => {
      const fecha = c.fvto.split('T')[0];
      if (!porDia[fecha]) porDia[fecha] = { cantidad: 0, monto: 0 };
      porDia[fecha].cantidad++;
      porDia[fecha].monto += c.implocal || 0;
    });
    
    let detalle = Object.entries(porDia).map(([fecha, data]) => 
      `• ${formatearFecha(fecha)}: ${data.cantidad} cheques - ${formatearMoneda(data.monto)}`
    ).join('\n');
    
    bot.sendMessage(chatId, 
      `📅 *PRÓXIMOS 7 DÍAS*\n\n` +
      `📊 *Total:* ${cheques.length} cheques\n` +
      `💰 *Monto:* ${formatearMoneda(totalMonto)}\n\n` +
      `📋 *Por día:*\n${detalle}\n\n` +
      `⏰ ${new Date().toLocaleString('es-AR')}`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error('Error en /semana:', error);
    bot.sendMessage(chatId, '❌ Error al obtener vencimientos de la semana.');
  }
});

// ============================================================
// COMANDO /saldos - SALDOS DE TESORERÍA
// ============================================================

bot.onText(/\/saldos/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (!await verificarAutorizacion(chatId)) {
    bot.sendMessage(chatId, '⚠️ No estás autorizado. Usá /start para registrarte.');
    return;
  }
  
  try {
    const { data: saldos, error } = await supabase
      .from('saldos_contables_sync')
      .select('*')
      .order('codigo_cuenta', { ascending: true });
    
    if (error) throw error;
    
    if (!saldos || saldos.length === 0) {
      bot.sendMessage(chatId, 
        `🏦 *SALDOS DE TESORERÍA*\n\n` +
        `⚠️ No hay datos de saldos disponibles.\n` +
        `Ejecutá una sincronización desde el sistema.\n\n` +
        `⏰ ${new Date().toLocaleString('es-AR')}`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    const totalGeneral = saldos.reduce((sum, s) => sum + (s.saldo_total || 0), 0);
    
    let detalle = saldos.map(s => {
      const emoji = s.saldo_total >= 0 ? '🟢' : '🔴';
      return `${emoji} *${s.nombre_cuenta}*\n   ${formatearMoneda(s.saldo_total)}`;
    }).join('\n\n');
    
    bot.sendMessage(chatId, 
      `🏦 *SALDOS DE TESORERÍA*\n\n` +
      `${detalle}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `💰 *TOTAL:* ${formatearMoneda(totalGeneral)}\n\n` +
      `⏰ ${new Date().toLocaleString('es-AR')}`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error('Error en /saldos:', error);
    bot.sendMessage(chatId, '❌ Error al obtener saldos de tesorería.');
  }
});

// ============================================================
// COMANDO /alertas - ALERTAS CRÍTICAS
// ============================================================

bot.onText(/\/alertas/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (!await verificarAutorizacion(chatId)) {
    bot.sendMessage(chatId, '⚠️ No estás autorizado. Usá /start para registrarte.');
    return;
  }
  
  try {
    const { data: cheques, error } = await supabase
      .from('cheques_valores')
      .select('*')
      .is('fecden', null);
    
    if (error) throw error;
    
    const hoy = getHoyUTC();
    const hoyTimestamp = hoy.getTime();
    
    // 1. Cheques vencidos
    const vencidos = cheques.filter(c => {
      const fechaVto = new Date(c.fvto);
      return fechaVto < hoy;
    });
    
    // 2. Validez crítica (25-30 días post vencimiento)
    const validezCritica = cheques.filter(c => {
      const fechaVto = new Date(c.fvto);
      const diasDesdeVto = Math.floor((hoyTimestamp - fechaVto.getTime()) / (1000 * 60 * 60 * 24));
      return diasDesdeVto >= 25 && diasDesdeVto <= 30;
    });
    
    // 3. Concentración crítica (>15% en un CUIT)
    const totalCartera = cheques.reduce((sum, c) => sum + (c.implocal || 0), 0);
    const porCuit = {};
    cheques.forEach(c => {
      const cuit = c.cuitfirm || 'SIN_CUIT';
      if (!porCuit[cuit]) porCuit[cuit] = 0;
      porCuit[cuit] += c.implocal || 0;
    });
    
    const concentracionCritica = Object.entries(porCuit)
      .filter(([cuit, monto]) => (monto / totalCartera * 100) > 15)
      .length;
    
    // Construir mensaje
    let alertas = [];
    
    if (vencidos.length > 0) {
      const montoVencidos = vencidos.reduce((sum, c) => sum + (c.implocal || 0), 0);
      alertas.push(`🔴 *VENCIDOS:* ${vencidos.length} cheques\n   ${formatearMoneda(montoVencidos)}`);
    }
    
    if (validezCritica.length > 0) {
      const montoValidez = validezCritica.reduce((sum, c) => sum + (c.implocal || 0), 0);
      alertas.push(`⚠️ *VALIDEZ CRÍTICA:* ${validezCritica.length} cheques\n   ${formatearMoneda(montoValidez)}\n   ¡Próximos a perder validez!`);
    }
    
    if (concentracionCritica > 0) {
      alertas.push(`🟡 *CONCENTRACIÓN:* ${concentracionCritica} CUITs\n   Superan 15% de cartera`);
    }
    
    if (alertas.length === 0) {
      bot.sendMessage(chatId, 
        `⚠️ *ALERTAS CRÍTICAS*\n\n` +
        `✅ No hay alertas activas.\n\n` +
        `• Sin cheques vencidos\n` +
        `• Sin validez crítica\n` +
        `• Concentración normal\n\n` +
        `⏰ ${new Date().toLocaleString('es-AR')}`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    bot.sendMessage(chatId, 
      `⚠️ *ALERTAS CRÍTICAS*\n\n` +
      `${alertas.join('\n\n')}\n\n` +
      `⏰ ${new Date().toLocaleString('es-AR')}`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error('Error en /alertas:', error);
    bot.sendMessage(chatId, '❌ Error al obtener alertas.');
  }
});

// ============================================================
// COMANDO /cuit - CONSULTAR CUIT ESPECÍFICO
// ============================================================

bot.onText(/\/cuit (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  
  if (!await verificarAutorizacion(chatId)) {
    bot.sendMessage(chatId, '⚠️ No estás autorizado. Usá /start para registrarte.');
    return;
  }
  
  const cuitBuscado = match[1].replace(/[^0-9]/g, ''); // Solo números
  
  if (cuitBuscado.length < 8) {
    bot.sendMessage(chatId, '⚠️ Ingresá un CUIT válido. Ejemplo: /cuit 20123456789');
    return;
  }
  
  try {
    const { data: cheques, error } = await supabase
      .from('cheques_valores')
      .select('*')
      .like('cuitfirm', `%${cuitBuscado}%`);
    
    if (error) throw error;
    
    if (!cheques || cheques.length === 0) {
      bot.sendMessage(chatId, 
        `🔍 *CONSULTA CUIT*\n\n` +
        `No se encontraron cheques para el CUIT: ${cuitBuscado}\n\n` +
        `⏰ ${new Date().toLocaleString('es-AR')}`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    const enCartera = cheques.filter(c => !c.fecden);
    const entregados = cheques.filter(c => c.fecden);
    
    const montoCartera = enCartera.reduce((sum, c) => sum + (c.implocal || 0), 0);
    const montoEntregados = entregados.reduce((sum, c) => sum + (c.implocal || 0), 0);
    
    // Obtener nombre del cliente
    const cliente = cheques[0]?.origen || 'Sin nombre';
    
    bot.sendMessage(chatId, 
      `🔍 *CONSULTA CUIT: ${cuitBuscado}*\n\n` +
      `👤 *Cliente:* ${cliente}\n\n` +
      `📋 *En Cartera:*\n` +
      `   • Cantidad: ${enCartera.length} cheques\n` +
      `   • Monto: ${formatearMoneda(montoCartera)}\n\n` +
      `✅ *Entregados:*\n` +
      `   • Cantidad: ${entregados.length} cheques\n` +
      `   • Monto: ${formatearMoneda(montoEntregados)}\n\n` +
      `💰 *Total histórico:* ${formatearMoneda(montoCartera + montoEntregados)}\n\n` +
      `⏰ ${new Date().toLocaleString('es-AR')}`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error('Error en /cuit:', error);
    bot.sendMessage(chatId, '❌ Error al consultar CUIT.');
  }
});

// Manejar /cuit sin parámetro
bot.onText(/^\/cuit$/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '⚠️ Debés indicar el CUIT. Ejemplo: /cuit 20123456789');
});

// ============================================================
// COMANDO /resumen - RESUMEN EJECUTIVO COMPLETO
// ============================================================

bot.onText(/\/resumen/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (!await verificarAutorizacion(chatId)) {
    bot.sendMessage(chatId, '⚠️ No estás autorizado. Usá /start para registrarte.');
    return;
  }
  
  try {
    // Obtener cheques
    const { data: cheques, error: errorCheques } = await supabase
      .from('cheques_valores')
      .select('*')
      .is('fecden', null);
    
    if (errorCheques) throw errorCheques;
    
    // Obtener saldos
    const { data: saldos, error: errorSaldos } = await supabase
      .from('saldos_contables_sync')
      .select('*');
    
    const hoy = getHoyUTC();
    const manana = getMananaUTC();
    const en7dias = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000);
    const en15dias = new Date(hoy.getTime() + 15 * 24 * 60 * 60 * 1000);
    
    // Cálculos
    const totalCartera = cheques.reduce((sum, c) => sum + (c.implocal || 0), 0);
    const cantidadCheques = cheques.length;
    
    // Vencimientos
    const vencenHoy = cheques.filter(c => {
      const fvto = new Date(c.fvto);
      return fvto >= hoy && fvto < manana;
    });
    
    const vencenManana = cheques.filter(c => {
      const fvto = new Date(c.fvto);
      const pasadoManana = new Date(manana.getTime() + 24 * 60 * 60 * 1000);
      return fvto >= manana && fvto < pasadoManana;
    });
    
    const vencen7dias = cheques.filter(c => {
      const fvto = new Date(c.fvto);
      return fvto >= hoy && fvto < en7dias;
    });
    
    const vencen15dias = cheques.filter(c => {
      const fvto = new Date(c.fvto);
      return fvto >= hoy && fvto < en15dias;
    });
    
    // Saldos tesorería
    const totalSaldos = saldos ? saldos.reduce((sum, s) => sum + (s.saldo_total || 0), 0) : 0;
    
    // Alertas
    const hoyTimestamp = hoy.getTime();
    const validezCritica = cheques.filter(c => {
      const fechaVto = new Date(c.fvto);
      const diasDesdeVto = Math.floor((hoyTimestamp - fechaVto.getTime()) / (1000 * 60 * 60 * 24));
      return diasDesdeVto >= 25 && diasDesdeVto <= 30;
    });
    
    bot.sendMessage(chatId, 
      `📊 *RESUMEN EJECUTIVO*\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💰 *CARTERA*\n` +
      `   Total: ${formatearMoneda(totalCartera)}\n` +
      `   Cheques: ${cantidadCheques}\n\n` +
      `📅 *VENCIMIENTOS*\n` +
      `   Hoy: ${vencenHoy.length} (${formatearMoneda(vencenHoy.reduce((s,c) => s + c.implocal, 0))})\n` +
      `   Mañana: ${vencenManana.length} (${formatearMoneda(vencenManana.reduce((s,c) => s + c.implocal, 0))})\n` +
      `   7 días: ${vencen7dias.length} (${formatearMoneda(vencen7dias.reduce((s,c) => s + c.implocal, 0))})\n` +
      `   15 días: ${vencen15dias.length} (${formatearMoneda(vencen15dias.reduce((s,c) => s + c.implocal, 0))})\n\n` +
      `🏦 *TESORERÍA*\n` +
      `   Saldo Total: ${formatearMoneda(totalSaldos)}\n\n` +
      `⚠️ *ALERTAS*\n` +
      `   Validez crítica: ${validezCritica.length} cheques\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n` +
      `⏰ ${new Date().toLocaleString('es-AR')}`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error('Error en /resumen:', error);
    bot.sendMessage(chatId, '❌ Error al generar resumen.');
  }
});

// ============================================================
// NOTIFICACIONES AUTOMÁTICAS (CRON JOBS)
// ============================================================

// Almacén de chatIds para notificaciones
const chatIdsParaNotificaciones = new Set();

// Agregar usuarios al set cuando se registran
bot.on('message', (msg) => {
  if (usuariosAutorizados.has(msg.chat.id)) {
    chatIdsParaNotificaciones.add(msg.chat.id);
  }
});

/**
 * Enviar notificación a todos los usuarios registrados
 */
async function enviarNotificacionATodos(mensaje) {
  for (const chatId of chatIdsParaNotificaciones) {
    try {
      await bot.sendMessage(chatId, mensaje, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error(`Error enviando notificación a ${chatId}:`, error.message);
      // Si el usuario bloqueó el bot, removerlo
      if (error.response?.statusCode === 403) {
        chatIdsParaNotificaciones.delete(chatId);
        usuariosAutorizados.delete(chatId);
      }
    }
  }
}

// 🕗 RESUMEN DIARIO - 8:00 AM (hora Argentina = 11:00 UTC)
cron.schedule('0 11 * * *', async () => {
  console.log('📤 Enviando resumen diario...');
  
  try {
    const { data: cheques } = await supabase
      .from('cheques_valores')
      .select('*')
      .is('fecden', null);
    
    const { data: saldos } = await supabase
      .from('saldos_contables_sync')
      .select('*');
    
    if (!cheques) return;
    
    const totalCartera = cheques.reduce((sum, c) => sum + (c.implocal || 0), 0);
    const totalSaldos = saldos ? saldos.reduce((sum, s) => sum + (s.saldo_total || 0), 0) : 0;
    
    const hoy = getHoyUTC();
    const manana = getMananaUTC();
    
    const vencenHoy = cheques.filter(c => {
      const fvto = new Date(c.fvto);
      return fvto >= hoy && fvto < manana;
    });
    
    const mensaje = 
      `☀️ *RESUMEN DIARIO*\n` +
      `${new Date().toLocaleDateString('es-AR')}\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `💰 Cartera: ${formatearMoneda(totalCartera)}\n` +
      `📋 Cheques: ${cheques.length}\n` +
      `🏦 Tesorería: ${formatearMoneda(totalSaldos)}\n\n` +
      `📅 Vencen hoy: ${vencenHoy.length} cheques\n` +
      `   ${formatearMoneda(vencenHoy.reduce((s,c) => s + c.implocal, 0))}\n\n` +
      `Usá /resumen para más detalles.`;
    
    await enviarNotificacionATodos(mensaje);
    
  } catch (error) {
    console.error('Error en resumen diario:', error);
  }
});

// 🕕 ALERTA VENCIMIENTOS MAÑANA - 6:00 PM (hora Argentina = 21:00 UTC)
cron.schedule('0 21 * * *', async () => {
  console.log('📤 Enviando alerta de vencimientos mañana...');
  
  try {
    const { data: cheques } = await supabase
      .from('cheques_valores')
      .select('*')
      .is('fecden', null);
    
    if (!cheques) return;
    
    const manana = getMananaUTC();
    const pasadoManana = new Date(manana.getTime() + 24 * 60 * 60 * 1000);
    
    const vencenManana = cheques.filter(c => {
      const fvto = new Date(c.fvto);
      return fvto >= manana && fvto < pasadoManana;
    });
    
    if (vencenManana.length === 0) return; // No enviar si no hay vencimientos
    
    const montoTotal = vencenManana.reduce((sum, c) => sum + (c.implocal || 0), 0);
    
    const mensaje = 
      `🔔 *ALERTA: VENCIMIENTOS MAÑANA*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `⚠️ ${vencenManana.length} cheques vencen mañana\n` +
      `💰 Total: ${formatearMoneda(montoTotal)}\n\n` +
      `Usá /manana para ver el detalle.`;
    
    await enviarNotificacionATodos(mensaje);
    
  } catch (error) {
    console.error('Error en alerta vencimientos:', error);
  }
});

// 🚨 VERIFICACIÓN DE VALIDEZ CRÍTICA - Cada 6 horas
cron.schedule('0 */6 * * *', async () => {
  console.log('🔍 Verificando validez crítica...');
  
  try {
    const { data: cheques } = await supabase
      .from('cheques_valores')
      .select('*')
      .is('fecden', null);
    
    if (!cheques) return;
    
    const hoy = getHoyUTC();
    const hoyTimestamp = hoy.getTime();
    
    const validezCritica = cheques.filter(c => {
      const fechaVto = new Date(c.fvto);
      const diasDesdeVto = Math.floor((hoyTimestamp - fechaVto.getTime()) / (1000 * 60 * 60 * 24));
      return diasDesdeVto >= 25 && diasDesdeVto <= 30;
    });
    
    if (validezCritica.length === 0) return; // No enviar si no hay alertas
    
    const montoTotal = validezCritica.reduce((sum, c) => sum + (c.implocal || 0), 0);
    
    // Calcular días mínimos restantes
    let diasMinimo = 999;
    validezCritica.forEach(c => {
      const fechaVto = new Date(c.fvto);
      const diasDesdeVto = Math.floor((hoyTimestamp - fechaVto.getTime()) / (1000 * 60 * 60 * 24));
      const diasRestantes = 30 - diasDesdeVto;
      if (diasRestantes < diasMinimo) diasMinimo = diasRestantes;
    });
    
    const mensaje = 
      `🚨 *ALERTA CRÍTICA: VALIDEZ*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `⚠️ ${validezCritica.length} cheques próximos a perder validez\n` +
      `💰 Total: ${formatearMoneda(montoTotal)}\n` +
      `⏰ Mínimo ${diasMinimo} días restantes\n\n` +
      `¡Acción urgente requerida!\n` +
      `Usá /alertas para más detalles.`;
    
    await enviarNotificacionATodos(mensaje);
    
  } catch (error) {
    console.error('Error en verificación validez:', error);
  }
});

// ============================================================
// MANEJO DE ERRORES GLOBAL
// ============================================================

bot.on('polling_error', (error) => {
  console.error('Error de polling:', error.message);
});

bot.on('error', (error) => {
  console.error('Error del bot:', error.message);
});

console.log('✅ Bot configurado y escuchando mensajes...');
console.log('📋 Comandos disponibles: /start, /cartera, /hoy, /manana, /semana, /saldos, /alertas, /cuit, /resumen, /ayuda');
console.log('🔔 Notificaciones programadas: 8:00 AM (resumen), 6:00 PM (vencimientos), cada 6h (validez crítica)');
