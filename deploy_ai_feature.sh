#!/bin/bash
set -e

D=/home/u403881955/domains
API_DIR="$D/betapplapi.kcnanja.com/hbuilds/current/nodejs"
SRC_DIR="$API_DIR/src"
STORAGE_DIR="$D/betapplapi.kcnanja.com/storage"
PUBLIC_HTML="$D/betappl.kcnanja.com/public_html"

mkdir -p "$STORAGE_DIR"

echo "=== 1. CREATE AI SETTINGS TABLE IN DB ==="
if [ -f "$API_DIR/.env" ]; then
  DB_PASS=$(grep '^DB_PASSWORD=' "$API_DIR/.env" | cut -d '=' -f2- | sed -e 's/^[ \t"'\''\r]*//' -e 's/[ \t"'\''\r]*$//')
  DB_USER=$(grep '^DB_USER=' "$API_DIR/.env" | cut -d '=' -f2- | sed -e 's/^[ \t"'\''\r]*//' -e 's/[ \t"'\''\r]*$//')
  DB_NAME=$(grep '^DB_NAME=' "$API_DIR/.env" | cut -d '=' -f2- | sed -e 's/^[ \t"'\''\r]*//' -e 's/[ \t"'\''\r]*$//')
  
  mysql -h 127.0.0.1 -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" << 'EOSQL'
CREATE TABLE IF NOT EXISTS `AiSettings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `AiEnabled` TINYINT(1) NOT NULL DEFAULT 1,
  `AiProvider` VARCHAR(50) DEFAULT 'gemini',
  `AiApiKey` TEXT,
  `AiModel` VARCHAR(100) DEFAULT 'gemini-1.5-flash',
  `AiEndpointUrl` VARCHAR(255) NULL,
  `AiAssistantPlatformUrl` VARCHAR(255) NULL,
  `AiAllowedRoles` VARCHAR(255) DEFAULT 'super_admin',
  `AiSystemPrompt` TEXT NULL,
  `CreatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `UpdatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
EOSQL
  echo "AiSettings table verified."
fi

echo "=== 2. CREATE MODEL FILE ==="
cat << 'EOF' > "$SRC_DIR/models/ai-settings.model.js"
'use strict';

module.exports = (sequelize, DataTypes) => {
    const AiSetting = sequelize.define('AiSetting', {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        AiEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        AiProvider: { type: DataTypes.STRING, defaultValue: 'gemini' },
        AiApiKey: { type: DataTypes.TEXT },
        AiModel: { type: DataTypes.STRING, defaultValue: 'gemini-1.5-flash' },
        AiEndpointUrl: { type: DataTypes.STRING },
        AiAssistantPlatformUrl: { type: DataTypes.STRING },
        AiAllowedRoles: { type: DataTypes.STRING, defaultValue: 'super_admin' },
        AiSystemPrompt: { type: DataTypes.TEXT }
    }, {
        tableName: 'AiSettings',
        timestamps: true,
        createdAt: 'CreatedAt',
        updatedAt: 'UpdatedAt'
    });

    return AiSetting;
};
EOF

echo "=== 3. CREATE SERVICE FILE ==="
cat << 'EOF' > "$SRC_DIR/services/ai-config.service.js"
'use strict';

const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const models = require('../models');
const ApiError = require('../utils/ApiError');
const HTTP = require('../utils/httpStatusCodes');

const BACKUP_FILE = path.join(__dirname, '../../../../storage/ai-settings.json');
const CACHE_MS = 15 * 1000;
let cache = null; // { at, value }
const chatSessions = new Map(); // sessionId -> history array

const clean = (v) => (v === undefined || v === null ? '' : String(v).trim());
const isMasked = (v) => /^•+/.test(clean(v));
const mask = (secret) => {
    const s = clean(secret);
    if (!s) return '';
    return `${'•'.repeat(8)}${s.slice(-4)}`;
};

async function loadFromDb() {
    if (models.AiSetting) {
        return models.AiSetting.findOne({ order: [['id', 'DESC']] });
    }
    return null;
}

function loadFromBackup() {
    try {
        if (fs.existsSync(BACKUP_FILE)) {
            const raw = fs.readFileSync(BACKUP_FILE, 'utf8');
            return JSON.parse(raw);
        }
    } catch (_) {}
    return null;
}

function saveToBackup(data) {
    try {
        fs.writeFileSync(BACKUP_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (_) {}
}

async function getEffective() {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

    let row = null;
    try {
        row = await loadFromDb();
    } catch (_) {}

    const backup = loadFromBackup();

    const enabled = row ? !!row.AiEnabled : (backup ? !!backup.AiEnabled : true);
    const provider = clean(row ? row.AiProvider : (backup ? backup.AiProvider : 'gemini')) || 'gemini';
    const apiKey = clean(row ? row.AiApiKey : (backup ? backup.AiApiKey : '')) || process.env.APIKEY || '';
    const model = clean(row ? row.AiModel : (backup ? backup.AiModel : 'gemini-1.5-flash')) || 'gemini-1.5-flash';
    const endpointUrl = clean(row ? row.AiEndpointUrl : (backup ? backup.AiEndpointUrl : ''));
    const assistantPlatformUrl = clean(row ? row.AiAssistantPlatformUrl : (backup ? backup.AiAssistantPlatformUrl : ''));
    const allowedRoles = clean(row ? row.AiAllowedRoles : (backup ? backup.AiAllowedRoles : 'super_admin')) || 'super_admin';
    const systemPrompt = clean(row ? row.AiSystemPrompt : (backup ? backup.AiSystemPrompt : ''));

    const value = {
        enabled,
        provider,
        apiKey,
        model,
        endpointUrl,
        assistantPlatformUrl,
        allowedRoles,
        systemPrompt
    };

    cache = { at: Date.now(), value };
    return value;
}

async function getForAdmin() {
    const eff = await getEffective();
    return {
        enabled: eff.enabled,
        provider: eff.provider,
        apiKey: mask(eff.apiKey),
        hasApiKey: !!eff.apiKey,
        model: eff.model,
        endpointUrl: eff.endpointUrl,
        assistantPlatformUrl: eff.assistantPlatformUrl,
        allowedRoles: eff.allowedRoles,
        systemPrompt: eff.systemPrompt,
        availableModels: [
            { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Recommended - Ultra Fast)' },
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Next-Gen)' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Deep Reasoning)' }
        ]
    };
}

async function update(body = {}) {
    const current = await getEffective();
    let row = null;
    try {
        row = await loadFromDb();
    } catch (_) {}

    const secret = (incoming, existing) => (isMasked(incoming) || clean(incoming) === '' ? existing : clean(incoming));

    const next = {
        AiEnabled: body.enabled !== undefined ? !!body.enabled : current.enabled,
        AiProvider: clean(body.provider) || current.provider,
        AiApiKey: secret(body.apiKey, current.apiKey),
        AiModel: clean(body.model) || current.model,
        AiEndpointUrl: clean(body.endpointUrl),
        AiAssistantPlatformUrl: clean(body.assistantPlatformUrl),
        AiAllowedRoles: clean(body.allowedRoles) || 'super_admin',
        AiSystemPrompt: clean(body.systemPrompt)
    };

    if (row) {
        await row.update(next);
    } else if (models.AiSetting) {
        await models.AiSetting.create(next);
    }

    saveToBackup(next);
    cache = null;
    return getForAdmin();
}

async function testConnection(body = {}) {
    const current = await getEffective();
    const candidateKey = isMasked(body.apiKey) || !clean(body.apiKey) ? current.apiKey : clean(body.apiKey);
    const candidateModel = clean(body.model) || current.model || 'gemini-1.5-flash';

    if (!candidateKey) {
        return { success: false, error: 'API Key is missing. Please enter a valid Gemini API key.' };
    }

    try {
        const genAI = new GoogleGenerativeAI(candidateKey);
        const testM = genAI.getGenerativeModel({ model: candidateModel });
        const res = await testM.generateContent('Ping test. Reply with: OK');
        const text = (await res.response).text();
        return {
            success: true,
            message: `Connected successfully to Google Gemini (${candidateModel})!`,
            model: candidateModel,
            sampleReply: text.trim()
        };
    } catch (err) {
        return {
            success: false,
            error: err.message || 'Failed to authenticate with Gemini API'
        };
    }
}

async function getTournamentContext() {
    try {
        let text = 'League Context: Stumpix Premier League (PPL).\n';
        if (models.Tournament) {
            const t = await models.Tournament.findOne({ order: [['id', 'DESC']] });
            if (t) text += `Current Tournament: ${t.Name || 'PPL'}. Status: ${t.Status || 'Active'}.\n`;
        }
        if (models.TeamMaster) {
            const count = await models.TeamMaster.count();
            text += `Total Teams: ${count}.\n`;
        }
        if (models.PlayerMaster) {
            const pCount = await models.PlayerMaster.count();
            text += `Total Players Registered: ${pCount}.\n`;
        }
        if (models.Match) {
            const mCount = await models.Match.count();
            text += `Total Matches Scheduled/Played: ${mCount}.\n`;
        }
        return text;
    } catch (_) {
        return 'League Context: Stumpix Cricket League.\n';
    }
}

async function handleChat(user, body = {}) {
    const config = await getEffective();

    if (!config.enabled) {
        return { error: 'AI Assistant is currently turned OFF by the administrator in Admin Settings.', statusCode: HTTP.BAD_REQUEST };
    }

    // Role check:
    const allowed = (config.allowedRoles || 'super_admin').split(',').map((r) => r.trim());
    const userRole = user && user.role ? user.role : 'visitor';

    if (!allowed.includes(userRole)) {
        return {
            error: `Access denied. The AI Assistant is currently restricted to Admin users (${config.allowedRoles}).`,
            statusCode: HTTP.FORBIDDEN
        };
    }

    const { message, sessionId = 'default-admin' } = body;
    if (!message || !clean(message)) {
        return { error: 'Message cannot be empty.', statusCode: HTTP.BAD_REQUEST };
    }

    const apiKey = config.apiKey || process.env.APIKEY;
    if (!apiKey) {
        return { error: 'Gemini API Key is not configured. Go to Settings > AI Connect to set your API Key.', statusCode: HTTP.BAD_REQUEST };
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const leagueCtx = await getTournamentContext();
        const baseSysPrompt = config.systemPrompt || 
            `You are Stumpix AI, the intelligent executive assistant for the cricket tournament admin.
Be professional, analytical, accurate, and concise. Format responses clearly using markdown bullet points and tables where appropriate.
${leagueCtx}`;

        const model = genAI.getGenerativeModel({
            model: config.model || 'gemini-1.5-flash',
            systemInstruction: baseSysPrompt
        });

        const history = chatSessions.get(sessionId) || [];
        const chat = model.startChat({ history });

        const result = await chat.sendMessage(message);
        const reply = (await result.response).text();

        // Update history (keep last 12 turns)
        history.push({ role: 'user', parts: [{ text: message }] });
        history.push({ role: 'model', parts: [{ text: reply }] });
        if (history.length > 24) history.splice(0, history.length - 24);
        chatSessions.set(sessionId, history);

        return {
            reply,
            model: config.model,
            role: 'assistant',
            timestamp: new Date().toISOString()
        };
    } catch (err) {
        console.error('[AI Service Error]:', err);
        return { error: `Gemini AI Error: ${err.message}`, statusCode: HTTP.INTERNAL_SERVER_ERROR };
    }
}

module.exports = {
    getEffective,
    getForAdmin,
    update,
    testConnection,
    handleChat
};
EOF

echo "=== 4. UPDATE SETTINGS CONTROLLER ==="
node -e '
const fs = require("fs");
const file = "'"$SRC_DIR"'/controllers/settings.controller.js";
let code = fs.readFileSync(file, "utf8");

if (!code.includes("aiConfig")) {
  code = "const aiConfig = require(\x27../services/ai-config.service\x27);\n" + code;
  code += `\n
// AI Assistant Settings
exports.getAiSettings = async (req, res) => {
    const data = await aiConfig.getForAdmin();
    return response.success(res, "AI settings fetched successfully", { ai: data });
};

exports.updateAiSettings = async (req, res) => {
    const data = await aiConfig.update(req.body);
    return response.success(res, "AI settings saved successfully. They are active now.", { ai: data });
};

exports.testAiSettings = async (req, res) => {
    const result = await aiConfig.testConnection(req.body);
    if (!result.success) {
        return response.error(res, { message: result.error || "Gemini API test failed." }, HTTP.BAD_REQUEST);
    }
    return response.success(res, result.message, result);
};

exports.chatWithAi = async (req, res) => {
    const result = await aiConfig.handleChat(req.user, req.body);
    if (result.error) {
        return response.error(res, { message: result.error }, result.statusCode || HTTP.BAD_REQUEST);
    }
    return response.success(res, "AI response generated", result);
};
`;
  fs.writeFileSync(file, code, "utf8");
  console.log("settings.controller.js patched successfully.");
} else {
  console.log("settings.controller.js already has aiConfig.");
}
'

echo "=== 5. UPDATE SETTINGS ROUTES ==="
node -e '
const fs = require("fs");
const file = "'"$SRC_DIR"'/routes/settings.routes.js";
let code = fs.readFileSync(file, "utf8");

if (!code.includes("/ai")) {
  const mountCode = `
// AI Assistant Settings & Chat — admin only for configuration
router.get("/ai", authMiddleware, rbacMiddleware(["super_admin"]), asyncHandler(controller.getAiSettings));
router.put("/ai", authMiddleware, rbacMiddleware(["super_admin"]), asyncHandler(controller.updateAiSettings));
router.post("/ai/test", authMiddleware, rbacMiddleware(["super_admin"]), asyncHandler(controller.testAiSettings));
router.post("/ai/chat", authMiddleware, asyncHandler(controller.chatWithAi));
`;
  code = code.replace("module.exports = router;", mountCode + "\nmodule.exports = router;");
  fs.writeFileSync(file, code, "utf8");
  console.log("settings.routes.js patched successfully.");
} else {
  console.log("settings.routes.js already has /ai routes.");
}
'

echo "=== 6. RESTART NODE SERVICE ==="
touch "$API_DIR/tmp/restart.txt" 2>/dev/null || true
pkill -u u403881955 -f "node.*betapplapi" 2>/dev/null || true
sleep 2

echo "=== BACKEND DEPLOYMENT COMPLETE ==="
