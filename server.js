require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // Carpeta donde estarán tus archivos HTML/CSS/JS

// Estados del bot
const STATE = {
  START: 'start',
  NAME: 'name',
  DISTRICT: 'district',
  PROPERTY_TYPE: 'property_type',
  AREA: 'area',
  SERVICE: 'service',
  SERVICE_TYPE: 'service_type',
  CONTACT: 'contact'
};

// Mapeos de respuestas
const PROPERTY_TYPES_MAP = {
  '1': 'casa',
  '2': 'departamento',
  '3': 'local comercial',
  '4': 'local industrial',
  '5': 'otro'
};

const AREAS_MAP = {
  '1': '0-50 m²',
  '2': '51-100 m²',
  '3': '101-200 m²',
  '4': 'más de 200 m²'
};

const SERVICES_MAP = {
  '1': 'desinsectación integral',
  '2': 'fumigación de mercaderías',
  '3': 'control y monitoreo de roedores',
  '4': 'desinfección de ambientes',
  '5': 'limpieza de cisterna/reservorios',
  '6': 'limpieza de pozos sépticos',
  '7': 'mantenimiento de trampas de grasa',
  '8': 'otro servicio'
};

const SERVICE_TYPES_MAP = {
  '1': 'preventivo',
  '2': 'correctivo'
};

const CONTACT_OPTIONS_MAP = {
  '1': 'sí, por favor',
  '2': 'no, gracias'
};

// Almacenamiento temporal de datos
let userData = {};
let conversations = {};

// Función para enviar mensaje de texto
async function sendTextMessage(to, text) {
  await axios.post(
    `https://graph.facebook.com/v22.0/${process.env.PHONE_NUMBER_ID}/messages`, 
    {
      messaging_product: "whatsapp",
      to,
      text: { body: text },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },
    }
  );

  // Registrar mensaje del bot
  if (!conversations[to]) conversations[to] = { responses: [] };
  conversations[to].responses.push({
    from: 'bot',
    text: text,
    timestamp: new Date()
  });
}

// Ruta /webhook - Verificación de Meta
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token && mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    console.log("✅ Webhook verificado");
    res.status(200).send(challenge);
  } else {
    console.log("❌ Token de verificación inválido");
    res.sendStatus(403);
  }
});

// Ruta /webhook - Recepción de mensajes de WhatsApp
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (
    !body.object ||
    !body.entry ||
    !body.entry[0] ||
    !body.entry[0].changes ||
    !body.entry[0].changes[0] ||
    !body.entry[0].changes[0].value ||
    !body.entry[0].changes[0].value.messages ||
    body.entry[0].changes[0].value.messages.length === 0
  ) {
    return res.sendStatus(200);
  }

  const message = body.entry[0].changes[0].value.messages[0];
  const from = message.from;
  let text = message.text?.body.toLowerCase().trim() || '';

  console.log("📩 Texto recibido:", text);

  // Iniciar si no tiene estado
  if (!userData[from]) {
    userData[from] = { state: STATE.START };
  }

  const user = userData[from];

  // Inicializar historial de conversación
  if (!conversations[from]) {
    conversations[from] = { responses: [] };
  }

  // Registrar mensaje del cliente
  if (text && text !== '') {
    conversations[from].responses.push({
      from: 'cliente',
      text: text,
      timestamp: new Date()
    });
  }

  try {
    switch (user.state) {
      case STATE.START:
        await sendTextMessage(
          from,
          "👋 ¡Buenos días/tardes/noches!\n\nBienvenido/a a Econtrol Saneamiento Ambiental.\n\n¿Podría indicarme su nombre completo?"
        );
        user.state = STATE.NAME;
        break;

      case STATE.NAME:
        user.name = text;
        await sendTextMessage(from, "📍 ¿En qué distrito se encuentra ubicado/a?");
        user.state = STATE.DISTRICT;
        break;

      case STATE.DISTRICT:
        user.district = text;

        await sendTextMessage(
          from,
          "🏡 ¿Qué tipo de local es?\n\n1. Casa\n2. Departamento\n3. Local Comercial\n4. Local Industrial\n5. Otro"
        );
        user.state = STATE.PROPERTY_TYPE;
        break;

      case STATE.PROPERTY_TYPE:
        const propertyMatch = PROPERTY_TYPES_MAP[text];
        if (!propertyMatch) {
          await sendTextMessage(
            from,
            "❌ Por favor, seleccione una opción válida:\n\n1. Casa\n2. Departamento\n3. Local Comercial\n4. Local Industrial\n5. Otro"
          );
          break;
        }

        user.propertyType = propertyMatch;

        await sendTextMessage(
          from,
          "📐 ¿Cuántos metros cuadrados tiene su inmueble?\n\n1. 0-50 m²\n2. 51-100 m²\n3. 101-200 m²\n4. Más de 200 m²"
        );

        user.state = STATE.AREA;
        break;

      case STATE.AREA:
        const areaMatch = AREAS_MAP[text];
        if (!areaMatch) {
          await sendTextMessage(
            from,
            "❌ Por favor, seleccione una opción válida:\n\n1. 0-50 m²\n2. 51-100 m²\n3. 101-200 m²\n4. Más de 200 m²"
          );
          break;
        }

        user.area = areaMatch;

        await sendTextMessage(
          from,
          "⚙️ ¿Qué servicio necesita?\n\n1. Desinsectación Integral\n2. Fumigación de mercaderías\n3. Control y Monitoreo de Roedores\n4. Desinfección de ambientes\n5. Limpieza de Cisterna/Reservorios\n6. Limpieza de Pozos Sépticos\n7. Mantenimiento de Trampas de Grasa\n8. Otro servicio"
        );

        user.state = STATE.SERVICE;
        break;

      case STATE.SERVICE:
        const serviceMatch = SERVICES_MAP[text];
        if (!serviceMatch) {
          await sendTextMessage(
            from,
            "❌ Por favor, seleccione una opción válida:\n\n1. Desinsectación Integral\n2. Fumigación de mercaderías\n3. Control y Monitoreo de Roedores\n4. Desinfección de ambientes\n5. Limpieza de Cisterna/Reservorios\n6. Limpieza de Pozos Sépticos\n7. Mantenimiento de Trampas de Grasa\n8. Otro servicio"
          );
          break;
        }

        user.service = serviceMatch;

        await sendTextMessage(
          from,
          "⚠️ ¿El servicio es Preventivo o Correctivo?\n\n1. Preventivo (mantenimiento regular)\n2. Correctivo (solución a problema existente)"
        );

        user.state = STATE.SERVICE_TYPE;
        break;

      case STATE.SERVICE_TYPE:
        const serviceTypeMatch = SERVICE_TYPES_MAP[text];
        if (!serviceTypeMatch) {
          await sendTextMessage(
            from,
            "❌ Por favor, responda con:\n\n1. Preventivo\n2. Correctivo"
          );
          break;
        }

        user.serviceType = serviceTypeMatch;

        await sendTextMessage(
          from,
          "📞 ¿Desea que un asesor le contacte?\n\n1. Sí, por favor\n2. No, gracias"
        );

        user.state = STATE.CONTACT;
        break;

      case STATE.CONTACT:
        const contactMatch = CONTACT_OPTIONS_MAP[text];
        if (!contactMatch) {
          await sendTextMessage(
            from,
            "❌ Por favor, responda con:\n\n1. Sí, por favor\n2. No, gracias"
          );
          break;
        }

        user.contact = contactMatch;

        // Enviar datos a Google Sheets vía Apps Script
        try {
          await axios.post(process.env.APPS_SCRIPT_URL, {
            from,
            name: user.name,
            district: user.district,
            propertyType: user.propertyType,
            area: user.area,
            service: user.service,
            serviceType: user.serviceType,
            contact: user.contact
          });

          console.log("✅ Datos enviados a Google Sheets");

          await sendTextMessage(
            from,
            "✅ ¡Gracias por su solicitud!\n\nNos pondremos en contacto en el menor tiempo posible."
          );

          delete userData[from]; // Limpiar datos

        } catch (err) {
          console.error("🚨 Error al guardar en Sheets:", err.message);
          await sendTextMessage(
            from,
            "⚠️ Hubo un error guardando sus datos. Por favor, inténtelo más tarde."
          );
        }

        break;
    }

  } catch (error) {
    console.error("💥 Error general:", error.message);
  }

  res.sendStatus(200);
});

// Ruta /monitor - Muestra el historial de conversaciones y permite responder
app.get('/monitor', (req, res) => {
  let html = `
    <html>
      <head>
        <title>📲 Monitor de Conversaciones</title>
        <meta http-equiv="refresh" content="10">
        <style>
          body { font-family: Arial; background: #000; color: white; padding: 20px; }
          .chat-container { display: flex; flex-direction: column; max-width: 600px; margin-bottom: 30px; }
          .chat-header { font-weight: bold; margin-top: 20px; }
          .bubble-client { background: #373A3C; color: white; border-radius: 10px; padding: 10px; width: auto; max-width: 80%; margin: 5px 0; float: left; clear: both; }
          .bubble-bot { background: #25D366; color: white; border-radius: 10px; padding: 10px; max-width: 80%; margin: 5px 0; float: right; clear: both; }
          .timestamp { font-size: 0.7em; color: gray; margin-left: 10px; }
          .input-area { margin-top: 10px; display: flex; gap: 10px; }
          input[type=text], textarea { padding: 10px; width: 100%; max-width: 400px; }
          button { padding: 10px 15px; background: #25D366; color: white; border: none; border-radius: 5px; cursor: pointer; }
        </style>
      </head>
      <body>
        <h2>Monitor de Conversaciones</h2>
  `;

  for (const from in conversations) {
    const chat = conversations[from];
    html += `
      <div class="chat-container">
        <div class="chat-header">Cliente: ${from}</div>
    `;
    chat.responses.forEach(msg => {
      const time = msg.timestamp.toLocaleTimeString();

      if (msg.from === 'cliente') {
        html += `
          <div style="clear:both;">
            <div class="bubble-client">${msg.text}</div>
            <small class="timestamp">${time}</small>
          </div>
        `;
      } else {
        html += `
          <div style="clear:both;">
            <div class="bubble-bot">${msg.text}</div>
            <small class="timestamp">${time}</small>
          </div>
        `;
      }
    });

    html += `
        <form class="input-area" action="/api/send" method="POST">
          <input type="hidden" name="to" value="${from}">
          <input type="text" name="message" placeholder="Escribe tu mensaje...">
          <button type="submit">Enviar</button>
        </form>
      </div>
    `;
  }

  html += '</body></html>';
  res.send(html);
});

// Ruta para obtener todos los chats
app.get('/api/chats', (req, res) => {
  res.send(conversations);
});

// Ruta para obtener un chat específico
app.get('/api/chat/:from', (req, res) => {
  const from = req.params.from;
  res.send(conversations[from] || { responses: [] });
});

// Ruta para enviar mensajes desde el asesor
app.post('/api/send', express.json(), async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) return res.status(400).send("Faltan datos");

  try {
    await axios.post(
      `https://graph.facebook.com/v22.0/${process.env.PHONE_NUMBER_ID}/messages`, 
      {
        messaging_product: "whatsapp",
        to,
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`
        }
      }
    );

    // Guardar mensaje del asesor
    if (!conversations[to]) conversations[to] = { responses: [] };
    conversations[to].responses.push({
      from: 'bot',
      text: message,
      timestamp: new Date()
    });

    res.send({ status: "ok" });
  } catch (err) {
    console.error("🚨 Error al enviar mensaje:", err.message);
    res.send({ status: "error", error: err.message });
  }
});

// Puerto dinámico
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
