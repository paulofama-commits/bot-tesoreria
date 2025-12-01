# 🤖 Bot de Telegram - Sistema de Tesorería Grande State

Bot de consultas para el Sistema de Gestión Financiera.

## 📋 Comandos Disponibles

| Comando | Descripción |
|---------|-------------|
| `/start` | Iniciar y registrar usuario |
| `/cartera` | Total en cartera + cantidad cheques |
| `/hoy` | Cheques que vencen hoy |
| `/manana` | Cheques que vencen mañana |
| `/semana` | Cheques próximos 7 días |
| `/saldos` | Saldos de tesorería (5 cuentas) |
| `/alertas` | Alertas críticas (vencidos, validez, concentración) |
| `/cuit [número]` | Consultar CUIT específico |
| `/resumen` | Resumen ejecutivo completo |
| `/ayuda` | Lista de comandos |

## 🔔 Notificaciones Automáticas

- **8:00 AM** - Resumen diario
- **6:00 PM** - Alerta de vencimientos para mañana
- **Cada 6 horas** - Verificación de validez crítica

## 🚀 Deployment en Railway

### Paso 1: Crear cuenta en Railway
1. Ir a [railway.app](https://railway.app)
2. Registrarse con GitHub

### Paso 2: Crear nuevo proyecto
1. Click en "New Project"
2. Seleccionar "Deploy from GitHub repo" o "Empty Project"

### Paso 3: Si usás GitHub
1. Subir este código a un repositorio de GitHub
2. Conectar el repo en Railway
3. Railway detectará automáticamente que es Node.js

### Paso 4: Si NO usás GitHub
1. Crear "Empty Project"
2. Agregar servicio: "Add Service" → "Empty Service"
3. Ir a Settings → Deploy → seleccionar "Upload"
4. Subir los archivos del bot

### Paso 5: Configurar Variables de Entorno
En Railway, ir a "Variables" y agregar:

```
TELEGRAM_BOT_TOKEN=8393028773:AAG5AXGmpjBxmGeGdYKzUi91qbQcOxyFwv0
SUPABASE_URL=https://nevjpznhnxornrcxcnkb.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ldmpwem5obnhvcm5yY3hjbmtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE0NDMzMzIsImV4cCI6MjA0NzAxOTMzMn0.LPz5Z4TJCBmUXCIPHNzPhLUnHLslmN3L6vo8ohfQ5Y4
```

### Paso 6: Deploy
Railway hará el deploy automáticamente. El bot quedará online 24/7.

## 📁 Estructura de Archivos

```
bot-tesoreria/
├── index.js           # Lógica principal del bot
├── package.json       # Dependencias
├── supabaseClient.js  # Conexión a Supabase
├── .env               # Variables de entorno (NO subir a GitHub)
└── README.md          # Este archivo
```

## 🔐 Seguridad

- Solo usuarios en `allowed_users` de Supabase pueden usar el bot
- Cada usuario debe registrarse con su email corporativo
- Las notificaciones solo se envían a usuarios registrados

## 🛠️ Desarrollo Local

```bash
# Instalar dependencias
npm install

# Ejecutar bot
npm start
```

## 📞 Soporte

Bot: @grandestate_tesoreris_bot
Desarrollado por: Paulo Famá
