/**
 * Firebase Cloud Functions para Stockly
 * Backend desplegado en Firebase
 */

const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const CORS_OPTIONS = { cors: true };
const admin = require("firebase-admin");
const corsMiddleware = require("cors")({ origin: true });

// Wrapper que maneja preflight OPTIONS explícitamente (necesario en Functions v2)
const cors = (req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }
  return corsMiddleware(req, res, next);
};
const https = require("https");
const http = require("http");
const { Resend } = require("resend");

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "Bodestock <noreply@bodestock.cl>";

// Inicializar Firebase Admin
admin.initializeApp();

// App secundaria con service account explícito para crear custom tokens (evita error signBlob en Gen 2)
const serviceAccount = require("./service-account.json");
const adminWithCreds = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
}, "impersonation");

// Cache de tokens de SimpleFactura en memoria (por email)
// Evita rate-limit del endpoint /token al hacer múltiples requests seguidos
const sfTokenCache = {}; // { email: { token, expiresAt } }

const getSFToken = async (hostname, sfEmail, sfPassword) => {
  const cached = sfTokenCache[sfEmail];
  const now = Date.now();
  // Reusar token si le quedan más de 60 segundos de vida
  if (cached && cached.expiresAt > now + 60000) {
    console.log(`🔑 Reusing cached token for ${sfEmail} (expires in ${Math.round((cached.expiresAt - now) / 1000)}s)`);
    return cached.token;
  }
  console.log(`🔑 Requesting new token for ${sfEmail}...`);
  const tokenResponse = await makeRequest(`https://${hostname}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: sfEmail, password: sfPassword })
  });
  if (tokenResponse.status >= 400) {
    throw Object.assign(new Error("AUTH_ERROR"), { status: 401, detail: tokenResponse.body });
  }
  const tokenData = JSON.parse(tokenResponse.body);
  const accessToken = tokenData.accessToken || tokenData.access_token || tokenData.token;
  if (!accessToken) {
    throw new Error("No se pudo obtener token de SimpleFactura");
  }
  // Los JWT de SimpleFactura duran ~1h; guardamos con 55min de TTL
  sfTokenCache[sfEmail] = { token: accessToken, expiresAt: now + 55 * 60 * 1000 };
  console.log(`✅ New token cached for ${sfEmail}`);
  return accessToken;
};

/**
 * Función para setear custom claims (roles) en Firebase Auth
 * Endpoint: https://REGION-PROJECT_ID.cloudfunctions.net/setCustomClaims
 *
 * Body: {
 *   uid: "user_firebase_uid",
 *   claims: {
 *     role: "ADMIN",
 *     companyId: "company_id"
 *   }
 * }
 */
exports.setCustomClaims = onRequest(CORS_OPTIONS, async (req, res) => {
  // Habilitar CORS
  cors(req, res, async () => {
    try {
      // Solo aceptar POST
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const { uid, claims } = req.body;

      // Validar parámetros
      if (!uid || !claims) {
        return res.status(400).json({
          error: "Missing required fields: uid and claims"
        });
      }

      // Setear los custom claims
      await admin.auth().setCustomUserClaims(uid, claims);

      // Marcar email como verificado automáticamente para trabajadores creados por admin
      await admin.auth().updateUser(uid, { emailVerified: true });

      console.log(`✅ Custom claims seteados para ${uid}:`, claims);

      return res.status(200).json({
        success: true,
        message: "Custom claims set successfully",
        uid,
        claims
      });

    } catch (error) {
      console.error("❌ Error setting custom claims:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: error.message
      });
    }
  });
});

/**
 * Función para obtener todos los usuarios (para dashboard admin)
 * Endpoint: https://REGION-PROJECT_ID.cloudfunctions.net/listUsers
 */
exports.listUsers = onRequest(CORS_OPTIONS, async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      // Listar hasta 1000 usuarios
      const listUsersResult = await admin.auth().listUsers(1000);

      const users = listUsersResult.users.map(user => ({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        disabled: user.disabled,
        customClaims: user.customClaims,
        creationTime: user.metadata.creationTime,
        lastSignInTime: user.metadata.lastSignInTime
      }));

      return res.status(200).json({
        success: true,
        users,
        count: users.length
      });

    } catch (error) {
      console.error("❌ Error listing users:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: error.message
      });
    }
  });
});

/**
 * Función para eliminar un usuario de Firebase Auth
 * Endpoint: https://REGION-PROJECT_ID.cloudfunctions.net/deleteUser
 *
 * Body: {
 *   uid: "user_firebase_uid"
 * }
 */
exports.deleteUser = onRequest(CORS_OPTIONS, async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const { uid } = req.body;

      if (!uid) {
        return res.status(400).json({
          error: "Missing required field: uid"
        });
      }

      // Eliminar usuario de Firebase Auth
      await admin.auth().deleteUser(uid);

      console.log(`✅ Usuario eliminado: ${uid}`);

      return res.status(200).json({
        success: true,
        message: "User deleted successfully",
        uid
      });

    } catch (error) {
      console.error("❌ Error deleting user:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: error.message
      });
    }
  });
});

/**
 * Enviar email de bienvenida cuando se crea un trabajador (nuevo)
 * Body: { email, name, password, companyName }
 */
exports.sendWelcomeEmail = onRequest(CORS_OPTIONS, async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const { email, name, password, companyName } = req.body;
      if (!email || !name) {
        return res.status(400).json({ error: "Missing required fields: email, name" });
      }

      const resend = new Resend(RESEND_API_KEY);

      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `Bienvenido a Stockly - ${companyName || "Tu empresa"}`,
        html: `
          <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;border-radius:16px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:40px 30px;text-align:center;">
              <h1 style="color:white;margin:0;font-size:28px;">¡Bienvenido a Stockly!</h1>
              <p style="color:#dbeafe;margin-top:8px;font-size:16px;">${companyName || ""}</p>
            </div>
            <div style="padding:30px;background:white;">
              <p style="color:#334155;font-size:16px;line-height:1.6;">Hola <strong>${name}</strong>,</p>
              <p style="color:#475569;font-size:15px;line-height:1.6;">
                Tu cuenta en Stockly ha sido creada. Aquí están tus credenciales de acceso:
              </p>
              <div style="background:#f1f5f9;border-radius:10px;padding:20px;margin:20px 0;">
                <p style="margin:0 0 8px 0;color:#475569;font-size:14px;"><strong>Email:</strong> ${email}</p>
                ${password ? `<p style="margin:0;color:#475569;font-size:14px;"><strong>Contraseña temporal:</strong> ${password}</p>` : ""}
              </div>
              ${password ? `<p style="color:#ef4444;font-size:13px;">Por seguridad, cambia tu contraseña la primera vez que inicies sesión.</p>` : ""}
              <div style="text-align:center;margin-top:30px;">
                <a href="https://stocklygo.com/login"
                   style="background:linear-gradient(135deg,#2563eb,#4f46e5);color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">
                  Iniciar Sesión →
                </a>
              </div>
            </div>
            <div style="background:#1e293b;padding:20px;text-align:center;">
              <p style="color:#94a3b8;margin:0;font-size:12px;">Stockly - Sistema de Gestión de Inventario</p>
            </div>
          </div>
        `
      });

      if (error) {
        console.error("❌ Error Resend sendWelcomeEmail:", error);
        return res.status(500).json({ error: error.message });
      }

      console.log(`✅ Email de bienvenida enviado a ${email}`);
      return res.status(200).json({ success: true, message: `Email enviado a ${email}` });

    } catch (error) {
      console.error("❌ Error sending welcome email:", error);
      return res.status(500).json({ error: "Internal server error", message: error.message });
    }
  });
});

/**
 * Enviar email de recuperación de contraseña vía Resend (dominio bodestock.cl verificado).
 * Reemplaza al sendPasswordResetEmail nativo de Firebase Auth, que envía desde un dominio
 * genérico y suele ir a spam o no llegar cuando el dominio propio ya tiene SPF/DKIM de Resend.
 * Body: { email }
 */
exports.sendPasswordReset = onRequest(CORS_OPTIONS, async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Missing required field: email" });
      }

      // Por seguridad, siempre responder éxito aunque el email no exista
      // (evita que alguien pueda usar este endpoint para enumerar cuentas registradas)
      let resetLink;
      try {
        resetLink = await admin.auth().generatePasswordResetLink(email, {
          url: "https://bodestock.cl/login",
        });
      } catch (err) {
        console.log(`ℹ️ No se generó link de reset para ${email}: ${err.code || err.message}`);
        return res.status(200).json({ success: true });
      }

      const resend = new Resend(RESEND_API_KEY);
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: "Recupera tu contraseña — Bodestock",
        html: `
          <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;border-radius:16px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:40px 30px;text-align:center;">
              <h1 style="color:white;margin:0;font-size:26px;">Recupera tu contraseña</h1>
            </div>
            <div style="padding:30px;background:white;">
              <p style="color:#334155;font-size:16px;line-height:1.6;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta en Bodestock.
              </p>
              <p style="color:#475569;font-size:15px;line-height:1.6;">
                Si fuiste tú, hacé clic en el siguiente botón para crear una nueva contraseña:
              </p>
              <div style="text-align:center;margin:30px 0;">
                <a href="${resetLink}"
                   style="background:linear-gradient(135deg,#2563eb,#4f46e5);color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">
                  Restablecer contraseña →
                </a>
              </div>
              <p style="color:#94a3b8;font-size:13px;line-height:1.6;">
                Si no solicitaste este cambio, podés ignorar este correo — tu contraseña actual sigue funcionando.
              </p>
            </div>
            <div style="background:#1e293b;padding:20px;text-align:center;">
              <p style="color:#94a3b8;margin:0;font-size:12px;">Bodestock - Sistema de Gestión de Inventario</p>
            </div>
          </div>
        `
      });

      if (error) {
        console.error("❌ Error Resend sendPasswordReset:", error);
        return res.status(500).json({ error: error.message });
      }

      console.log(`✅ Email de recuperación enviado a ${email}`);
      return res.status(200).json({ success: true });

    } catch (error) {
      console.error("❌ Error sending password reset email:", error);
      return res.status(500).json({ error: "Internal server error", message: error.message });
    }
  });
});

/**
 * Helper para hacer requests HTTP desde Cloud Functions
 * (node-fetch no está disponible en el runtime de Cloud Functions v2 por defecto)
 */
function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const lib = urlObj.protocol === "https:" ? https : http;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || "POST",
      headers: options.headers || {}
    };

    const req = lib.request(reqOptions, (response) => {
      let data = "";
      response.on("data", (chunk) => { data += chunk; });
      response.on("end", () => {
        resolve({ status: response.statusCode, body: data, headers: response.headers });
      });
    });

    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

/**
 * Proxy para emitir DTEs via SimpleFactura
 * Evita problemas de CORS al hacer la llamada server-side
 * SimpleFactura usa Basic Auth (email:password en Base64)
 *
 * Body: { apiUrl, sfEmail, sfPassword, dteData }
 */
exports.simpleFacturaEmitir = onRequest({ ...CORS_OPTIONS, timeoutSeconds: 300 }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).send("");

  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const { apiUrl, sfEmail, sfPassword, dteData, dtesData } = req.body;

      if (!apiUrl || !sfEmail || !sfPassword || (!dteData && !dtesData)) {
        return res.status(400).json({
          error: "Missing required fields: apiUrl, sfEmail, sfPassword, dteData or dtesData"
        });
      }

      // Validar que la URL sea de SimpleFactura
      const allowedHosts = ["api.simplefactura.cl", "api-cert.simplefactura.cl"];
      const urlObj = new URL(apiUrl);
      if (!allowedHosts.includes(urlObj.hostname)) {
        return res.status(400).json({
          error: "URL no permitida. Solo se permiten URLs de SimpleFactura."
        });
      }

      // Paso 1: Obtener token JWT de SimpleFactura (con cache para evitar rate-limit)
      let accessToken;
      try {
        accessToken = await getSFToken(urlObj.hostname, sfEmail, sfPassword);
      } catch (tokenErr) {
        if (tokenErr.status === 401) {
          console.error("❌ Error obteniendo token:", tokenErr.detail);
          return res.status(401).json({
            error: "Error de autenticación con SimpleFactura. Verifica tus credenciales.",
            detail: tokenErr.detail
          });
        }
        throw tokenErr;
      }

      // Helper para emitir un DTE y subir PDF a Storage
      const subirPDFBackground = (parsedBody, dte) => {
        const folio = parsedBody.folio || parsedBody.data?.folio;
        const tipoDTEEmitido = dte?.Documento?.Encabezado?.IdDoc?.TipoDTE;
        const pdfData = parsedBody.pdf || parsedBody.data?.pdf || parsedBody.data;
        let pdfBuffer = null;
        if (Array.isArray(pdfData)) pdfBuffer = Buffer.from(pdfData);
        else if (typeof pdfData === "string" && pdfData.length > 100) pdfBuffer = Buffer.from(pdfData, "base64");
        if (pdfBuffer && pdfBuffer.length > 0 && folio && tipoDTEEmitido) {
          const bucket = admin.storage().bucket();
          const fileName = `dte/${tipoDTEEmitido}_${folio}_${Date.now()}.pdf`;
          const file = bucket.file(fileName);
          // No await — sube en background sin bloquear la respuesta
          file.save(pdfBuffer, { metadata: { contentType: "application/pdf" }, public: true })
            .then(() => console.log(`✅ PDF guardado en Storage: ${fileName}`))
            .catch(e => console.warn("⚠️ No se pudo guardar PDF en Storage:", e.message));
          parsedBody.pdfStorageUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        }
        return parsedBody;
      };

      const emitirUnoDTE = async (dte) => {
        console.log(`📋 Emitiendo DTE via ${apiUrl}...`);
        const response = await makeRequest(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
          body: JSON.stringify(dte)
        });
        console.log(`📡 SimpleFactura emitir response status: ${response.status}`);
        if (response.status >= 400) {
          throw new Error(`Error SF ${response.status}: ${response.body}`);
        }
        let parsedBody;
        try { parsedBody = JSON.parse(response.body); } catch (e) { parsedBody = response.body; }
        return subirPDFBackground(parsedBody, dte);
      };

      // Paso 2: Emitir — si viene dtesData (array) emitir todos con el mismo token
      if (dtesData && Array.isArray(dtesData) && dtesData.length > 0) {
        console.log(`📦 Emitiendo ${dtesData.length} DTEs con un solo token...`);
        const resultados = [];
        for (let i = 0; i < dtesData.length; i++) {
          console.log(`  ➜ DTE ${i + 1}/${dtesData.length}`);
          const resultado = await emitirUnoDTE(dtesData[i]);
          resultados.push(resultado);
        }
        res.set("Content-Type", "application/json");
        return res.status(200).json({ success: true, resultados, total: resultados.length });
      }

      // Modo legacy: un solo DTE
      const parsedBody = await emitirUnoDTE(dteData);
      res.set("Content-Type", "application/json");
      return res.status(200).json(parsedBody);

    } catch (error) {
      console.error("❌ Error en simpleFacturaEmitir:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: error.message
      });
    }
  });
});

/**
 * Proxy para obtener PDF de DTE desde SimpleFactura
 * Endpoint: POST /dte/pdf con Bearer token
 *
 * Body: { sfEmail, sfPassword, credenciales, dteReferenciadoExterno }
 */
exports.simpleFacturaPdf = onRequest(CORS_OPTIONS, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).send("");

  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const { sfEmail, sfPassword, credenciales, dteReferenciadoExterno } = req.body;

      if (!sfEmail || !sfPassword || !credenciales || !dteReferenciadoExterno) {
        return res.status(400).json({
          error: "Missing required fields: sfEmail, sfPassword, credenciales, dteReferenciadoExterno"
        });
      }

      // Paso 1: Obtener token JWT (con cache para evitar rate-limit)
      let accessToken;
      try {
        accessToken = await getSFToken("api.simplefactura.cl", sfEmail, sfPassword);
        console.log(`🔑 Token obtenido: ${accessToken.substring(0, 30)}...`);
      } catch (tokenErr) {
        return res.status(401).json({
          error: "Error de autenticación con SimpleFactura",
          detail: tokenErr.detail || tokenErr.message
        });
      }

      // Paso 2: Obtener PDF (usando buffers binarios para no corromper bytes)
      console.log(`📄 Obteniendo PDF - Folio: ${dteReferenciadoExterno.folio}, TipoDTE: ${dteReferenciadoExterno.codigoTipoDte}`);
      console.log(`📦 Body enviado a /dte/pdf:`, JSON.stringify({ credenciales, dteReferenciadoExterno }));

      const pdfBody = JSON.stringify({ credenciales, dteReferenciadoExterno });
      const pdfResult = await new Promise((resolve, reject) => {
        const pdfReq = https.request({
          hostname: "api.simplefactura.cl",
          path: "/dte/pdf",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
            "Content-Length": Buffer.byteLength(pdfBody)
          }
        }, (response) => {
          const chunks = [];
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("end", () => {
            const buffer = Buffer.concat(chunks);
            resolve({ status: response.statusCode, buffer, headers: response.headers });
          });
        });
        pdfReq.on("error", reject);
        pdfReq.write(pdfBody);
        pdfReq.end();
      });

      console.log(`📡 PDF response status: ${pdfResult.status}, size: ${pdfResult.buffer.length} bytes`);
      console.log(`📡 PDF content-type: ${pdfResult.headers["content-type"]}`);

      if (pdfResult.status >= 400) {
        const detailText = pdfResult.buffer.toString("utf-8");
        console.error(`❌ SimpleFactura PDF error ${pdfResult.status}:`, detailText);
        let detailParsed = detailText;
        try {
          const parsed = JSON.parse(detailText);
          detailParsed = parsed.message || parsed.error || parsed.detail || detailText;
        } catch { /* no es JSON */ }
        return res.status(pdfResult.status).json({
          error: `Error ${pdfResult.status} desde SimpleFactura: ${detailParsed}`,
          detail: detailText
        });
      }

      // Log primeros bytes para diagnosticar formato
      const contentType = pdfResult.headers["content-type"] || "";
      const firstBytes = pdfResult.buffer.slice(0, 50).toString("utf-8");
      console.log(`📡 PDF content-type: ${contentType}`);
      console.log(`📡 PDF first bytes: ${firstBytes}`);
      console.log(`📡 PDF buffer size: ${pdfResult.buffer.length}`);

      // Si empieza con %PDF es un PDF directo
      if (firstBytes.startsWith("%PDF")) {
        console.log("✅ Respuesta es PDF directo (binario)");
        const base64 = pdfResult.buffer.toString("base64");
        return res.status(200).json({
          success: true,
          pdfBase64: base64
        });
      }

      // Si es JSON, parsear y extraer data
      try {
        const jsonResp = JSON.parse(pdfResult.buffer.toString("utf-8"));
        console.log(`📡 JSON response keys: ${Object.keys(jsonResp)}`);
        console.log(`📡 JSON data type: ${typeof jsonResp.data}, isArray: ${Array.isArray(jsonResp.data)}`);

        if (jsonResp.data) {
          if (typeof jsonResp.data === "string") {
            // data es string base64
            console.log("✅ data es string base64, largo:", jsonResp.data.length);
            return res.status(200).json({
              success: true,
              pdfBase64: jsonResp.data
            });
          } else if (Array.isArray(jsonResp.data)) {
            // data es array de bytes (como en el SDK C#)
            console.log("✅ data es array de bytes, largo:", jsonResp.data.length);
            const pdfBuffer = Buffer.from(jsonResp.data);
            return res.status(200).json({
              success: true,
              pdfBase64: pdfBuffer.toString("base64")
            });
          } else if (Buffer.isBuffer(jsonResp.data)) {
            console.log("✅ data es Buffer");
            return res.status(200).json({
              success: true,
              pdfBase64: jsonResp.data.toString("base64")
            });
          }
        }

        // Fallback: devolver todo el JSON
        console.log("⚠️ No se pudo extraer PDF de JSON, devolviendo raw");
        return res.status(200).json(jsonResp);
      } catch (e) {
        // No es JSON, tratar como binario
        console.log("⚠️ No es JSON, convirtiendo buffer a base64");
        const base64 = pdfResult.buffer.toString("base64");
        return res.status(200).json({
          success: true,
          pdfBase64: base64
        });
      }

    } catch (error) {
      console.error("❌ Error en simpleFacturaPdf:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: error.message
      });
    }
  });
});

/**
 * Enviar email con código de referido
 * Body: { to, companyName, referralCode, discountPercent, discountMonths }
 */
exports.sendReferralEmail = onRequest(CORS_OPTIONS, async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const { to, companyName, referralCode, discountPercent, discountMonths } = req.body;

      if (!to || !referralCode) {
        return res.status(400).json({ error: "Missing required fields: to, referralCode" });
      }

      const resend = new Resend(RESEND_API_KEY);
      const registerUrl = "https://stocklygo.com/register";

      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to,
        subject: `🎉 ${companyName || "Stockly"} te invita - Código: ${referralCode}`,
        html: `
          <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;border-radius:16px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:40px 30px;text-align:center;">
              <h1 style="color:white;margin:0;font-size:28px;">🎉 ¡Invitación Especial!</h1>
              <p style="color:#dbeafe;margin-top:8px;font-size:16px;">Has sido invitado a Stockly</p>
            </div>
            <div style="padding:30px;background:white;">
              <p style="color:#334155;font-size:16px;line-height:1.6;">
                <strong>${companyName || "Una empresa"}</strong> te invita a usar <strong>Stockly</strong>,
                la plataforma de gestión de inventario y facturación electrónica más completa de Chile.
              </p>
              <div style="background:linear-gradient(135deg,#dbeafe,#e0e7ff);border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
                <p style="color:#475569;margin:0 0 8px 0;font-size:14px;">Tu código de referido:</p>
                <div style="background:white;border-radius:8px;padding:16px;display:inline-block;min-width:200px;">
                  <span style="font-size:24px;font-weight:bold;color:#2563eb;letter-spacing:2px;">${referralCode}</span>
                </div>
                ${discountPercent ? `<p style="color:#16a34a;font-weight:bold;margin-top:16px;font-size:16px;">🎁 ${discountPercent}% de descuento por ${discountMonths || 3} meses</p>` : ""}
              </div>
              <div style="text-align:center;margin:30px 0;">
                <a href="${registerUrl}?ref=${referralCode}"
                   style="background:linear-gradient(135deg,#2563eb,#4f46e5);color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">
                  Registrarme en Stockly →
                </a>
              </div>
              <div style="border-top:1px solid #e2e8f0;padding-top:20px;margin-top:20px;">
                <p style="color:#64748b;font-size:13px;text-align:center;">
                  Usa el código <strong>${referralCode}</strong> al registrarte para obtener tu descuento.<br>
                  Este código es personal e intransferible.
                </p>
              </div>
            </div>
            <div style="background:#1e293b;padding:20px;text-align:center;">
              <p style="color:#94a3b8;margin:0;font-size:12px;">Stockly - Gestión de Inventario & Facturación Electrónica<br>© 2026 Stockly. Todos los derechos reservados.</p>
            </div>
          </div>
        `
      });

      if (error) {
        console.error("❌ Error Resend sendReferralEmail:", error);
        return res.status(500).json({ error: error.message });
      }

      console.log(`✅ Email de referido enviado a ${to}`);
      return res.status(200).json({ success: true, message: `Email enviado a ${to}` });

    } catch (error) {
      console.error("❌ Error enviando email de referido:", error);
      return res.status(500).json({ error: "Error enviando email", message: error.message });
    }
  });
});

/**
 * Registro de empresa + usuario admin con trial de 30 días
 * Reemplaza al endpoint /api/companies/register del backend Express
 */
exports.registerCompany = onRequest(CORS_OPTIONS, async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const { companyName, adminName, adminEmail, password, referralCode, existingUid, rut, plan, isDemo, discount, country, businessType } = req.body;

      if (!companyName || !adminName || !adminEmail) {
        return res.status(400).json({
          success: false,
          error: "Todos los campos son requeridos"
        });
      }

      const VALID_COUNTRIES = ["CL", "VE"];
      const companyCountry = VALID_COUNTRIES.includes(country) ? country : "CL";

      const VALID_BUSINESS_TYPES = ["RETAIL", "WHOLESALE", "WAREHOUSE", "fashion", "HELADERIA", "CAFETERIA", "FOODTRUCK", "PANADERIA", "RESTAURANT", "OTHER"];
      const companyBusinessType = VALID_BUSINESS_TYPES.includes(businessType) ? businessType : "RETAIL";
      // Si no viene existingUid (flujo normal), la contraseña es obligatoria
      if (!existingUid && !password) {
        return res.status(400).json({
          success: false,
          error: "La contraseña es requerida"
        });
      }

      console.log("📝 Iniciando registro de nueva empresa:", companyName);

      const db = admin.firestore();

      // 1. Calcular fecha de fin del trial (30 días desde hoy)
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30);

      // 2. Crear empresa en Firestore
      const companyData = {
        name: companyName,
        adminEmail: adminEmail,
        adminName: adminName,
        country: companyCountry,
        businessType: companyBusinessType,
        rut: rut || null,
        plan: plan || "trial",
        status: (plan && plan !== "trial") ? "active" : "trial",
        trialEndDate: trialEndDate,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        referralCode: referralCode || null,
        limits: { users: 999, products: 999, warehouses: 999 },
        usage: { users: 1, products: 0, warehouses: 0 },
      };
      if (isDemo) {
        companyData.isDemo = true;
        companyData.discount = discount != null ? discount : 100;
        companyData.demoNote = `Demo creada por Super Admin el ${new Date().toLocaleDateString('es-CL')}`;
      }
      const companyRef = await db.collection("companies").add(companyData);

      const companyId = companyRef.id;
      console.log("✅ Empresa creada con ID:", companyId);

      // 3. Crear usuario admin en Firebase Auth (o usar uid existente de Google)
      let userRecord;
      if (existingUid) {
        // Viene de Google Auth — ya existe, solo actualizar displayName
        userRecord = await admin.auth().updateUser(existingUid, { displayName: adminName });
        console.log("✅ Usuario Google existente actualizado:", existingUid);
      } else {
        userRecord = await admin.auth().createUser({
          email: adminEmail,
          password: password,
          displayName: adminName,
          emailVerified: isDemo ? true : false,
        });
        console.log("✅ Usuario Firebase creado:", userRecord.uid);
      }

      // 4. Asignar custom claims (companyId y role)
      await admin.auth().setCustomUserClaims(userRecord.uid, {
        companyId: companyId,
        role: "ADMIN",
        country: companyCountry,
        receiveAlerts: true,
        receiveReports: true
      });

      console.log("✅ Custom claims asignados");

      // 5. Crear worker (ADMIN automáticamente)
      await db.collection("companies").doc(companyId).collection("workers").doc(userRecord.uid).set({
        uid: userRecord.uid,
        email: adminEmail,
        name: adminName,
        role: "ADMIN",
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        dailyLimit: {
          type: "unlimited",
          amount: 0
        },
        assignedWarehouses: []
      });

      console.log("✅ Worker creado en Firestore");

      // 5b. Crear el primer inventario automáticamente, usando el rubro elegido en el
      // registro — mismo formato que createInventory() en src/services/inventories-service.js.
      // No bloqueante: si falla, el registro sigue (el usuario puede crearlo a mano después).
      try {
        const inventoryId = companyName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "") // quitar acentos (rango Unicode explícito, evita depender del encoding del archivo)
          .replace(/[^a-z0-9]+/g, "-")      // espacios/símbolos → guiones
          .replace(/^-+|-+$/g, "");          // sin guiones al inicio/fin

        if (inventoryId) {
          const inventoryRef = db.collection("companies").doc(companyId).collection("inventories").doc(inventoryId);

          // Documento padre (puede ir vacío)
          await inventoryRef.set({ createdAt: admin.firestore.FieldValue.serverTimestamp() });

          // Metadata real del inventario
          await inventoryRef.collection("metadata").add({
            name: companyName,
            type: companyBusinessType,
            description: "",
            catalogEnabled: false,
            inventoryId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Rubros de producción: bodegas por defecto, igual que en el alta manual
          const PRODUCTION_TYPES = ["HELADERIA", "CAFETERIA", "FOODTRUCK", "PANADERIA", "RESTAURANT"];
          if (PRODUCTION_TYPES.includes(companyBusinessType)) {
            const warehousesRef = inventoryRef.collection("warehouses");
            await warehousesRef.add({
              name: "Insumos",
              description: "Bodega de materias primas e insumos",
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            await warehousesRef.add({
              name: "Mostrador",
              description: "Productos elaborados listos para vender",
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          console.log("✅ Inventario inicial creado:", inventoryId);
        }
      } catch (invError) {
        console.error("⚠️ Error creando inventario inicial (no bloquea el registro):", invError.message);
      }

      // 6. Enviar email de bienvenida (no bloqueante — no falla el registro si falla el email)
      try {
        const daysLeft = 30;
        const welcomeHtml = `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"></head>
          <body style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background:#f5f5f5;padding:20px;margin:0;">
            <div style="background:white;border-radius:12px;max-width:600px;margin:0 auto;box-shadow:0 4px 20px rgba(0,0,0,0.1);overflow:hidden;">
              <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:30px;text-align:center;color:white;">
                <h1 style="margin:0 0 8px 0;font-size:28px;">¡Bienvenido a Stockly!</h1>
                <p style="margin:0;font-size:15px;opacity:0.9;">${companyName}</p>
              </div>
              <div style="padding:35px 30px;">
                <h2 style="color:#1f2937;margin:0 0 12px 0;">Hola ${adminName},</h2>
                <p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 20px 0;">
                  ¡Tu cuenta <strong>${companyName}</strong> ha sido creada exitosamente!
                </p>
                <div style="background:linear-gradient(135deg,#10b981,#059669);color:white;padding:20px;border-radius:10px;margin:25px 0;text-align:center;">
                  <h3 style="margin:0 0 8px 0;">✨ Tu período de prueba</h3>
                  <p style="font-size:24px;font-weight:bold;margin:8px 0;">${daysLeft} días GRATIS</p>
                  <p style="margin:0;font-size:13px;opacity:0.9;">Acceso completo hasta el ${trialEndDate.toLocaleDateString('es-CL')}</p>
                </div>
                <h3 style="color:#1f2937;">Durante tu prueba tienes acceso a:</h3>
                <ul style="color:#4b5563;line-height:1.8;padding-left:20px;">
                  <li>✅ <strong>Control de inventario en tiempo real</strong></li>
                  <li>✅ <strong>Escáner de código de barras</strong></li>
                  <li>✅ <strong>Gestión de trabajadores y roles</strong></li>
                  <li>✅ <strong>Alertas de stock bajo por email</strong></li>
                  <li>✅ <strong>Exportación a Excel y PDF</strong></li>
                  <li>✅ <strong>App móvil optimizada</strong></li>
                  <li>✅ <strong>Reportes de ventas e inventario</strong></li>
                </ul>
                <div style="text-align:center;margin:30px 0;">
                  <a href="https://stocklygo.com/login"
                     style="background:linear-gradient(135deg,#3b82f6,#6366f1);color:white;padding:15px 40px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block;">
                    Empezar a usar Stockly
                  </a>
                </div>
                <div style="color:#6b7280;font-size:14px;margin-top:20px;padding-top:20px;border-top:1px solid #e5e7eb;">
                  <p style="margin:0;">¿Tienes preguntas? Contáctanos en <strong>soporte@stocklygo.com</strong></p>
                </div>
              </div>
              <div style="background:#f9fafb;padding:20px 30px;color:#9ca3af;font-size:12px;text-align:center;border-top:1px solid #e5e7eb;">
                <p style="margin:0;"><strong>Stockly</strong> · Sistema de Gestión de Inventario</p>
              </div>
            </div>
          </body>
          </html>
        `;
        // Fire-and-forget — no bloquea la respuesta
        const resendClient = new Resend(RESEND_API_KEY);
        resendClient.emails.send({
          from: FROM_EMAIL,
          to: adminEmail,
          subject: `🎉 ¡Bienvenido a Bodestock! - ${companyName}`,
          html: welcomeHtml
        }).then(() => console.log("✅ Email de bienvenida enviado a:", adminEmail))
          .catch(e => console.error("⚠️ Error email bienvenida:", e.message));
      } catch (emailError) {
        console.error("⚠️ Error preparando email de bienvenida:", emailError.message);
      }

      return res.status(200).json({
        success: true,
        message: "Empresa creada exitosamente con trial de 30 días",
        data: {
          companyId,
          userId: userRecord.uid,
          trialEndDate: trialEndDate.toISOString(),
          plan: "trial"
        }
      });

    } catch (error) {
      console.error("❌ Error en registro:", error);

      let errorMessage = error.message;
      if (error.code === "auth/email-already-exists") {
        errorMessage = "Ya existe una cuenta con este correo electrónico";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "El correo electrónico no es válido";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "La contraseña es demasiado débil (mínimo 6 caracteres)";
      }

      return res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  });
});

/**
 * Impersonar usuario: genera un custom token para que el super-admin
 * pueda entrar a cualquier cuenta sin necesitar la contraseña.
 * Body: { targetUid: "uid_del_usuario_admin_de_la_empresa" }
 */
/**
 * Gestión de folios SimpleFactura
 * action: "consultar" → stock disponible por tipo DTE
 * action: "solicitar" → pedir nuevos folios al SII
 */
exports.simpleFacturaFolios = onRequest(CORS_OPTIONS, async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const { sfEmail, sfPassword, action, tipoDTE, cantidad, rutEmpresa, ambiente } = req.body;

      if (!sfEmail || !sfPassword || !action) {
        return res.status(400).json({ error: "Missing required fields: sfEmail, sfPassword, action" });
      }

      const ambienteNum = (ambiente === "produccion" || ambiente === 1) ? 1 : 0;
      const baseUrl = "https://api.simplefactura.cl";

      // Obtener token (con cache para evitar rate-limit)
      let accessToken;
      try {
        accessToken = await getSFToken("api.simplefactura.cl", sfEmail, sfPassword);
      } catch (tokenErr) {
        return res.status(401).json({ error: "Credenciales inválidas en SimpleFactura" });
      }

      const authHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      };

      if (action === "consultar") {
        // Consultar stock de folios disponibles para uno o varios tipos DTE
        const tipos = tipoDTE ? [tipoDTE] : [33, 39, 52, 61]; // factura, boleta, guía, NC
        const resultados = {};

        for (const tipo of tipos) {
          try {
            const r = await makeRequest(`${baseUrl}/folios/consultar/disponibles`, {
              method: "POST",
              headers: authHeaders,
              body: JSON.stringify({ rutEmpresa: rutEmpresa.replace(/\./g, ''), tipoDTE: tipo, ambiente: ambienteNum })
            });
            const data = JSON.parse(r.body);
            // data puede ser número directamente, o { data: número }, o un objeto con mensaje de error
            let disponibles = null;
            if (r.status === 200) {
              if (typeof data === 'number') disponibles = data;
              else if (typeof data?.data === 'number') disponibles = data.data;
              else if (typeof data?.data === 'string' && !isNaN(Number(data.data))) disponibles = Number(data.data);
              else disponibles = 0;
            }
            const mensajeError = r.status !== 200 ? (
              r.status === 403 ? 'Sin permiso para consultar folios (plan SimpleFactura)' :
              (data?.message || data?.error || `Error ${r.status}`)
            ) : null;
            resultados[tipo] = { disponibles, ok: r.status === 200, error: mensajeError, statusCode: r.status };
          } catch (e) {
            resultados[tipo] = { disponibles: null, ok: false, error: e.message };
          }
        }
        return res.status(200).json({ success: true, folios: resultados });
      }

      if (action === "solicitar") {
        if (!tipoDTE || !cantidad || !rutEmpresa) {
          return res.status(400).json({ error: "Para solicitar folios se requiere: tipoDTE, cantidad, rutEmpresa" });
        }
        const { sucursal } = req.body;
        const r = await makeRequest(`${baseUrl}/addFolios`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            credenciales: {
              rutEmisor: rutEmpresa.replace(/\./g, ''),
              nombreSucursal: sucursal || 'Casa Matriz'
            },
            cantidad: Number(cantidad),
            codigoTipoDte: Number(tipoDTE)
          })
        });
        const data = JSON.parse(r.body);
        if (r.status !== 200) {
          return res.status(r.status).json({ error: data.message || (data.errors && data.errors[0]) || "Error solicitando folios" });
        }
        return res.status(200).json({ success: true, resultado: data.data || data });
      }

      if (action === "sin-uso") {
        if (!tipoDTE || !rutEmpresa) {
          return res.status(400).json({ error: "Se requiere tipoDTE y rutEmpresa" });
        }
        const { sucursal } = req.body;
        const r = await makeRequest(`${baseUrl}/folios/consultar/sin-uso`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            rutEmpresa: rutEmpresa,
            tipoDTE: Number(tipoDTE),
            ambiente: ambienteNum
          })
        });
        let data = {};
        try { data = JSON.parse(r.body || '{}'); } catch { data = {}; }
        console.log(`📋 sin-uso response [${r.status}]:`, JSON.stringify(data).slice(0, 300));
        if (r.status !== 200) {
          // "No hay folios para anular" o "No se encontraron timbrajes" = simplemente no hay folios sin uso
          const msg = data.data || data.message || '';
          const sinFolios = typeof msg === 'string' && (
            msg.includes('No hay folios') ||
            msg.includes('No se encontraron timbrajes') ||
            msg.includes('no tiene folios disponibles para anular') ||
            msg.includes('no tiene folios')
          );
          if (sinFolios) {
            return res.status(200).json({ success: true, foliosSinUso: [] });
          }
          return res.status(r.status).json({ error: data.message || "Error consultando folios sin uso" });
        }
        const foliosSinUso = data.data || data;
        const lista = Array.isArray(foliosSinUso) ? foliosSinUso : (foliosSinUso ? [foliosSinUso] : []);
        return res.status(200).json({ success: true, foliosSinUso: lista });
      }

      if (action === "anular") {
        const { folioInicio, folioTermino, motivoAnulacion, sucursal } = req.body;
        if (!tipoDTE || !folioInicio || !folioTermino || !rutEmpresa) {
          return res.status(400).json({ error: "Se requiere tipoDTE, folioInicio, folioTermino y rutEmpresa" });
        }
        const r = await makeRequest(`${baseUrl}/folios/anular`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            credenciales: {
              rutEmisor: rutEmpresa.replace(/\./g, ''),
              nombreSucursal: sucursal || 'Casa Matriz'
            },
            codigoTipoDte: Number(tipoDTE),
            ambiente: ambienteNum,
            FolioInicio: Number(folioInicio),
            FolioTermino: Number(folioTermino),
            motivoAnulacion: motivoAnulacion || 'Folios sin uso'
          })
        });
        let data = {};
        try { data = JSON.parse(r.body || '{}'); } catch { data = {}; }
        if (r.status !== 200) {
          return res.status(r.status).json({ error: data.message || (data.errors && data.errors[0]) || "Error anulando folios" });
        }
        return res.status(200).json({ success: true, mensaje: data.message || 'Folios anulados correctamente' });
      }

      return res.status(400).json({ error: `Acción desconocida: ${action}` });

    } catch (error) {
      console.error("❌ Error en simpleFacturaFolios:", error);
      return res.status(500).json({ error: "Internal server error", message: error.message });
    }
  });
});

exports.impersonateUser = onRequest(CORS_OPTIONS, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).send("");

  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const { targetUid, targetEmail, companyId } = req.body;
      console.log(`🔍 Impersonar request - uid: "${targetUid}", email: "${targetEmail}", companyId: "${companyId}"`);

      if (!targetUid && !targetEmail && !companyId) {
        return res.status(400).json({ error: "Missing required field: targetUid, targetEmail, or companyId" });
      }

      // Buscar usuario — primero por UID, luego email, luego por companyId claim
      let targetUser;
      try {
        if (targetUid) {
          targetUser = await admin.auth().getUser(targetUid);
        } else if (targetEmail) {
          targetUser = await admin.auth().getUserByEmail(targetEmail);
        }
      } catch (lookupErr) {
        console.log(`⚠️ Lookup directo falló: ${lookupErr.message}`);
      }

      // Si aún no encontramos usuario, buscar por companyId en custom claims
      if (!targetUser && companyId) {
        console.log(`🔍 Buscando admin por companyId: "${companyId}"`);
        const listResult = await admin.auth().listUsers(1000);
        targetUser = listResult.users.find(u => {
          const claims = u.customClaims || {};
          return claims.companyId === companyId && claims.role === "ADMIN";
        });
        if (targetUser) {
          console.log(`✅ Admin encontrado via companyId: ${targetUser.uid} (${targetUser.email})`);
        }
      }

      if (!targetUser) {
        return res.status(404).json({ error: "Usuario no encontrado para esta empresa" });
      }

      // Generar custom token usando app con credenciales explícitas (evita error iam.serviceAccounts.signBlob)
      const customToken = await adminWithCreds.auth().createCustomToken(targetUser.uid, {
        impersonated: true,
        impersonatedBy: "super-admin"
      });

      console.log(`✅ Custom token generado para impersonar: ${targetUser.uid} (${targetUser.email})`);

      return res.status(200).json({
        success: true,
        customToken,
        targetEmail: targetUser.email,
        targetUid: targetUser.uid
      });

    } catch (error) {
      console.error("❌ Error en impersonación:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: error.message
      });
    }
  });
});

// ══════════════════════════════════════════════════════
// PUSH NOTIFICATIONS — Nuevo pedido en tienda pública
// Se dispara cuando se crea un doc en companies/{cid}/orders
// ══════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════
// SCHEDULED: Verificar trials expirados — 00:00 Santiago
// ══════════════════════════════════════════════════════
exports.checkExpiredTrialsScheduled = onSchedule(
  { schedule: "0 0 * * *", timeZone: "America/Santiago", region: "us-central1" },
  async () => {
    const db = admin.firestore();
    const resend = new Resend(RESEND_API_KEY);
    const now = new Date();

    const snap = await db.collection("companies")
      .where("status", "==", "trial")
      .where("trialEndDate", "<=", admin.firestore.Timestamp.fromDate(now))
      .get();

    console.log(`⏰ Trials expirados: ${snap.size}`);

    for (const doc of snap.docs) {
      const company = doc.data();
      try {
        await doc.ref.update({
          status: "trial_expired",
          trialExpiredAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const email = company.adminEmail || company.email;
        if (email) {
          await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: "Tu período de prueba de Bodestock ha terminado",
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:30px;text-align:center;border-radius:10px 10px 0 0;">
                  <h1 style="color:white;margin:0;font-size:24px;">Trial Finalizado</h1>
                </div>
                <div style="padding:30px;background:#f9fafb;border-radius:0 0 10px 10px;">
                  <h2 style="color:#1f2937;">Hola ${company.adminName || "Admin"},</h2>
                  <p style="color:#4b5563;font-size:16px;line-height:1.6;">
                    Tu período de prueba gratuito de 30 días para <strong>${company.name}</strong> ha finalizado.
                    Tu acceso ha sido <strong>pausado temporalmente</strong>.
                  </p>
                  <p style="color:#4b5563;">Elige un plan para recuperar el acceso y no perder tus datos:</p>
                  <div style="text-align:center;margin:30px 0;">
                    <a href="https://bodestock.cl/plans"
                       style="background:linear-gradient(135deg,#3b82f6,#6366f1);color:white;padding:16px 40px;text-decoration:none;border-radius:10px;font-weight:bold;font-size:16px;display:inline-block;">
                      Ver Planes y Precios
                    </a>
                  </div>
                  <p style="color:#6b7280;font-size:14px;">¿Preguntas? Escríbenos a soporte@bodestock.cl</p>
                </div>
              </div>
            `,
          });
          console.log(`✅ Email trial expirado enviado a ${email} (${company.name})`);
        }
      } catch (e) {
        console.error(`❌ Error procesando trial expirado ${doc.id}:`, e.message);
      }
    }
  }
);

// ══════════════════════════════════════════════════════
// SCHEDULED: Recordatorios de cobro — 9:00 AM Santiago
// ══════════════════════════════════════════════════════
exports.checkUpcomingBillingsScheduled = onSchedule(
  { schedule: "0 9 * * *", timeZone: "America/Santiago", region: "us-central1" },
  async () => {
    const db = admin.firestore();
    const resend = new Resend(RESEND_API_KEY);
    const now = new Date();

    // Buscar cobros en los próximos 1-7 días
    const rangeStart = new Date(now);
    rangeStart.setDate(rangeStart.getDate() + 1);
    rangeStart.setHours(0, 0, 0, 0);

    const rangeEnd = new Date(now);
    rangeEnd.setDate(rangeEnd.getDate() + 7);
    rangeEnd.setHours(23, 59, 59, 999);

    const snap = await db.collection("companies")
      .where("status", "==", "active")
      .where("nextBillingDate", ">=", admin.firestore.Timestamp.fromDate(rangeStart))
      .where("nextBillingDate", "<=", admin.firestore.Timestamp.fromDate(rangeEnd))
      .get();

    console.log(`💳 Cobros próximos: ${snap.size}`);

    for (const doc of snap.docs) {
      const company = doc.data();
      try {
        // No reenviar si ya se mandó recordatorio para este ciclo (menos de 25 días)
        if (company.lastBillingReminderDate) {
          const last = company.lastBillingReminderDate.toDate
            ? company.lastBillingReminderDate.toDate()
            : new Date(company.lastBillingReminderDate);
          if ((now - last) / (1000 * 60 * 60 * 24) < 25) {
            console.log(`⏭️  Ya enviado recientemente: ${company.name}`);
            continue;
          }
        }

        const billingDate = company.nextBillingDate.toDate
          ? company.nextBillingDate.toDate()
          : new Date(company.nextBillingDate);

        const daysLeft = Math.ceil((billingDate - now) / (1000 * 60 * 60 * 24));
        const amount = company.monthlyAmount || 0;
        const formatted = new Intl.NumberFormat("es-CL", {
          style: "currency", currency: "CLP", minimumFractionDigits: 0,
        }).format(amount);

        const email = company.adminEmail || company.email;
        if (!email) continue;

        await resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          subject: `Recordatorio de pago: ${formatted} en ${daysLeft} día${daysLeft !== 1 ? "s" : ""}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:30px;text-align:center;border-radius:10px 10px 0 0;">
                <h1 style="color:white;margin:0;font-size:24px;">Recordatorio de Pago</h1>
              </div>
              <div style="padding:30px;background:#f9fafb;border-radius:0 0 10px 10px;">
                <h2 style="color:#1f2937;">Hola ${company.adminName || "Admin"},</h2>
                <p style="color:#4b5563;font-size:16px;line-height:1.6;">
                  En <strong>${daysLeft} día${daysLeft !== 1 ? "s" : ""}</strong> se realizará el cobro mensual de
                  <strong>${company.name}</strong>.
                </p>
                <div style="background:linear-gradient(135deg,#10b981,#059669);color:white;padding:24px;border-radius:12px;margin:25px 0;text-align:center;">
                  <p style="margin:0 0 6px;font-size:14px;opacity:0.9;">Monto a cobrar</p>
                  <p style="font-size:36px;font-weight:bold;margin:0 0 6px;">${formatted}</p>
                  <p style="margin:0;font-size:14px;opacity:0.85;">
                    Fecha: ${billingDate.toLocaleDateString("es-CL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
                <div style="text-align:center;margin:30px 0;">
                  <a href="https://bodestock.cl/plans"
                     style="background:linear-gradient(135deg,#3b82f6,#6366f1);color:white;padding:16px 40px;text-decoration:none;border-radius:10px;font-weight:bold;font-size:16px;display:inline-block;">
                    💳 Pagar ahora
                  </a>
                </div>
                <p style="color:#6b7280;font-size:14px;text-align:center;">
                  ¿Consultas? soporte@bodestock.cl
                </p>
              </div>
            </div>
          `,
        });

        await doc.ref.update({
          lastBillingReminderDate: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`✅ Recordatorio enviado: ${company.name} (${email}) — ${daysLeft} días`);
      } catch (e) {
        console.error(`❌ Error recordatorio ${doc.id}:`, e.message);
      }
    }
  }
);

// ══════════════════════════════════════════════════════
// SCHEDULED: Bloquear empresas con billing vencido — 01:00 Santiago
// ══════════════════════════════════════════════════════
exports.checkExpiredBillingsScheduled = onSchedule(
  { schedule: "0 1 * * *", timeZone: "America/Santiago", region: "us-central1" },
  async () => {
    const db = admin.firestore();
    const resend = new Resend(RESEND_API_KEY);
    const now = new Date();

    // Empresas activas con nextBillingDate vencido hace más de 2 días (período de gracia)
    const graceCutoff = new Date(now);
    graceCutoff.setDate(graceCutoff.getDate() - 2);

    const snap = await db.collection("companies")
      .where("status", "==", "active")
      .where("nextBillingDate", "<=", admin.firestore.Timestamp.fromDate(graceCutoff))
      .get();

    // Filtrar solo planes de pago (no free/trial)
    const payingCompanies = snap.docs.filter(d => {
      const plan = d.data().plan;
      return plan && plan !== "free" && plan !== "trial";
    });

    console.log(`🔒 Empresas a bloquear por billing vencido: ${payingCompanies.length}`);

    for (const doc of payingCompanies) {
      const company = doc.data();
      try {
        await doc.ref.update({
          status: "billing_expired",
          billingExpiredAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const email = company.adminEmail || company.email;
        if (email) {
          await resend.emails.send({
            from: FROM_EMAIL,
            to: email,
            subject: "Tu suscripción Bodestock está vencida — Renueva para continuar",
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:30px;text-align:center;border-radius:10px 10px 0 0;">
                  <h1 style="color:white;margin:0;font-size:24px;">Suscripción Vencida</h1>
                </div>
                <div style="padding:30px;background:#f9fafb;border-radius:0 0 10px 10px;">
                  <h2 style="color:#1f2937;">Hola ${company.adminName || "Admin"},</h2>
                  <p style="color:#4b5563;font-size:16px;line-height:1.6;">
                    La suscripción de <strong>${company.name}</strong> ha vencido y el acceso ha sido pausado.
                    Tus datos están seguros — solo necesitas renovar para continuar.
                  </p>
                  <div style="text-align:center;margin:30px 0;">
                    <a href="https://bodestock.cl/plans"
                       style="background:linear-gradient(135deg,#ef4444,#dc2626);color:white;padding:16px 40px;text-decoration:none;border-radius:10px;font-weight:bold;font-size:16px;display:inline-block;">
                      🔓 Renovar suscripción
                    </a>
                  </div>
                  <p style="color:#6b7280;font-size:14px;text-align:center;">¿Necesitas ayuda? soporte@bodestock.cl</p>
                </div>
              </div>
            `,
          });
        }
        console.log(`✅ Empresa bloqueada y notificada: ${company.name}`);
      } catch (e) {
        console.error(`❌ Error bloqueando empresa ${doc.id}:`, e.message);
      }
    }
  }
);

// ══════════════════════════════════════════════════════
// Genera el HTML del email de alerta de stock bajo.
// Adaptado de src/services/notification-service.js (generateLowStockEmailHTML) —
// ese archivo usa el SDK cliente de Firebase, este entorno usa el Admin SDK,
// así que la función se porta como JS plano (solo recibe datos, no toca Firestore).
// ══════════════════════════════════════════════════════
function generateLowStockEmailHTML(products, companyName) {
  const productRows = products.map(product => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; font-weight: 500;">${product.name || "Sin nombre"}</td>
      <td style="padding: 12px; text-align: center;">${product.inventoryName || "—"}</td>
      <td style="padding: 12px; text-align: center; color: ${product.stock <= 2 ? "#ef4444" : "#f59e0b"}; font-weight: bold;">
        ${product.stock} ${product.unit || "unidades"}
      </td>
      <td style="padding: 12px;">${product.category || "Sin categoría"}</td>
    </tr>
  `).join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Alerta de Stock Bajo</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #1f2937 0%, #ea580c 100%); border-radius: 10px;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🚨 Alerta de Stock Bajo</h1>
        <p style="color: #f3f4f6; margin: 10px 0 0 0;">${companyName}</p>
      </div>
      <div style="margin-bottom: 25px;">
        <p style="font-size: 16px; margin-bottom: 15px;">
          <strong>Atención:</strong> Se han detectado <strong style="color: #ea580c;">${products.length}</strong>
          ${products.length === 1 ? "producto" : "productos"} con stock bajo.
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          Es recomendable revisar estos productos y considerar realizar pedidos de reposición.
        </p>
      </div>
      <div style="margin-bottom: 25px; overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 15px; text-align: left; font-weight: 600; color: #374151;">Producto</th>
              <th style="padding: 15px; text-align: center; font-weight: 600; color: #374151;">Inventario</th>
              <th style="padding: 15px; text-align: center; font-weight: 600; color: #374151;">Stock</th>
              <th style="padding: 15px; text-align: left; font-weight: 600; color: #374151;">Categoría</th>
            </tr>
          </thead>
          <tbody>
            ${productRows}
          </tbody>
        </table>
      </div>
      <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #ea580c; margin-bottom: 25px;">
        <h3 style="margin: 0 0 10px 0; color: #ea580c;">📋 Acciones Recomendadas:</h3>
        <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
          <li>Revisar proveedores para estos productos</li>
          <li>Verificar tiempos de entrega</li>
          <li>Considerar aumentar stock de seguridad</li>
        </ul>
      </div>
      <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
        <p>📅 ${new Date().toLocaleDateString("es-CL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        <p>🤖 Este es un mensaje automático del sistema de gestión de inventario.</p>
        <p style="margin-top: 15px;"><strong>${companyName}</strong> | Bodestock</p>
      </div>
    </body>
    </html>
  `;
}

// ══════════════════════════════════════════════════════
// SCHEDULED: Alerta de stock bajo — 8:00 AM Santiago
// Revisa el inventario legacy y todos los inventarios nuevos de cada empresa.
// ══════════════════════════════════════════════════════
exports.checkLowStockScheduled = onSchedule(
  { schedule: "0 8 * * *", timeZone: "America/Santiago", region: "us-central1" },
  async () => {
    const db = admin.firestore();
    const resend = new Resend(RESEND_API_KEY);
    const now = new Date();

    const snap = await db.collection("companies").get();
    console.log(`📦 Revisando stock bajo en ${snap.size} empresas`);

    for (const doc of snap.docs) {
      const company = doc.data();
      const companyId = doc.id;

      try {
        // Anti-spam: no repetir antes de 24h desde el último envío exitoso
        if (company.lastLowStockAlertSent) {
          const last = company.lastLowStockAlertSent.toDate
            ? company.lastLowStockAlertSent.toDate()
            : new Date(company.lastLowStockAlertSent);
          if ((now - last) / (1000 * 60 * 60) < 24) {
            continue;
          }
        }

        // Destinatario: override de super-admin > email configurado en settings/notifications
        const notifSnap = await db.doc(`companies/${companyId}/settings/notifications`).get();
        const notifSettings = notifSnap.exists ? notifSnap.data() : {};

        if (notifSettings.lowStockAlerts === false) continue;

        const recipientEmail = (company.notificationEmail || "").trim() || notifSettings.email?.address;
        if (!recipientEmail) continue;

        // Umbral configurado (mismo criterio que notification-service.js: stock <= threshold && stock > 0)
        const invSettingsSnap = await db.doc(`companies/${companyId}/settings/inventory`).get();
        const invSettings = invSettingsSnap.exists ? invSettingsSnap.data() : {};
        const threshold = invSettings.lowStockThreshold ?? notifSettings.email?.threshold ?? 5;

        const lowStockProducts = [];

        // 1. Inventario legacy
        const legacySnap = await db.collection(`companies/${companyId}/inventory`)
          .where("stock", "<=", threshold)
          .where("stock", ">", 0)
          .get();
        legacySnap.forEach(p => lowStockProducts.push({ ...p.data(), inventoryName: "Principal" }));

        // 2. Todos los inventarios nuevos
        const inventoriesSnap = await db.collection(`companies/${companyId}/inventories`).get();
        for (const invDoc of inventoriesSnap.docs) {
          const invId = invDoc.id;

          let invName = invId;
          const metadataSnap = await db.collection(`companies/${companyId}/inventories/${invId}/metadata`).get();
          if (!metadataSnap.empty) {
            invName = metadataSnap.docs[0].data().name || invId;
          }

          const productsSnap = await db.collection(`companies/${companyId}/inventories/${invId}/products`)
            .where("stock", "<=", threshold)
            .where("stock", ">", 0)
            .get();
          productsSnap.forEach(p => lowStockProducts.push({ ...p.data(), inventoryName: invName }));
        }

        if (lowStockProducts.length === 0) continue;

        await resend.emails.send({
          from: FROM_EMAIL,
          to: recipientEmail,
          subject: `🚨 Alerta de Stock Bajo - ${lowStockProducts.length} producto${lowStockProducts.length !== 1 ? "s" : ""}`,
          html: generateLowStockEmailHTML(lowStockProducts, company.name || "Tu empresa"),
        });

        // Actualizar el timestamp recién después del envío exitoso
        await doc.ref.update({
          lastLowStockAlertSent: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`✅ Alerta de stock bajo enviada a ${recipientEmail} (${company.name}) — ${lowStockProducts.length} productos`);
      } catch (e) {
        console.error(`❌ Error revisando stock de ${companyId}:`, e.message);
      }
    }
  }
);

/**
 * HTML del correo que recibe el NEGOCIO cuando llega un pedido nuevo de su
 * tienda pública -- mismo estilo que generateLowStockEmailHTML, para que
 * los correos automáticos de Bodestock se vean consistentes entre sí.
 */
function generateNewOrderEmailHTML(order, orderId, companyName) {
  const itemRows = (order.items || []).map(item => {
    const cantidad = item.byWeight ? `~${item.requestedGrams}g` : `${item.qty}x`;
    const precio = item.byWeight
      ? "a pesar"
      : new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format((item.price || 0) * (item.qty || 0));
    return `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; font-weight: 500;">${item.name || "Producto"}</td>
      <td style="padding: 12px; text-align: center;">${cantidad}</td>
      <td style="padding: 12px; text-align: right;">${precio}</td>
    </tr>`;
  }).join("");

  const total = order.subtotal
    ? new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(order.subtotal)
    : "—";

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Nuevo pedido</title></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #1f2937 0%, #2563eb 100%); border-radius: 10px;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🛒 Nuevo pedido</h1>
        <p style="color: #f3f4f6; margin: 10px 0 0 0;">${companyName}</p>
      </div>
      <div style="margin-bottom: 25px;">
        <p style="font-size: 16px; margin-bottom: 4px;"><strong>Cliente:</strong> ${order.clientName || "Cliente"}</p>
        ${order.clientPhone ? `<p style="font-size: 16px; margin-bottom: 4px;"><strong>Teléfono:</strong> ${order.clientPhone}</p>` : ""}
        <p style="font-size: 14px; color: #6b7280;">Pedido #${orderId.slice(-6).toUpperCase()}</p>
      </div>
      <div style="margin-bottom: 25px; overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 15px; text-align: left; font-weight: 600; color: #374151;">Producto</th>
              <th style="padding: 15px; text-align: center; font-weight: 600; color: #374151;">Cantidad</th>
              <th style="padding: 15px; text-align: right; font-weight: 600; color: #374151;">Precio</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </div>
      <div style="background: #f9fafb; padding: 16px 20px; border-radius: 8px; border-left: 4px solid #2563eb; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center;">
        <strong style="color: #1f2937;">Total</strong>
        <strong style="color: #2563eb; font-size: 18px;">${total}</strong>
      </div>
      <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
        <p>🤖 Este es un mensaje automático. Entra a Bodestock → Pedidos para gestionarlo.</p>
        <p style="margin-top: 15px;"><strong>${companyName}</strong> | Bodestock</p>
      </div>
    </body>
    </html>
  `;
}

exports.onOrderCreated = onDocumentCreated(
  "companies/{companyId}/orders/{orderId}",
  async (event) => {
    const order = event.data?.data();
    const { companyId, orderId } = event.params;

    if (!order || order.source !== "tienda_publica") return;

    const db = admin.firestore();

    // Push y correo son independientes -- antes, sin tokens FCM
    // registrados (el negocio nunca aceptó el permiso de notificaciones
    // del navegador), la función cortaba acá mismo y el correo ni se
    // intentaba. El negocio podía no enterarse NUNCA de un pedido nuevo si
    // no tenía la pestaña de Pedidos abierta en ese momento.
    const [tokensSnap, companySnap] = await Promise.all([
      db.collection(`companies/${companyId}/fcm_tokens`).get(),
      db.doc(`companies/${companyId}`).get(),
    ]);

    const itemCount = order.items?.length || 0;
    const clientName = order.clientName || "Cliente";
    const total = order.subtotal
      ? new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 }).format(order.subtotal)
      : "";

    // ---- Push (si hay tokens registrados) ----
    const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean);
    if (tokens.length > 0) {
      const message = {
        notification: {
          title: `🛒 Nuevo pedido — ${clientName}`,
          body: `${itemCount} producto${itemCount !== 1 ? "s" : ""}${total ? " · " + total : ""} · #${orderId.slice(-6).toUpperCase()}`,
        },
        data: { url: "/pedidos-caja", orderId, companyId },
        tokens,
        android: { priority: "high", notification: { sound: "default", channelId: "pedidos" } },
        apns: { payload: { aps: { sound: "default", badge: 1 } } },
      };

      try {
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`✅ Push enviado: ${response.successCount} ok, ${response.failureCount} fallidos`);

        const toDelete = [];
        response.responses.forEach((r, i) => {
          if (!r.success && (
            r.error?.code === "messaging/invalid-registration-token" ||
            r.error?.code === "messaging/registration-token-not-registered"
          )) {
            toDelete.push(tokensSnap.docs[i].ref);
          }
        });
        await Promise.all(toDelete.map(ref => ref.delete()));
      } catch (e) {
        console.error("❌ Error enviando push:", e);
      }
    } else {
      console.log(`ℹ️  Sin tokens FCM para empresa ${companyId}, se intenta solo correo`);
    }

    // ---- Correo (fuente de verdad: siempre se intenta si hay destinatario) ----
    const company = companySnap.exists ? companySnap.data() : {};
    const notifSnap = await db.doc(`companies/${companyId}/settings/notifications`).get();
    const notifSettings = notifSnap.exists ? notifSnap.data() : {};
    const recipientEmail = (company.notificationEmail || "").trim() || notifSettings.email?.address;

    if (!recipientEmail) {
      console.log(`ℹ️  Empresa ${companyId} sin correo de notificaciones configurado`);
      return;
    }

    try {
      const resend = new Resend(RESEND_API_KEY);
      await resend.emails.send({
        from: FROM_EMAIL,
        to: recipientEmail,
        subject: `🛒 Nuevo pedido de ${clientName} — ${total || "ver detalle"}`,
        html: generateNewOrderEmailHTML(order, orderId, company.name || "Tu empresa"),
      });
      console.log(`✅ Correo de pedido nuevo enviado a ${recipientEmail}`);
    } catch (e) {
      console.error("❌ Error enviando correo de pedido nuevo:", e);
    }
  }
);

/**
 * HTML del correo que recibe el CLIENTE cuando su pedido de la tienda
 * pública cambia de estado (aprobado/en camino/entregado/rechazado) --
 * mismo estilo que los demás correos automáticos de Bodestock.
 *
 * El mensaje de APPROVED depende de order.deliveryMethod: para retiro ya es
 * el estado final ("pasa a buscarlo"), pero para despacho todavía falta el
 * tramo de entrega -- decirle "pasa a retirarlo" a alguien que pidió
 * despacho es el bug que se reportó (el cliente nunca recibe aviso real de
 * que el pedido salió, porque antes DELIVERING/DELIVERED no mandaban correo).
 */
function generateOrderStatusEmailHTML(order, orderId, companyName, status) {
  const isDelivery = order.deliveryMethod === "delivery";
  const CONFIG = {
    APPROVED: {
      color: "#16a34a",
      title: isDelivery ? "✅ Tu pedido fue confirmado" : "✅ Tu pedido está listo",
      message: isDelivery
        ? "Lo estamos preparando para despacharlo a tu dirección. Te avisamos apenas salga en camino."
        : "Pasa a retirarlo cuando quieras.",
    },
    DELIVERING: {
      color: "#4f46e5",
      title: "🏍️ Tu pedido va en camino",
      message: order.deliveryAddress ? `Va para: ${order.deliveryAddress}` : "Ya salió del local.",
    },
    DELIVERED: {
      color: "#0d9488",
      title: "📦 Tu pedido fue entregado",
      message: "Gracias por tu compra.",
    },
    REJECTED: {
      color: "#dc2626",
      title: "❌ Tu pedido fue rechazado",
      message: order.rejectionReason ? `Motivo: ${order.rejectionReason}` : "Contacta al negocio si tienes dudas.",
    },
  };
  const { color: headerColor, title, message } = CONFIG[status] || CONFIG.REJECTED;

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>${title}</title></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px; padding: 20px; background: ${headerColor}; border-radius: 10px;">
        <h1 style="color: white; margin: 0; font-size: 22px;">${title}</h1>
        <p style="color: #f3f4f6; margin: 10px 0 0 0;">${companyName}</p>
      </div>
      <div style="margin-bottom: 25px; text-align: center;">
        <p style="font-size: 16px;">Pedido <strong>#${orderId.slice(-6).toUpperCase()}</strong></p>
        <p style="color: #6b7280;">${message}</p>
      </div>
      <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
        <p>🤖 Este es un mensaje automático de ${companyName} vía Bodestock.</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Descuenta stock por un pedido de la tienda pública recién aprobado y deja
 * registro en inventory_exits (reason: SALE) para que aparezca en los
 * reportes igual que una venta del POS (ver InventoryExitsReport.jsx, que
 * suma exit.totalValue de exits con reason === 'SALE').
 *
 * Corre server-side (no reusa registerInventoryExit del cliente, que exige
 * un usuario autenticado vía getUserCompanyId() -- el checkout de la tienda
 * pública es siempre anónimo). Usa una transacción para que la verificación
 * de stock y el descuento sean atómicos, igual que el servicio del cliente.
 *
 * Idempotente: marca el pedido con stockDeducted=true y lo chequea antes de
 * descontar, porque un trigger de Firestore puede reintentar/reentregar el
 * mismo evento.
 */
// Misma tabla de conversión que src/utils/unitConversions.js (peso/volumen
// -- lo único que ProductoElaboradoModal.jsx realmente ofrece elegir en una
// receta). Duplicada acá porque las Cloud Functions no pueden importar
// módulos ES del frontend. La receta puede pedir el ingrediente en una
// unidad distinta a la del stock (ej. receta en "g", insumo en "kg" -- ver
// unidad/unidadStock en ProductoElaboradoModal.jsx); sin convertir, comparar
// o descontar la cantidad cruda contra el stock real rompe el descuento.
const RECIPE_UNIT_FACTORS = { g: 1, kg: 1000, ml: 1, l: 1000 };
function convertRecipeQty(value, fromUnit, toUnit) {
  const from = RECIPE_UNIT_FACTORS[fromUnit];
  const to = RECIPE_UNIT_FACTORS[toUnit];
  if (!from || !to) return value; // unidad no convertible (ej. "unidad") -- se usa tal cual
  return (value * from) / to;
}

async function deductStockForOrder(companyId, orderId, order) {
  const db = admin.firestore();

  const getProductRef = (productId) => order.inventoryId
    ? db.doc(`companies/${companyId}/inventories/${order.inventoryId}/products/${productId}`)
    : db.doc(`companies/${companyId}/inventory/${productId}`);

  try {
    await db.runTransaction(async (tx) => {
      const orderRef = db.doc(`companies/${companyId}/orders/${orderId}`);
      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists || orderSnap.data().stockDeducted) return;

      // Firestore exige que TODAS las lecturas de la transacción ocurran
      // antes de cualquier escritura -- no alcanza con leer antes de escribir
      // ref por ref, el SDK lo valida a nivel de toda la transacción. Por eso
      // se resuelven primero los productos, DESPUÉS (recién con productData
      // ya disponible, para saber qué es ELABORADO) los insumos de receta, y
      // solo al final se emite cualquier tx.update/tx.set.
      const items = order.items || [];
      const productRefs = items.map((it) => getProductRef(it.productId));
      const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));

      const insumoReadsByItem = await Promise.all(items.map(async (item, i) => {
        const snap = productSnaps[i];
        if (!snap.exists) return [];
        const productData = snap.data();
        if (productData.productType !== "ELABORADO" || !productData.receta?.length) return [];
        return Promise.all(productData.receta.map(async (ingrediente) => {
          const insumoRef = getProductRef(ingrediente.insumoId);
          const insumoSnap = await tx.get(insumoRef);
          return { ingrediente, insumoRef, insumoSnap };
        }));
      }));

      const exitRef = db.collection(`companies/${companyId}/inventory_exits`).doc();
      const exitProducts = [];
      let totalValue = 0;
      let totalUnits = 0;

      // workerId/workerName son los campos que InventoryExitsReport.jsx
      // agrupa como "trabajador que hizo la salida" -- un pedido de la
      // tienda online no tiene trabajador, así que iba el NOMBRE DEL
      // CLIENTE ahí, que el reporte entonces mostraba como si fuera un
      // trabajador ("luis" agrupando ventas). El cliente va en
      // customerName (mismo campo que usa el flujo CREDIT para fiados),
      // y workerName identifica la tienda online como origen.
      const exitSourceLabel = "🛒 Tienda online";

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const snap = productSnaps[i];
        if (!snap.exists) {
          console.warn(`⚠️ Producto ${item.productId} (${item.name}) no encontrado, se omite del descuento de stock`);
          continue;
        }
        const productData = snap.data();
        const quantity = item.byWeight ? (item.confirmedGrams ?? item.requestedGrams ?? 0) / 1000 : (item.qty || 0);
        const unitValue = item.byWeight ? (item.pricePerKg || 0) : (item.price || 0);
        const itemTotalValue = item.byWeight ? (item.confirmedPrice ?? 0) : (unitValue * (item.qty || 0));

        if (productData.productType === "ELABORADO" && productData.receta?.length > 0) {
          const cantidadPorInsumo = Number(item.qty || 1);
          for (const { ingrediente, insumoRef, insumoSnap } of insumoReadsByItem[i]) {
            if (!insumoSnap.exists) continue;
            const cantidadEnUnidadStock = convertRecipeQty(
              Number(ingrediente.cantidad) || 0,
              ingrediente.unidad,
              ingrediente.unidadStock || ingrediente.unidad
            );
            const cantidadNecesaria = cantidadEnUnidadStock * cantidadPorInsumo;
            const insumoData = insumoSnap.data();
            tx.update(insumoRef, {
              stock: admin.firestore.FieldValue.increment(-cantidadNecesaria),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              history: [...(insumoData.history || []), {
                id: Date.now().toString(36) + ingrediente.insumoId,
                date: new Date().toISOString(),
                type: "exit",
                quantity: -cantidadNecesaria,
                reason: "PRODUCTION",
                reasonName: `Elaboración: ${item.name}`,
                exitId: exitRef.id,
                workerId: "tienda_publica",
                workerName: exitSourceLabel,
              }],
            });
          }
        } else {
          tx.update(productRefs[i], {
            stock: admin.firestore.FieldValue.increment(-quantity),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            history: [...(productData.history || []), {
              id: Date.now().toString(36) + item.productId,
              date: new Date().toISOString(),
              type: "exit",
              quantity: -quantity,
              reason: "SALE",
              reasonName: "Venta",
              exitId: exitRef.id,
              workerId: "tienda_publica",
              workerName: exitSourceLabel,
              notes: `Pedido #${orderId.slice(-6).toUpperCase()} de la tienda online`,
            }],
          });
        }

        exitProducts.push({
          productId: item.productId,
          productName: item.name,
          quantity,
          unit: item.byWeight ? (productData.priceUnit || "kg") : (productData.unit || "un"),
          unitValue,
          totalValue: itemTotalValue,
          productType: productData.productType || "SIMPLE",
        });
        totalValue += itemTotalValue;
        totalUnits += quantity;
      }

      tx.set(exitRef, {
        id: exitRef.id,
        source: "tienda_publica",
        orderId,
        inventoryId: order.inventoryId || null,
        products: exitProducts,
        totalValue,
        totalUnits,
        totalProducts: exitProducts.length,
        reason: "SALE",
        reasonName: "Venta",
        paymentMethod: order.paymentStatus === "approved" ? "MERCADOPAGO" : "CASH",
        // workerId/workerName identifican el ORIGEN de la venta (acá: la
        // tienda online, no una persona) -- el nombre del cliente va en
        // customerName, igual que en el flujo CREDIT de InventoryExit.jsx.
        // Antes esto ponía el nombre del cliente en workerName, y
        // InventoryExitsReport.jsx agrupa exits por "trabajador" usando ese
        // campo, así que cada cliente de la tienda aparecía como si fuera
        // un trabajador distinto vendiéndose a sí mismo.
        workerId: "tienda_publica",
        workerName: "🛒 Tienda online",
        customerName: order.clientName || "Cliente",
        notes: `Pedido #${orderId.slice(-6).toUpperCase()} de la tienda online`,
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.update(orderRef, { stockDeducted: true });
    });
    console.log(`✅ Stock descontado y venta registrada para pedido ${orderId}`);
  } catch (e) {
    console.error(`❌ Error descontando stock para pedido ${orderId}:`, e);
  }
}

/**
 * Reacciona a cambios de estado en pedidos de la tienda pública:
 * - APPROVED: descuenta stock y registra la venta en inventory_exits
 *   (deductStockForOrder), y avisa por correo al CLIENTE.
 * - DELIVERING / DELIVERED: tramo de despacho (solo pedidos deliveryMethod
 *   === 'delivery', ver OrdersManagement.jsx), avisa por correo al CLIENTE.
 * - REJECTED: avisa por correo al CLIENTE que fue rechazado.
 * Solo dispara en pedidos de source "tienda_publica" y el correo solo si el
 * cliente dejó su email en el checkout (clientEmail, ver PublicStore.jsx --
 * campo obligatorio en el checkout).
 *
 * Endpoint: trigger de Firestore, no HTTP.
 */
exports.onOrderUpdated = onDocumentUpdated(
  "companies/{companyId}/orders/{orderId}",
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const { companyId, orderId } = event.params;

    if (!before || !after) return;
    if (after.source !== "tienda_publica") return;
    if (before.status === after.status) return; // solo nos interesa el cambio de estado

    if (after.status === "APPROVED" && !after.stockDeducted) {
      await deductStockForOrder(companyId, orderId, after);
    }

    const NOTIFY_STATUSES = ["APPROVED", "DELIVERING", "DELIVERED", "REJECTED"];
    if (!NOTIFY_STATUSES.includes(after.status)) return;

    const recipientEmail = (after.clientEmail || "").trim();
    if (!recipientEmail) return;

    const db = admin.firestore();
    const companySnap = await db.doc(`companies/${companyId}`).get();
    const companyName = companySnap.exists ? (companySnap.data().name || "Tu tienda") : "Tu tienda";

    const SUBJECTS = {
      APPROVED: after.deliveryMethod === "delivery" ? "fue confirmado" : "está listo",
      DELIVERING: "va en camino",
      DELIVERED: "fue entregado",
      REJECTED: "fue rechazado",
    };

    try {
      const resend = new Resend(RESEND_API_KEY);
      await resend.emails.send({
        // El dominio técnico (noreply@bodestock.cl) tiene que quedarse --
        // es el único verificado con SPF/DKIM en Resend, cambiarlo por
        // dominio del negocio requeriría que cada empresa lo verifique
        // aparte. Pero el NOMBRE que se ve si cambia: este correo lo recibe
        // el CLIENTE FINAL de cada tienda, y tiene que sentir que le llega
        // del negocio donde compró, no de "Bodestock" (la plataforma).
        from: `${companyName.replace(/[<>"]/g, "")} <noreply@bodestock.cl>`,
        to: recipientEmail,
        subject: `Tu pedido #${orderId.slice(-6).toUpperCase()} ${SUBJECTS[after.status]}`,
        html: generateOrderStatusEmailHTML(after, orderId, companyName, after.status),
      });
      console.log(`✅ Correo de estado de pedido enviado a ${recipientEmail} (${after.status})`);
    } catch (e) {
      console.error("❌ Error enviando correo de estado de pedido:", e);
    }
  }
);

/**
 * Emite una API key TEMPORAL de Deepgram (corta duración, un solo uso de
 * sesión) para que el navegador pueda abrir el WebSocket de transcripción
 * en tiempo real sin exponer nunca la key maestra.
 *
 * Requiere:
 *  - Authorization: Bearer <Firebase ID token> del usuario logueado
 *  - Secret DEEPGRAM_API_KEY y DEEPGRAM_PROJECT_ID configurados (nunca hardcodeados)
 *
 * Endpoint: POST /getDeepgramToken
 */
exports.getDeepgramToken = onRequest(
  { ...CORS_OPTIONS, secrets: ["DEEPGRAM_API_KEY", "DEEPGRAM_PROJECT_ID"] },
  async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      // Verificar que quien pide el token es un usuario autenticado de Bodestock
      const authHeader = req.headers.authorization || "";
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!idToken) {
        return res.status(401).json({ error: "Falta Authorization Bearer token" });
      }
      try {
        await admin.auth().verifyIdToken(idToken);
      } catch {
        return res.status(401).json({ error: "Token inválido" });
      }

      const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
      const DEEPGRAM_PROJECT_ID = process.env.DEEPGRAM_PROJECT_ID;
      if (!DEEPGRAM_API_KEY || !DEEPGRAM_PROJECT_ID) {
        return res.status(500).json({ error: "Deepgram no está configurado en el servidor" });
      }

      // Crea una key temporal de 60 segundos de vida, de un solo uso de sesión.
      // Reintenta una vez si la conexión se corta (socket hang up / ECONNRESET),
      // que ocurre de forma esporádica y no indica un problema real de config.
      const deepgramRequest = () => makeRequest(
        `https://api.deepgram.com/v1/projects/${DEEPGRAM_PROJECT_ID}/keys`,
        {
          method: "POST",
          headers: {
            "Authorization": `Token ${DEEPGRAM_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            comment: "bodestock-voice-session",
            scopes: ["usage:write"],
            time_to_live_in_seconds: 60
          })
        }
      );

      let response;
      try {
        response = await deepgramRequest();
      } catch (networkError) {
        console.warn("⚠️ Falló la primera llamada a Deepgram, reintentando:", networkError.message);
        response = await deepgramRequest();
      }

      if (response.status >= 400) {
        console.error("❌ Error creando temporary key de Deepgram:", response.body);
        return res.status(502).json({ error: "No se pudo crear la sesión de voz" });
      }

      const data = JSON.parse(response.body);
      return res.status(200).json({ key: data.key });

    } catch (error) {
      console.error("❌ Error en getDeepgramToken:", error);
      return res.status(500).json({ error: "Internal server error", message: error.message });
    }
  });
  }
);

// Cadenas grandes de supermercados/conveniencia en Chile — se excluyen por
// defecto de los resultados de prospección porque no son clientes típicos
// de una distribuidora chica (compran directo a proveedores grandes).
// Comparación insensible a mayúsculas/tildes contra el nombre del lugar.
const KNOWN_CHAINS = [
  "jumbo", "lider", "líder", "santa isabel", "unimarc", "tottus",
  "ekono", "ok market", "okmarket", "mayorista 10", "acuenta", "a cuenta",
  "montserrat", "super bodega", "superbodega", "alvi", "erbi",
  "walmart", "cencosud", "smu"
];

function isKnownChain(placeName) {
  const normalized = (placeName || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, ""); // quita tildes
  return KNOWN_CHAINS.some(chain => {
    const normalizedChain = chain.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return normalized.includes(normalizedChain);
  });
}

/**
 * Busca negocios cercanos (minimarkets, almacenes, etc.) usando Google Places
 * API (New) — Nearby Search. La key maestra vive solo en el servidor (secret),
 * el navegador nunca la ve.
 *
 * Requiere:
 *  - Authorization: Bearer <Firebase ID token> del usuario logueado
 *  - Secret GOOGLE_PLACES_API_KEY configurado
 *
 * Body: { latitude, longitude, radiusMeters (default 3000), includedTypes: string[],
 *         excludeChains (default true) }
 * Endpoint: POST /searchNearbyBusinesses
 */
exports.searchNearbyBusinesses = onRequest(
  { ...CORS_OPTIONS, secrets: ["GOOGLE_PLACES_API_KEY"] },
  async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || "";
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!idToken) {
        return res.status(401).json({ error: "Falta Authorization Bearer token" });
      }
      try {
        await admin.auth().verifyIdToken(idToken);
      } catch {
        return res.status(401).json({ error: "Token inválido" });
      }

      const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
      if (!GOOGLE_PLACES_API_KEY) {
        return res.status(500).json({ error: "Google Places no está configurado en el servidor" });
      }

      let { latitude, longitude, radiusMeters, includedTypes, locationText } = req.body || {};

      // Si viene texto de ubicación (comuna/dirección) en vez de coordenadas,
      // se resuelve con Geocoding API — NO con Places Text Search, que busca
      // negocios/lugares específicos y puede devolver resultados ambiguos o
      // lejanos para nombres de comunas (ej. "Santiago Centro" resolviendo a
      // un mall en otra comuna). Geocoding está hecha para direcciones/zonas.
      // Se agrega ", Chile" si no viene ya, para reducir ambigüedad con
      // ciudades homónimas de otros países.
      if ((typeof latitude !== "number" || typeof longitude !== "number") && locationText) {
        const query = /chile/i.test(locationText) ? locationText : `${locationText}, Chile`;
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_PLACES_API_KEY}`;
        const geocodeRequest = () => makeRequest(geocodeUrl, { method: "GET" });

        let geoResponse;
        try {
          geoResponse = await geocodeRequest();
        } catch (networkError) {
          console.warn("⚠️ Falló geocodificación, reintentando:", networkError.message);
          geoResponse = await geocodeRequest();
        }

        if (geoResponse.status >= 400) {
          console.error("❌ Error geocodificando:", geoResponse.body);
          return res.status(502).json({ error: "No se pudo ubicar esa dirección/comuna" });
        }

        const geoData = JSON.parse(geoResponse.body);
        if (geoData.status !== "OK" || !geoData.results?.[0]) {
          console.error("❌ Geocoding sin resultados:", geoData.status, geoData.error_message);
          return res.status(404).json({ error: `No se encontró "${locationText}". Prueba con otra comuna o dirección más específica.` });
        }

        const geoLocation = geoData.results[0].geometry.location;
        console.log(`📍 "${locationText}" geocodificado a: ${geoData.results[0].formatted_address} (${geoLocation.lat}, ${geoLocation.lng})`);

        latitude = geoLocation.lat;
        longitude = geoLocation.lng;
      }

      if (typeof latitude !== "number" || typeof longitude !== "number") {
        return res.status(400).json({ error: "Falta latitude/longitude o locationText" });
      }
      const radius = Math.min(Math.max(Number(radiusMeters) || 3000, 100), 50000); // Places limita a 50km
      const types = Array.isArray(includedTypes) && includedTypes.length > 0
        ? includedTypes
        : ["convenience_store", "grocery_store"];

      const placesRequest = () => makeRequest(
        "https://places.googleapis.com/v1/places:searchNearby",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
            "X-Goog-FieldMask": [
              "places.displayName",
              "places.formattedAddress",
              "places.location",
              "places.nationalPhoneNumber",
              "places.rating",
              "places.userRatingCount",
              "places.businessStatus",
              "places.id"
            ].join(",")
          },
          body: JSON.stringify({
            includedTypes: types,
            maxResultCount: 20,
            // DISTANCE en vez de POPULARITY (default): sin esto, Google prioriza
            // los lugares con más reseñas/tráfico — casi siempre cadenas grandes —
            // por sobre los más cercanos. Para prospección de barrio interesa lo
            // geográficamente próximo, no lo más "popular".
            rankPreference: "DISTANCE",
            locationRestriction: {
              circle: {
                center: { latitude, longitude },
                radius
              }
            }
          })
        }
      );

      let response;
      try {
        response = await placesRequest();
      } catch (networkError) {
        console.warn("⚠️ Falló la primera llamada a Places API, reintentando:", networkError.message);
        response = await placesRequest();
      }

      if (response.status >= 400) {
        console.error("❌ Error en Places API:", response.body);
        return res.status(502).json({ error: "No se pudo buscar negocios cercanos" });
      }

      const data = JSON.parse(response.body);
      console.log(`🔍 Places API devolvió ${data.places?.length || 0} resultados crudos:`,
        (data.places || []).map(p => p.displayName?.text).join(", "));

      let places = (data.places || []).map(p => ({
        id: p.id,
        name: p.displayName?.text || "Sin nombre",
        address: p.formattedAddress || "",
        phone: p.nationalPhoneNumber || null,
        rating: p.rating ?? null,
        ratingCount: p.userRatingCount ?? 0,
        businessStatus: p.businessStatus || null,
        location: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : null
      }));

      // Por defecto excluye cadenas grandes: el cliente real de una
      // distribuidora es el almacén/minimarket independiente, no Jumbo,
      // Líder, etc. — esos compran directo a los grandes proveedores.
      if (req.body?.excludeChains !== false) {
        places = places.filter(p => !isKnownChain(p.name));
      }
      console.log(`🔍 Después del filtro de cadenas: ${places.length} resultados`);

      return res.status(200).json({ places, resolvedLocation: { lat: latitude, lng: longitude } });

    } catch (error) {
      console.error("❌ Error en searchNearbyBusinesses:", error);
      return res.status(500).json({ error: "Internal server error", message: error.message });
    }
  });
  }
);

/**
 * Análisis razonado con IA (Claude) sobre datos ya calculados por un agente
 * (Pricing, Finanzas o Marketing). El frontend manda los números YA
 * procesados — esta función nunca toca Firestore directo, solo le pide a
 * Claude que interprete lo que el agente ya calculó y dé una recomendación
 * en lenguaje natural. La key maestra vive solo en el servidor.
 *
 * Requiere:
 *  - Authorization: Bearer <Firebase ID token> del usuario logueado
 *  - Secret ANTHROPIC_API_KEY configurado
 *
 * Body: { systemPrompt: string, userPrompt: string }
 * Endpoint: POST /getAIRecommendation
 */
exports.getAIRecommendation = onRequest(
  { ...CORS_OPTIONS, secrets: ["ANTHROPIC_API_KEY"], timeoutSeconds: 60 },
  async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || "";
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!idToken) {
        return res.status(401).json({ error: "Falta Authorization Bearer token" });
      }
      try {
        await admin.auth().verifyIdToken(idToken);
      } catch {
        return res.status(401).json({ error: "Token inválido" });
      }

      const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      if (!ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: "El análisis con IA no está configurado en el servidor" });
      }

      const { systemPrompt, userPrompt } = req.body || {};
      if (!userPrompt || typeof userPrompt !== "string") {
        return res.status(400).json({ error: "Falta userPrompt" });
      }
      if (userPrompt.length > 20000) {
        return res.status(400).json({ error: "El contenido a analizar es demasiado grande" });
      }

      const aiRequest = () => makeRequest(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-sonnet-5",
            // 1024 se quedaba corto porque el modelo gasta parte del límite
            // en un bloque "thinking" antes del texto real -- con el límite
            // bajo, la respuesta se cortaba a mitad de frase (stop_reason
            // "max_tokens") antes de terminar el análisis.
            max_tokens: 2048,
            system: systemPrompt || "Eres un analista de negocios conciso, directo y práctico. Respondes en español de Chile.",
            messages: [{ role: "user", content: userPrompt }]
          })
        }
      );

      let response;
      try {
        response = await aiRequest();
      } catch (networkError) {
        console.warn("⚠️ Falló la primera llamada a Anthropic, reintentando:", networkError.message);
        response = await aiRequest();
      }

      if (response.status >= 400) {
        console.error("❌ Error en Anthropic API:", response.body);
        return res.status(502).json({ error: "No se pudo generar el análisis con IA" });
      }

      const data = JSON.parse(response.body);
      // El modelo puede devolver un bloque "thinking" ANTES del bloque
      // "text" real (extended thinking) -- content[0] no siempre es el
      // texto. Se busca explícitamente el primer bloque type:"text", si no
      // el análisis queda vacío aunque la IA sí haya respondido algo útil
      // (bug real detectado: "Flujo de caja" siempre devolvía "" porque
      // content[0] era el bloque thinking).
      const textBlock = (data.content || []).find((block) => block.type === "text");
      const text = textBlock?.text || "";

      return res.status(200).json({ text });

    } catch (error) {
      console.error("❌ Error en getAIRecommendation:", error);
      return res.status(500).json({ error: "Internal server error", message: error.message });
    }
  });
  }
);

// ══════════════════════════════════════════════════════
// SCHEDULED: Análisis diario de agentes (Pricing + Finanzas) — 07:00 Santiago
// Por ahora corre solo para la(s) empresa(s) que calcen con el patrón de
// nombre de abajo (caso de uso inicial: distribuidora L&N). Para sumar más
// empresas o correr para todas, basta con ajustar este patrón / el filtro
// más abajo — no hay ningún ID hardcodeado en ningún otro lado del código.
// ══════════════════════════════════════════════════════
const TARGET_COMPANY_NAME_PATTERN = "L&N"; // case-insensitive, "contiene" — ver resolveTargetCompanies()

// Umbrales del análisis (documentados acá porque son criterio de negocio,
// no un límite técnico):
// - PRODUCTS_LOSS: cualquier producto en pérdida (salePrice <= ppp) ya es notable.
// - LOW_MARGIN_THRESHOLD_PCT: mismo umbral que pricingAgent.js (15%) para
//   considerar "margen bajo".
// - LOW_MARGIN_COUNT_ALERT: recién avisamos si hay MÁS de 5 productos con
//   margen bajo (no queremos ruido diario por 1-2 productos límite).
// - Flujo de caja negativo del mes en curso siempre es notable.
const LOW_MARGIN_THRESHOLD_PCT = 15;
const LOW_MARGIN_COUNT_ALERT = 5;

/**
 * Busca empresas cuyo nombre contenga el patrón dado (case-insensitive).
 * Lee todas las empresas porque Firestore no soporta "contains" nativo en
 * queries — para el volumen de empresas de Bodestock esto es aceptable.
 */
async function resolveTargetCompanies(db, namePattern) {
  const snap = await db.collection("companies").get();
  const pattern = namePattern.toLowerCase();
  return snap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(c => (c.name || "").toLowerCase().includes(pattern));
}

/**
 * Reimplementación mínima (admin SDK) de analyzeProductMargins de
 * pricingAgent.js: recorre companies/{companyId}/inventories/{invId}/products
 * y cuenta productos en pérdida y de margen bajo. Mismo criterio de campos
 * (ppp = costo, salePrice/precioVenta = precio) y mismo umbral por defecto.
 */
async function computeMarginAlertsAdmin(db, companyId) {
  const inventoriesSnap = await db.collection(`companies/${companyId}/inventories`).get();
  let lossCount = 0;
  let lowMarginCount = 0;
  let evaluated = 0;

  for (const invDoc of inventoriesSnap.docs) {
    const productsSnap = await db.collection(`companies/${companyId}/inventories/${invDoc.id}/products`).get();
    productsSnap.forEach(p => {
      const data = p.data();
      const price = Number(data.salePrice ?? data.precioVenta);
      if (!price || price <= 0) return; // sin precio no hay margen que evaluar
      const cost = Number(data.ppp) || 0;

      evaluated += 1;
      if (price <= cost) {
        lossCount += 1;
        return;
      }
      const marginPct = ((price - cost) / price) * 100;
      if (marginPct < LOW_MARGIN_THRESHOLD_PCT) lowMarginCount += 1;
    });
  }

  return { evaluated, lossCount, lowMarginCount };
}

/**
 * Reimplementación mínima (admin SDK) del flujo de caja del mes en curso de
 * financeAgent.js: ventas (inventory_exits reason SALE, no canceladas, del
 * mes calendario actual) menos gastos operativos (gestion_gastos con
 * periodo == mes actual 'YYYY-MM').
 */
async function computeCurrentMonthCashFlowAdmin(db, companyId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const periodKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);

  const exitsSnap = await db.collection(`companies/${companyId}/inventory_exits`)
    .where("reason", "==", "SALE")
    .get();

  let salesTotal = 0;
  exitsSnap.forEach(doc => {
    const data = doc.data();
    if (data.status === "cancelled") return;
    const date = data.createdAt?.toDate ? data.createdAt.toDate() : null;
    if (!date || date < monthStart || date >= monthEnd) return;
    salesTotal += Number(data.totalValue) || 0;
  });

  const gastosSnap = await db.collection(`companies/${companyId}/gestion_gastos`)
    .where("periodo", "==", periodKey)
    .get();

  let expensesTotal = 0;
  gastosSnap.forEach(doc => {
    expensesTotal += Number(doc.data().monto) || 0;
  });

  const net = salesTotal - expensesTotal;
  return { periodKey, salesTotal, expensesTotal, net };
}

// Mismos umbrales que src/agents/inventoryAgent.js — no se inventan números
// nuevos, se replica la lógica ya probada en SuperAdminGestion.jsx.
const INVENTORY_STOCK_CRITICO_MAX = 5;
const INVENTORY_RECENT_EXITS_WINDOW = 500;

/**
 * Reimplementación mínima (admin SDK) de analyzeInventoryHealth de
 * inventoryAgent.js: cuenta productos sin stock, stock crítico, y sin
 * movimiento (con su valor inmovilizado), recorriendo todas las bodegas.
 */
async function computeInventoryAlertsAdmin(db, companyId) {
  const inventoriesSnap = await db.collection(`companies/${companyId}/inventories`).get();
  const products = [];

  for (const invDoc of inventoriesSnap.docs) {
    const productsSnap = await db.collection(`companies/${companyId}/inventories/${invDoc.id}/products`).get();
    productsSnap.forEach(p => {
      const data = p.data();
      if (data.productType === "INSUMO" || data.byWeight) return;
      products.push({ id: p.id, stock: Number(data.stock) || 0, ppp: Number(data.ppp) || 0 });
    });
  }

  const exitsSnap = await db.collection(`companies/${companyId}/inventory_exits`)
    .orderBy("createdAt", "desc")
    .limit(INVENTORY_RECENT_EXITS_WINDOW)
    .get();

  const recentlySoldIds = new Set();
  exitsSnap.forEach(doc => {
    const data = doc.data();
    if (data.reason !== "SALE" || data.status === "cancelled") return;
    (data.products || []).forEach(line => { if (line.productId) recentlySoldIds.add(line.productId); });
  });

  const outOfStockCount = products.filter(p => p.stock === 0).length;
  const criticalStockCount = products.filter(p => p.stock > 0 && p.stock <= INVENTORY_STOCK_CRITICO_MAX).length;
  const deadStock = products.filter(p => p.stock > INVENTORY_STOCK_CRITICO_MAX && !recentlySoldIds.has(p.id));
  const immobilizedValue = deadStock.reduce((sum, p) => sum + p.stock * p.ppp, 0);

  return { outOfStockCount, criticalStockCount, deadStockCount: deadStock.length, immobilizedValue };
}

/**
 * Ya se generó una alerta de agente para esta empresa HOY (mismo día
 * calendario Santiago)? Evita ruido duplicado si la función se re-ejecuta.
 */
async function hasAlertToday(db, companyId) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const snap = await db.collection(`companies/${companyId}/agent_alerts`)
    .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(startOfDay))
    .limit(1)
    .get();
  return !snap.empty;
}

// Umbral de variación (fracción) para considerar que un número realmente
// cambió, no solo ruido día a día (ej. 1 venta más o menos). 10% de
// diferencia respecto al valor anterior.
const DAILY_ALERT_CHANGE_THRESHOLD = 0.1;

function changedSignificantly(prev, current) {
  if (prev == null || current == null) return true;
  if (prev === 0 && current === 0) return false;
  const base = Math.max(Math.abs(prev), 1);
  return Math.abs(current - prev) / base > DAILY_ALERT_CHANGE_THRESHOLD;
}

/**
 * Antes de generar una alerta nueva, compara los números de hoy contra los
 * de la última alerta guardada (de cualquier día, no solo hoy) -- si un
 * problema es crónico (ej. 219 productos sin stock todos los días) no
 * tiene sentido pagar una llamada a Claude y sumar una entrada nueva al
 * historial cada mañana diciendo básicamente lo mismo. Solo se considera
 * "cambio real" si alguno de los 4 números varía más del umbral.
 */
async function hasSignificantChangeSinceLastAlert(db, companyId, current) {
  const snap = await db.collection(`companies/${companyId}/agent_alerts`)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  if (snap.empty) return true; // primera alerta de la empresa, siempre se genera

  const last = snap.docs[0].data().metrics;
  if (!last) return true; // alertas viejas sin metrics guardadas -- no se puede comparar, se genera

  return (
    changedSignificantly(last.outOfStockCount, current.outOfStockCount) ||
    changedSignificantly(last.lossCount, current.lossCount) ||
    changedSignificantly(last.lowMarginCount, current.lowMarginCount) ||
    changedSignificantly(last.cashFlowNet, current.cashFlowNet)
  );
}

/**
 * Llama a Claude (Anthropic) directamente, igual que getAIRecommendation,
 * para convertir los números crudos en un resumen breve en español de Chile.
 * Reintenta una vez ante error de red, mismo patrón que getAIRecommendation.
 */
async function summarizeWithClaude(userPrompt) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY no configurada");

  const systemPrompt = "Eres un consultor de negocios pragmático que asesora a pequeños negocios y distribuidoras en Chile. Hablas claro, sin jerga innecesaria, y siempre das una opinión concreta, no solo describes los datos.";

  const aiRequest = () => makeRequest(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        // Ver nota en getAIRecommendation: el modelo puede gastar parte del
        // límite en un bloque "thinking" antes del texto, así que 500 se
        // quedaba corto y el resumen diario de alertas salía vacío o cortado.
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }]
      })
    }
  );

  let response;
  try {
    response = await aiRequest();
  } catch (networkError) {
    console.warn("⚠️ Falló la primera llamada a Anthropic, reintentando:", networkError.message);
    response = await aiRequest();
  }

  if (response.status >= 400) {
    throw new Error(`Error Anthropic API ${response.status}: ${response.body}`);
  }

  const data = JSON.parse(response.body);
  // content[0] puede ser un bloque "thinking" en vez del texto real -- ver
  // la misma corrección y nota en getAIRecommendation más arriba.
  const textBlock = (data.content || []).find((block) => block.type === "text");
  return textBlock?.text || "";
}

exports.dailyAgentAnalysisScheduled = onSchedule(
  { schedule: "0 7 * * *", timeZone: "America/Santiago", region: "us-central1", secrets: ["ANTHROPIC_API_KEY"] },
  async () => {
    const db = admin.firestore();

    const targetCompanies = await resolveTargetCompanies(db, TARGET_COMPANY_NAME_PATTERN);
    console.log(`🤖 Análisis diario de agentes — ${targetCompanies.length} empresa(s) coinciden con "${TARGET_COMPANY_NAME_PATTERN}"`);

    for (const company of targetCompanies) {
      const companyId = company.id;
      try {
        if (await hasAlertToday(db, companyId)) {
          console.log(`ℹ️ ${company.name}: ya existe una alerta de agentes hoy, se omite.`);
          continue;
        }

        const [margins, cashFlow, inventory] = await Promise.all([
          computeMarginAlertsAdmin(db, companyId),
          computeCurrentMonthCashFlowAdmin(db, companyId),
          computeInventoryAlertsAdmin(db, companyId)
        ]);

        const hasLoss = margins.lossCount > 0;
        const hasNegativeCashFlow = cashFlow.net < 0;
        const hasLowMarginSpike = margins.lowMarginCount > LOW_MARGIN_COUNT_ALERT;
        const hasOutOfStock = inventory.outOfStockCount > 0;
        const notable = hasLoss || hasNegativeCashFlow || hasLowMarginSpike || hasOutOfStock;

        if (!notable) {
          console.log(`ℹ️ ${company.name}: sin novedades hoy (pérdidas=${margins.lossCount}, margen bajo=${margins.lowMarginCount}, flujo neto=${cashFlow.net}, sin stock=${inventory.outOfStockCount}). No se genera alerta.`);
          continue;
        }

        const currentMetrics = {
          outOfStockCount: inventory.outOfStockCount,
          lossCount: margins.lossCount,
          lowMarginCount: margins.lowMarginCount,
          cashFlowNet: cashFlow.net
        };

        // Un problema crónico (ej. 219 productos sin stock todos los días)
        // sigue siendo "notable" cada mañana, pero no es una NOVEDAD --
        // sin este chequeo se paga una llamada a Claude y se suma una
        // entrada al historial todos los días diciendo básicamente lo
        // mismo. Solo se genera alerta si algo cambió de verdad desde la
        // última vez.
        if (!(await hasSignificantChangeSinceLastAlert(db, companyId, currentMetrics))) {
          console.log(`ℹ️ ${company.name}: novedades siguen iguales que la última alerta, no se repite.`);
          continue;
        }

        console.log(`⚠️ ${company.name}: novedades detectadas — pérdidas=${margins.lossCount}, margen bajo=${margins.lowMarginCount}, flujo neto ${cashFlow.periodKey}=${cashFlow.net}, sin stock=${inventory.outOfStockCount}, crítico=${inventory.criticalStockCount}, sin rotación=${inventory.deadStockCount}`);

        const rawNumbersText = `Empresa: ${company.name}
Productos evaluados (con precio cargado): ${margins.evaluated}
Productos en pérdida (precio de venta <= costo): ${margins.lossCount}
Productos con margen bajo (menos de ${LOW_MARGIN_THRESHOLD_PCT}%): ${margins.lowMarginCount}
Flujo de caja del mes en curso (${cashFlow.periodKey}):
- Ventas: $${Math.round(cashFlow.salesTotal).toLocaleString("es-CL")}
- Gastos operativos cargados: $${Math.round(cashFlow.expensesTotal).toLocaleString("es-CL")}
- Neto: $${Math.round(cashFlow.net).toLocaleString("es-CL")}
Inventario:
- Productos sin stock (venta perdida ahora): ${inventory.outOfStockCount}
- Productos con stock crítico (≤5 unidades): ${inventory.criticalStockCount}
- Productos sin rotación (capital inmovilizado): ${inventory.deadStockCount} (valor: $${Math.round(inventory.immobilizedValue).toLocaleString("es-CL")})`;

        const userPrompt = `Estos son los números crudos del análisis diario automático de una distribuidora en Chile:

${rawNumbersText}

Escribe un resumen breve (3 a 4 oraciones) en español de Chile, directo y accionable, para que el dueño lo lea como notificación al abrir la app. No repitas los números tal cual — interprétalos y sugiere qué revisar primero.`;

        let summary;
        try {
          summary = await summarizeWithClaude(userPrompt);
        } catch (aiError) {
          console.error(`❌ ${company.name}: falló el resumen con IA, se usa fallback de texto plano:`, aiError.message);
          summary = rawNumbersText.replace(/\n/g, " · ");
        }

        const severity = (hasLoss || hasNegativeCashFlow || hasOutOfStock) ? "warning" : "info";
        const agentId = hasOutOfStock ? "inventory" : (hasLoss || hasLowMarginSpike) ? "pricing" : "finance";

        await db.collection(`companies/${companyId}/agent_alerts`).add({
          agentId,
          summary,
          severity,
          metrics: currentMetrics,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          read: false,
          readAt: null
        });

        console.log(`✅ ${company.name}: alerta de agente creada (severity=${severity})`);
      } catch (e) {
        console.error(`❌ Error en análisis diario de agentes para ${company.name || companyId}:`, e.message);
      }
    }
  }
);

// ============================================================
// CHAT POR AGENTE (Bodestock World) -- cada agente del mapa
// (pricing/inventory/finance/marketing/accounting) responde preguntas
// usando SUS datos reales, no una simulación. Reusa las mismas funciones
// admin ya escritas arriba para dailyAgentAnalysisScheduled (una sola
// fuente de verdad del cálculo, ver conversación con el usuario sobre no
// duplicar lógica entre agentes) + dos nuevas para Marketing y
// Contabilidad, que no tenían equivalente server-side todavía.
// ============================================================

/**
 * Prospectos guardados de la empresa -- reimplementación admin de
 * fetchSavedProspects (marketingAgent.js).
 */
async function computeMarketingProspectsAdmin(db, companyId) {
  const snap = await db.collection(`companies/${companyId}/prospects`).orderBy("createdAt", "desc").get();
  const prospects = snap.docs.map(d => d.data());
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newThisWeek = prospects.filter(p => {
    const created = p.createdAt?.toDate ? p.createdAt.toDate() : null;
    return created && created.getTime() >= weekAgo;
  }).length;
  return { total: prospects.length, newThisWeek };
}

/**
 * Reimplementación admin de las 4 reglas de accountingAgent.js (facturas
 * sin monto, facturas sin confirmar, sueldos que no calzan, mes sin
 * gastos) -- deliberadamente NO repite fiado (Finanzas) ni pérdida
 * (Pricing), mismo criterio que el agente del cliente.
 */
async function computeAccountingAuditAdmin(db, companyId) {
  const now = new Date();
  const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const findings = [];

  const facturasSnap = await db.collection(`companies/${companyId}/facturas_proveedores`).get();
  const missingAmount = facturasSnap.docs.filter(d => d.data().periodo === periodKey && (Number(d.data().monto) || 0) === 0);
  if (missingAmount.length > 0) {
    findings.push(`${missingAmount.length} factura(s) de este mes sin monto cargado`);
  }
  const pending = facturasSnap.docs.filter(d => d.data().periodo === periodKey && d.data().estado === "pendiente");
  if (pending.length > 0) {
    findings.push(`${pending.length} factura(s) de este mes sin confirmar`);
  }

  const gastosSnap = await db.collection(`companies/${companyId}/gestion_gastos`).where("periodo", "==", periodKey).get();
  const declaredSalaries = gastosSnap.docs
    .filter(d => d.data().tipo === "sueldos")
    .reduce((sum, d) => sum + (Number(d.data().monto) || 0), 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const exitsSnap = await db.collection(`companies/${companyId}/inventory_exits`)
    .where("reason", "==", "SALE")
    .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(monthStart))
    .get();
  let salesTotal = 0;
  exitsSnap.forEach(doc => {
    if (doc.data().status === "cancelled") return;
    salesTotal += Number(doc.data().totalValue) || 0;
  });
  if (salesTotal > 0 && gastosSnap.size === 0) {
    findings.push("este mes tiene ventas pero ningún gasto cargado");
  }

  // IVA estimado (débito - crédito fiscal, 19%): mismo cálculo que
  // accountingAgent.js:estimateMonthlyVAT del lado cliente, replicado acá
  // porque este endpoint corre server-side. Los montos guardados (ventas y
  // facturas) incluyen IVA, por eso se dividen por 1.19 para sacar el neto.
  // Crédito fiscal = facturas de proveedores confirmadas + inversión en
  // mercadería del mes (history embebido de cada producto, en TODOS los
  // inventarios de la empresa -- mismo criterio que "Invertido en
  // mercadería" en SuperAdminGestion.jsx, tiene historial retroactivo
  // completo a diferencia de companies/{id}/purchases, que solo se llena
  // desde que se agregó ese registro).
  const invoicesTotal = facturasSnap.docs
    .filter(d => d.data().periodo === periodKey && d.data().estado === "confirmado")
    .reduce((sum, d) => sum + (Number(d.data().monto) || 0), 0);

  const [py, pm] = periodKey.split("-").map(Number);
  const purchaseStart = new Date(py, pm - 1, 1);
  const purchaseEnd = new Date(py, pm, 0, 23, 59, 59);
  const invsSnap = await db.collection(`companies/${companyId}/inventories`).get();
  const productSnaps = await Promise.all(
    invsSnap.docs.map(invDoc => db.collection(`companies/${companyId}/inventories/${invDoc.id}/products`).get())
  );
  let inventoryPurchasesTotal = 0;
  productSnaps.forEach(prodSnap => {
    prodSnap.docs.forEach(prodDoc => {
      const history = prodDoc.data().history || [];
      history.forEach(h => {
        if (h.type === "shrinkage" || h.type === "exit") return;
        if (h.reason === "SALE" || h.reason === "sale") return;
        if (!h.totalPrice || h.totalPrice <= 0) return;
        const fecha = h.date ? new Date(h.date) : null;
        if (!fecha || isNaN(fecha.getTime())) return;
        if (fecha < purchaseStart || fecha > purchaseEnd) return;
        inventoryPurchasesTotal += h.totalPrice;
      });
    });
  });

  const purchasesTotal = invoicesTotal + inventoryPurchasesTotal;
  const debitoFiscal = (salesTotal / 1.19) * 0.19;
  const creditoFiscal = (purchasesTotal / 1.19) * 0.19;
  const estimatedVAT = Math.max(debitoFiscal - creditoFiscal, 0);
  const favorableBalance = creditoFiscal > debitoFiscal ? creditoFiscal - debitoFiscal : 0;

  return { findings, declaredSalaries, estimatedVAT, favorableBalance };
}

// Qué función admin trae los datos de cada agente, y cómo se traducen a
// texto plano para el system prompt de Claude -- un solo lugar que decide
// esto, así agregar un agente nuevo es una entrada más acá, no cambiar el
// endpoint entero.
const AGENT_PROFILES = {
  pricing: {
    name: "Precios",
    role: "vigila márgenes y precios de los productos",
    buildContext: async (db, companyId) => {
      const { evaluated, lossCount, lowMarginCount } = await computeMarginAlertsAdmin(db, companyId);
      if (evaluated === 0) return "No hay productos con precio cargado todavía para evaluar márgenes.";
      return `Productos evaluados: ${evaluated}. En pérdida (precio ≤ costo): ${lossCount}. Con margen bajo (menos de ${LOW_MARGIN_THRESHOLD_PCT}%): ${lowMarginCount}.`;
    }
  },
  inventory: {
    name: "Inventario",
    role: "vigila el stock y qué reponer",
    buildContext: async (db, companyId) => {
      const { outOfStockCount, criticalStockCount, deadStockCount, immobilizedValue } = await computeInventoryAlertsAdmin(db, companyId);
      return `Productos sin stock: ${outOfStockCount}. Con stock crítico (≤5 unidades): ${criticalStockCount}. Sin rotación: ${deadStockCount} (valor inmovilizado: $${Math.round(immobilizedValue).toLocaleString("es-CL")}).`;
    }
  },
  finance: {
    name: "Finanzas",
    role: "vigila el flujo de caja",
    buildContext: async (db, companyId) => {
      const { salesTotal, expensesTotal, net } = await computeCurrentMonthCashFlowAdmin(db, companyId);
      if (salesTotal === 0) return "No hay ventas registradas todavía este mes.";
      return `Este mes: ventas $${Math.round(salesTotal).toLocaleString("es-CL")}, gastos operativos cargados $${Math.round(expensesTotal).toLocaleString("es-CL")}, flujo neto $${Math.round(net).toLocaleString("es-CL")}.`;
    }
  },
  marketing: {
    name: "Marketing",
    role: "vigila prospectos y campañas",
    buildContext: async (db, companyId) => {
      const { total, newThisWeek } = await computeMarketingProspectsAdmin(db, companyId);
      if (total === 0) return "No hay prospectos guardados todavía.";
      return `Prospectos guardados: ${total}. Nuevos esta semana: ${newThisWeek}.`;
    }
  },
  accounting: {
    name: "Contabilidad",
    role: "audita facturas, sueldos y gastos cargados, y explica conceptos tributarios chilenos en criollo cuando te los pregunten (no declara impuestos ni reemplaza a un contador)",
    // Conocimiento general de contabilidad/tributación chilena para pyme,
    // para que el agente pueda responder preguntas de concepto ("¿qué es
    // el F29?", "¿esto da crédito fiscal?") y no solo auditar los datos
    // cargados. Es conocimiento de referencia, no reemplaza asesoría
    // profesional en casos específicos o dudosos -- el agente debe decirlo
    // así cuando corresponda.
    knowledge: `CONCEPTOS QUE PODÉS EXPLICAR (en criollo, con ejemplos simples -- quien pregunta puede no saber nada de contabilidad):

- IVA (Impuesto al Valor Agregado): 19% en Chile. Cuando vendés, cobrás IVA (débito fiscal). Cuando comprás con factura, pagás IVA (crédito fiscal). Lo que se paga al fisco cada mes es la diferencia: débito menos crédito. Si el crédito es mayor, queda a favor (remanente) para el próximo mes.
- F29: es el formulario mensual donde se declara el IVA (y otros impuestos) ante el SII. Se presenta hasta el día 12 del mes siguiente (o 20 si se declara por internet con ciertos medios de pago). Esto es una simulación/estimación interna de Bodestock, nunca una declaración oficial -- si te preguntan si "ya está declarado", aclará que eso se hace directo en el sitio del SII, Bodestock no presenta el F29 por la empresa.
- Crédito fiscal: el IVA que una empresa pagó en sus compras y que puede descontar del IVA que cobró en sus ventas. Para que un gasto dé crédito fiscal necesita: factura (no boleta), estar relacionado al giro del negocio, y estar bien documentado -- no toda compra con IVA es automáticamente crédito fiscal utilizable.
- Diferencia entre gasto y costo de venta: el costo de venta es lo que costó producir/comprar lo que efectivamente se vendió. Un gasto operativo (arriendo, luz, sueldos) es necesario para operar pero no es "costo del producto". Comprar mercadería no es gasto del mes si no se vendió todavía -- es inversión en inventario.
- Margen vs. utilidad: el margen bruto es (ventas - costo de venta) / ventas, en %. La utilidad neta del mes resta además los gastos operativos. Dos negocios pueden tener el mismo margen bruto y una utilidad neta muy distinta si uno gasta mucho más en operación.
- Formalización de un negocio en Chile: iniciar actividades ante el SII (define el giro económico), obtener RUT si es persona jurídica, inscribirse según el régimen tributario que corresponda (Pro Pyme, régimen general, etc.), y revisar si el rubro necesita patente municipal o permisos sanitarios (clave para cocinas/alimentos). Esto varía según cada caso -- para una situación concreta, siempre sugerí confirmar en sii.cl, chileatiende.gob.cl, o con un contador, antes de tomar una decisión final.
- Boleta vs. factura: la boleta es para el consumidor final, no da crédito fiscal. La factura es entre empresas/contribuyentes de IVA y sí puede dar crédito fiscal si cumple los requisitos.

Si te preguntan algo tributario muy específico de un caso particular (ej. "¿puedo descontar esto de mis impuestos?" sobre una situación dudosa, o algo que depende del régimen exacto de esa empresa), explicá el concepto general y aclará que para la decisión final conviene confirmar con un contador o directamente en el SII -- no estás ahí para reemplazar esa validación final, sino para que la persona entienda de qué se trata antes de ir a preguntar.`,
    buildContext: async (db, companyId) => {
      const { findings, declaredSalaries, estimatedVAT, favorableBalance } = await computeAccountingAuditAdmin(db, companyId);
      const salariesLine = declaredSalaries > 0 ? ` Gasto de sueldos cargado este mes: $${Math.round(declaredSalaries).toLocaleString("es-CL")}.` : "";
      const vatLine = favorableBalance > 0
        ? ` IVA estimado del mes: a favor $${Math.round(favorableBalance).toLocaleString("es-CL")} (crédito fiscal mayor al débito).`
        : estimatedVAT > 0
          ? ` IVA estimado a pagar este mes: $${Math.round(estimatedVAT).toLocaleString("es-CL")} (estimación, no declaración real).`
          : "";
      if (findings.length === 0) return `Sin hallazgos este mes.${salariesLine}${vatLine}`;
      return `Hallazgos de este mes: ${findings.join("; ")}.${salariesLine}${vatLine}`;
    }
  }
};

/**
 * Chat con UN agente específico del mapa de Bodestock World -- recibe
 * agentId + companyId + el mensaje del usuario + el historial reciente de
 * la conversación, arma el contexto real de ESE agente (nunca datos de
 * otro), y devuelve la respuesta de Claude. Sin tool calls ni mutaciones a
 * Firestore -- a diferencia del asistente de inventario, esto solo
 * responde preguntas, no ejecuta acciones (alcance deliberado, ver
 * conversación con el usuario).
 */
exports.agentChat = onRequest(
  { ...CORS_OPTIONS, secrets: ["ANTHROPIC_API_KEY"], timeoutSeconds: 60 },
  async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || "";
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!idToken) {
        return res.status(401).json({ error: "Falta Authorization Bearer token" });
      }
      try {
        await admin.auth().verifyIdToken(idToken);
      } catch {
        return res.status(401).json({ error: "Token inválido" });
      }

      const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      if (!ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: "El chat no está configurado en el servidor" });
      }

      const { agentId, companyId, message, history } = req.body || {};
      const profile = AGENT_PROFILES[agentId];
      if (!profile) {
        return res.status(400).json({ error: "agentId no reconocido" });
      }
      if (!companyId || typeof companyId !== "string") {
        return res.status(400).json({ error: "Falta companyId" });
      }
      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ error: "Falta message" });
      }
      if (message.length > 2000) {
        return res.status(400).json({ error: "El mensaje es demasiado largo" });
      }

      const db = admin.firestore();
      let dataContext;
      try {
        dataContext = await profile.buildContext(db, companyId);
      } catch (dataError) {
        console.error(`❌ agentChat: no se pudo leer el contexto de ${agentId}:`, dataError.message);
        dataContext = "No se pudieron leer los datos ahora mismo -- avísale al usuario que hubo un problema técnico y que no inventes números.";
      }

      const knowledgeBlock = profile.knowledge ? `\n${profile.knowledge}\n` : "";

      const systemPrompt = `Eres el Agente de ${profile.name} de Bodestock, un sistema de gestión para PyMEs en Chile. Tu trabajo es ${profile.role}.
${knowledgeBlock}
DATOS REALES DE ESTA EMPRESA (los únicos que puedes usar -- nunca inventes cifras):
${dataContext}

Todas las cifras de plata que uses o menciones son en pesos chilenos (CLP) -- nunca digas "dólares" ni uses el símbolo USD, y si escribís un monto usa el formato chileno (ej. $1.304.080).

Responde en español neutro, natural y fluido, como si hablaras con el dueño de la empresa -- nada de reportes robóticos ni de encadenar puros datos. Directo y breve (máximo 4-5 líneas salvo que te pidan más detalle). No eres un chatbot genérico: sos específicamente este agente, así que si te preguntan algo fuera de tu área (ej. le preguntan de inventario al agente de Finanzas), decilo con honestidad y sugerí hablar con el agente correspondiente en el mapa.`;

      // Historial acotado (últimos 10 mensajes) -- mismo criterio que el
      // asistente de inventario, para no mandar contexto ilimitado a Claude.
      const historyMessages = Array.isArray(history)
        ? history.filter(m => m.role === "user" || m.role === "assistant").slice(-10).map(m => ({ role: m.role, content: String(m.content || "") }))
        : [];

      const aiRequest = () => makeRequest(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-sonnet-5",
            max_tokens: 600,
            system: systemPrompt,
            messages: [...historyMessages, { role: "user", content: message }]
          })
        }
      );

      let response;
      try {
        response = await aiRequest();
      } catch (networkError) {
        console.warn("⚠️ Falló la primera llamada a Anthropic, reintentando:", networkError.message);
        response = await aiRequest();
      }

      if (response.status >= 400) {
        console.error("❌ Error en Anthropic API:", response.body);
        return res.status(502).json({ error: "No se pudo generar la respuesta" });
      }

      const data = JSON.parse(response.body);
      const textBlock = Array.isArray(data.content) ? data.content.find(b => b.type === "text") : null;
      const text = textBlock?.text || "";
      if (!text) {
        console.error("❌ agentChat: respuesta de Anthropic sin bloque de texto:", JSON.stringify(data));
      }

      return res.status(200).json({ text });

    } catch (error) {
      console.error("❌ Error en agentChat:", error);
      return res.status(500).json({ error: "Internal server error", message: error.message });
    }
  });
  }
);

/**
 * Lee una foto de boleta/factura (ya subida a Storage por el cliente desde
 * MiConsultor.jsx) con Claude Vision, y sugiere monto, fecha, proveedor y
 * tipo de gasto. SOLO sugiere -- nunca escribe directo en Firestore ni
 * marca la factura como confirmada: el cliente ve los datos extraídos como
 * propuesta editable y es él quien confirma (mismo principio que ya sigue
 * el resto del sistema: nunca inventar/asumir datos financieros).
 *
 * companyId sale de los custom claims del token (no del body) -- mismo
 * patrón que saveMercadoPagoToken, para no confiar en lo que mande el
 * cliente en una función que toca datos financieros.
 *
 * Endpoint: POST /analyzeFacturaReceipt
 * Body: { imageUrl, facturaId }
 */
exports.analyzeFacturaReceipt = onRequest(
  { ...CORS_OPTIONS, secrets: ["ANTHROPIC_API_KEY"], timeoutSeconds: 60 },
  async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || "";
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!idToken) {
        return res.status(401).json({ error: "Falta Authorization Bearer token" });
      }

      let decoded;
      try {
        decoded = await admin.auth().verifyIdToken(idToken);
      } catch {
        return res.status(401).json({ error: "Token inválido" });
      }

      const companyId = decoded.companyId;
      if (!companyId) {
        return res.status(403).json({ error: "No se pudo identificar la empresa del usuario" });
      }

      const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      if (!ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: "El análisis de boletas no está configurado en el servidor" });
      }

      const { imageUrl } = req.body || {};
      if (!imageUrl || typeof imageUrl !== "string") {
        return res.status(400).json({ error: "Falta imageUrl" });
      }

      // Descargar la imagen desde Storage y pasarla a base64 -- la API de
      // Anthropic necesita el bytes de la imagen, no solo la URL.
      let imageBuffer, contentType;
      try {
        const imgResponse = await new Promise((resolve, reject) => {
          https.get(imageUrl, (r) => {
            const chunks = [];
            r.on("data", (c) => chunks.push(c));
            r.on("end", () => resolve({ buffer: Buffer.concat(chunks), contentType: r.headers["content-type"] }));
            r.on("error", reject);
          }).on("error", reject);
        });
        imageBuffer = imgResponse.buffer;
        contentType = imgResponse.contentType || "image/jpeg";
      } catch (downloadError) {
        console.error("❌ No se pudo descargar la imagen de la boleta:", downloadError.message);
        return res.status(400).json({ error: "No se pudo leer la imagen subida" });
      }

      // Los PDF no se mandan como imagen -- por ahora solo se analizan
      // fotos (image/*); un PDF queda pendiente de revisión manual igual
      // que antes de este cambio.
      if (!contentType.startsWith("image/")) {
        return res.status(200).json({
          ok: true,
          suggestion: null,
          note: "Los PDF no se leen automáticamente todavía -- revisalo manualmente.",
        });
      }

      const GASTO_TIPO_IDS = [
        "arriendo", "sueldos", "imposiciones", "servicios", "transporte",
        "credito_bancario", "software", "honorarios", "impuestos",
        "comision_vendedor", "otro",
      ];

      const systemPrompt = `Sos un asistente que lee boletas y facturas chilenas para extraer datos. Mirá la imagen y devolvé SOLO un JSON válido (nada de texto antes o después), con esta forma exacta:
{"monto": <número entero en pesos chilenos, sin puntos ni símbolo, o null si no se puede leer>, "fecha": "<YYYY-MM-DD o null>", "proveedor": "<nombre del negocio/razón social o null>", "tipoSugerido": "<uno de: ${GASTO_TIPO_IDS.join(", ")}>", "confianza": "<alta|media|baja>"}

Reglas:
- Si la imagen no es una boleta/factura legible, o no podés leer el monto con razonable certeza, poné "monto": null y "confianza": "baja".
- "tipoSugerido" es tu mejor estimación según el rubro del comercio en la boleta (ej. un supermercado → "otro", una compañía eléctrica → "servicios", un arriendo → "arriendo") -- el usuario lo va a poder cambiar, es solo una sugerencia.
- Nunca inventes un monto que no puedas leer en la imagen.`;

      const base64Image = imageBuffer.toString("base64");

      const aiRequest = () => makeRequest(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 400,
            system: systemPrompt,
            messages: [{
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: contentType, data: base64Image } },
                { type: "text", text: "Extraé los datos de esta boleta/factura siguiendo el formato indicado." }
              ]
            }]
          })
        }
      );

      let response;
      try {
        response = await aiRequest();
      } catch (networkError) {
        console.warn("⚠️ Falló la primera llamada a Anthropic, reintentando:", networkError.message);
        response = await aiRequest();
      }

      if (response.status >= 400) {
        console.error("❌ Error en Anthropic API (analyzeFacturaReceipt):", response.body);
        return res.status(502).json({ error: "No se pudo analizar la boleta" });
      }

      const data = JSON.parse(response.body);
      const textBlock = Array.isArray(data.content) ? data.content.find(b => b.type === "text") : null;
      const rawText = textBlock?.text || "";

      let suggestion = null;
      try {
        // El modelo puede envolver el JSON en ```json ... ``` pese a la
        // instrucción -- se limpia por las dudas antes de parsear.
        const cleaned = rawText.replace(/```json\s*|```\s*/g, "").trim();
        const parsed = JSON.parse(cleaned);
        suggestion = {
          monto: Number.isFinite(Number(parsed.monto)) ? Math.round(Number(parsed.monto)) : null,
          fecha: typeof parsed.fecha === "string" ? parsed.fecha : null,
          proveedor: typeof parsed.proveedor === "string" ? parsed.proveedor : null,
          tipoSugerido: GASTO_TIPO_IDS.includes(parsed.tipoSugerido) ? parsed.tipoSugerido : "otro",
          confianza: ["alta", "media", "baja"].includes(parsed.confianza) ? parsed.confianza : "baja",
        };
      } catch (parseError) {
        console.error("❌ analyzeFacturaReceipt: respuesta de Claude no es JSON válido:", rawText);
        suggestion = null;
      }

      return res.status(200).json({ ok: true, suggestion });

    } catch (error) {
      console.error("❌ Error en analyzeFacturaReceipt:", error);
      return res.status(500).json({ error: "Internal server error", message: error.message });
    }
  });
  }
);

/**
 * Convierte texto a voz vía ElevenLabs -- a diferencia de Deepgram
 * (getDeepgramToken), ElevenLabs no tiene keys temporales de cliente: el
 * patrón acá es que el backend hace todo el trabajo (recibe texto, llama a
 * ElevenLabs con la key secreta, devuelve el audio ya generado) en vez de
 * prestarle un token al navegador. Reemplaza la voz nativa del navegador
 * (SpeechSynthesisUtterance) que usaba useVoiceOutput, que sonaba robótica.
 *
 * Usa el endpoint /stream de ElevenLabs y pipea los chunks directo a la
 * respuesta a medida que llegan -- esperar el audio completo antes de
 * mandar cualquier byte (como hacía la versión anterior con el endpoint
 * normal + Buffer.concat) agregaba varios segundos de silencio en
 * respuestas largas antes de que el navegador pudiera empezar a sonar.
 */
exports.textToSpeech = onRequest(
  { ...CORS_OPTIONS, secrets: ["ELEVENLABS_API_KEY"], timeoutSeconds: 30 },
  async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || "";
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!idToken) {
        return res.status(401).json({ error: "Falta Authorization Bearer token" });
      }

      try {
        await admin.auth().verifyIdToken(idToken);
      } catch {
        return res.status(401).json({ error: "Token inválido" });
      }

      const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
      if (!ELEVENLABS_API_KEY) {
        return res.status(500).json({ error: "La voz no está configurada en el servidor" });
      }

      const { text } = req.body || {};
      if (!text || typeof text !== "string" || !text.trim()) {
        return res.status(400).json({ error: "Falta text" });
      }

      // El símbolo "$" lo lee el motor de voz como "dólar" sin importar el
      // idioma de la voz -- acá siempre son pesos chilenos, así que se
      // reemplaza antes de mandarlo a ElevenLabs (misma limpieza que antes
      // hacía useVoiceOutput en el cliente, ahora centralizada acá para que
      // los 3 consumidores del hook no tengan que duplicarla).
      const spokenText = text.replace(/\$\s?([\d.,]+)/g, "$1 pesos").slice(0, 2000);

      // Voz multilingüe de ElevenLabs (soporta español) -- "Sarah", una de
      // las voces predefinidas disponibles en cualquier cuenta.
      const ELEVENLABS_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

      await new Promise((resolve, reject) => {
        const body = JSON.stringify({
          text: spokenText,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          // Genera el primer chunk más rápido a costa de algo de calidad en
          // el arranque -- nivel 4 es el más agresivo que ofrece la API.
          optimize_streaming_latency: 4
        });

        const elevenReq = https.request(
          `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "audio/mpeg",
              "xi-api-key": ELEVENLABS_API_KEY,
            }
          },
          (response) => {
            if (response.statusCode >= 400) {
              const chunks = [];
              response.on("data", (c) => chunks.push(c));
              response.on("end", () => {
                reject(new Error(`ElevenLabs respondió ${response.statusCode}: ${Buffer.concat(chunks).toString("utf8")}`));
              });
              return;
            }
            res.set("Content-Type", "audio/mpeg");
            res.status(200);
            response.pipe(res);
            response.on("end", resolve);
            response.on("error", reject);
          }
        );
        elevenReq.on("error", reject);
        elevenReq.write(body);
        elevenReq.end();
      });
      return;

    } catch (error) {
      console.error("❌ Error en textToSpeech:", error);
      // Si ya se empezaron a mandar chunks de audio (headers enviados), no
      // se puede mandar un JSON de error encima -- solo cortar la conexión.
      if (res.headersSent) return res.end();
      return res.status(500).json({ error: "No se pudo generar la voz" });
    }
  });
  }
);

/**
 * Guarda el Access Token de Mercado Pago de UNA empresa, además del flag
 * público companies/{companyId}.mpConnected que lee la tienda pública
 * (PublicStore.jsx, sin sesión) para saber si ofrecer "pagar online".
 *
 * Pasa por una Cloud Function en vez de escritura directa del cliente
 * porque companies/{companyId} (el documento raíz) solo admite escritura
 * de super admin en las reglas de Firestore -- escribir mpConnected ahí
 * requiere permisos de servidor. El Access Token en sí (en
 * settings/mercadopago) sí lo puede escribir el admin de la empresa
 * directo, pero se guarda acá también para hacerlo en una sola llamada.
 *
 * Requiere Authorization: Bearer <Firebase ID token> de un usuario con
 * custom claims { companyId, role: "ADMIN" } para ESA empresa -- cualquier
 * otro rol, o un token de otra empresa, se rechaza.
 *
 * Endpoint: POST /saveMercadoPagoToken
 * Body: { accessToken }
 */
exports.saveMercadoPagoToken = onRequest(CORS_OPTIONS, async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || "";
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
      if (!idToken) {
        return res.status(401).json({ error: "Falta Authorization Bearer token" });
      }

      let decoded;
      try {
        decoded = await admin.auth().verifyIdToken(idToken);
      } catch {
        return res.status(401).json({ error: "Token inválido" });
      }

      const companyId = decoded.companyId;
      if (!companyId || decoded.role !== "ADMIN") {
        return res.status(403).json({ error: "Solo el administrador de la empresa puede conectar Mercado Pago" });
      }

      const { accessToken } = req.body || {};
      if (!accessToken || !String(accessToken).trim()) {
        return res.status(400).json({ error: "Falta accessToken" });
      }

      const db = admin.firestore();
      await Promise.all([
        db.doc(`companies/${companyId}/settings/mercadopago`).set({
          accessToken: String(accessToken).trim(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }),
        db.doc(`companies/${companyId}`).set({ mpConnected: true }, { merge: true }),
      ]);

      return res.status(200).json({ ok: true });

    } catch (error) {
      console.error("❌ Error en saveMercadoPagoToken:", error);
      return res.status(500).json({ error: "Internal server error", message: error.message });
    }
  });
});

/**
 * Crea una preferencia de pago de Mercado Pago para UN pedido de la tienda
 * pública (ver PublicStore.jsx), usando el Access Token de LA EMPRESA
 * dueña del pedido (companies/{companyId}/settings/mercadopago) -- nunca
 * el de Bodestock. Así el dinero del pedido va directo a la cuenta de MP
 * de cada negocio, no a la de la plataforma.
 *
 * Sin autenticación: la llama un cliente anónimo desde la tienda pública,
 * igual que el resto del flujo de PublicStore.jsx (crear pedido, ver
 * estado). companyId + orderId identifican el pedido, que ya existe en
 * Firestore (se creó antes desde el checkout) -- acá solo se arma la
 * preferencia de pago para ESE pedido ya existente, no se inventan montos.
 *
 * Endpoint: POST /createStoreOrderPreference
 * Body: { companyId, orderId }
 */
exports.createStoreOrderPreference = onRequest(CORS_OPTIONS, async (req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const { companyId, orderId } = req.body || {};
      if (!companyId || !orderId) {
        return res.status(400).json({ error: "Falta companyId u orderId" });
      }

      const db = admin.firestore();

      const [mpConfigSnap, companySnap, orderSnap] = await Promise.all([
        db.doc(`companies/${companyId}/settings/mercadopago`).get(),
        db.doc(`companies/${companyId}`).get(),
        db.doc(`companies/${companyId}/orders/${orderId}`).get(),
      ]);

      const accessToken = mpConfigSnap.exists ? mpConfigSnap.data().accessToken : null;
      if (!accessToken) {
        return res.status(409).json({ error: "Esta tienda todavía no conectó Mercado Pago" });
      }

      if (!orderSnap.exists) {
        return res.status(404).json({ error: "Pedido no encontrado" });
      }
      const order = orderSnap.data();

      // El total se arma desde los items del pedido YA GUARDADO (no desde
      // lo que mande el cliente en el body) -- evita que alguien manipule
      // el monto a pagar desde el navegador.
      const items = (order.items || [])
        .filter((it) => !it.byWeight) // los productos por peso se confirman en caja (ver confirmedPrice), no entran al cobro online todavía
        .map((it) => ({
          title: it.name || "Producto",
          quantity: it.qty || 1,
          unit_price: Number(it.price) || 0,
          currency_id: "CLP",
        }));

      if (items.length === 0) {
        return res.status(409).json({ error: "Este pedido no tiene productos cobrables online (solo por peso)" });
      }

      const origin = req.headers.origin || `https://${req.headers.host}`;
      const companyName = companySnap.exists ? (companySnap.data().name || "Tu tienda") : "Tu tienda";

      const preference = {
        items,
        external_reference: `${companyId}_${orderId}`,
        metadata: { companyId, orderId },
        back_urls: {
          success: `${origin}/tienda/${companyId}${order.inventoryId ? `/${order.inventoryId}` : ""}?pedido=${orderId}&pago=aprobado`,
          failure: `${origin}/tienda/${companyId}${order.inventoryId ? `/${order.inventoryId}` : ""}?pedido=${orderId}&pago=fallido`,
          pending: `${origin}/tienda/${companyId}${order.inventoryId ? `/${order.inventoryId}` : ""}?pedido=${orderId}&pago=pendiente`,
        },
        auto_return: "approved",
        // companyId/orderId van directo en la URL del webhook -- así, al
        // llegar la notificación, ya sabemos con qué Access Token verificar
        // el pago SIN tener que leer nada de Mercado Pago sin credenciales
        // primero (una consulta sin Authorization a /v1/payments no es
        // algo que la API de MP garantice; esto no depende de eso).
        notification_url: `https://${req.headers.host}/mercadoPagoOrderWebhook?companyId=${encodeURIComponent(companyId)}&orderId=${encodeURIComponent(orderId)}`,
        statement_descriptor: companyName.slice(0, 22),
      };

      const response = await makeRequest("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preference),
      });

      if (response.status >= 400) {
        console.error("❌ Error creando preferencia de Mercado Pago:", response.body);
        return res.status(502).json({ error: "No se pudo crear el link de pago" });
      }

      const data = JSON.parse(response.body);

      await db.doc(`companies/${companyId}/orders/${orderId}`).update({
        mpPreferenceId: data.id,
        paymentStatus: "pending",
      });

      return res.status(200).json({ initPoint: data.init_point });

    } catch (error) {
      console.error("❌ Error en createStoreOrderPreference:", error);
      return res.status(500).json({ error: "Internal server error", message: error.message });
    }
  });
});

/**
 * Webhook de Mercado Pago: notifica cuando cambia el estado de un pago.
 *
 * companyId/orderId viajan en la URL del webhook (se arman en
 * createStoreOrderPreference, dentro de notification_url) -- así se sabe
 * de entrada con qué Access Token verificar el pago, sin depender de leer
 * nada de la API de MP sin credenciales primero (una consulta sin
 * Authorization a /v1/payments no es algo que la API garantice).
 *
 * Por seguridad nunca se confía ciegamente en esos query params: se
 * reconsulta el pago CON el token de esa empresa, y se exige que el
 * external_reference que MP devuelve coincida exactamente con
 * "{companyId}_{orderId}" -- así nadie puede llamar a este webhook a mano
 * con un companyId/orderId inventados para marcar un pedido como pagado
 * sin haber pagado nada.
 *
 * Endpoint: POST /mercadoPagoOrderWebhook?companyId=...&orderId=...
 */
exports.mercadoPagoOrderWebhook = onRequest(CORS_OPTIONS, async (req, res) => {
  try {
    const paymentId = req.body?.data?.id || req.query["data.id"];
    const topic = req.body?.type || req.query.type || req.query.topic;
    const { companyId, orderId } = req.query;

    if (topic !== "payment" || !paymentId) {
      return res.status(200).send("ignored"); // MP manda otros tipos de evento (merchant_order, etc.) que no nos interesan
    }
    if (!companyId || !orderId) {
      console.error("❌ Webhook de Mercado Pago sin companyId/orderId en la URL");
      return res.status(200).send("missing companyId/orderId");
    }

    const db = admin.firestore();

    const mpConfigSnap = await db.doc(`companies/${companyId}/settings/mercadopago`).get();
    const accessToken = mpConfigSnap.exists ? mpConfigSnap.data().accessToken : null;
    if (!accessToken) {
      console.error(`❌ Webhook: empresa ${companyId} sin Access Token configurado`);
      return res.status(200).send("no access token");
    }

    const verified = await makeRequest(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${accessToken}` },
    });

    if (verified.status >= 400) {
      console.error("❌ No se pudo verificar el pago con el token de la empresa:", verified.body);
      return res.status(200).send("verification failed");
    }

    const payment = JSON.parse(verified.body);

    // El pago tiene que ser realmente de este pedido -- si external_reference
    // no coincide, alguien está mandando companyId/orderId falsos.
    if (payment.external_reference !== `${companyId}_${orderId}`) {
      console.error(`❌ Webhook: external_reference no coincide (esperado ${companyId}_${orderId}, recibido ${payment.external_reference})`);
      return res.status(200).send("external_reference mismatch");
    }

    const status = payment.status; // approved | pending | rejected | ...

    await db.doc(`companies/${companyId}/orders/${orderId}`).update({
      paymentStatus: status,
      paidAt: status === "approved" ? admin.firestore.FieldValue.serverTimestamp() : null,
      mpPaymentId: paymentId,
    });

    console.log(`✅ Webhook MP procesado: pedido ${orderId} de ${companyId} → ${status}`);
    return res.status(200).send("ok");

  } catch (error) {
    console.error("❌ Error en mercadoPagoOrderWebhook:", error);
    return res.status(200).send("error"); // 200 para evitar reintentos infinitos de MP; queda registrado en logs
  }
});

