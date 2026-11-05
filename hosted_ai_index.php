<?php
/**
 * Stumpix Cricket League - Standalone Hosted AI API Server
 * Domain: https://ai.kcnanja.com
 * Dedicated 24/7 AI Service powering the Cricket App Floating Bot & Admin Settings.
 * Auto-grounded in Beta tournament database (u403881955_betappl).
 * Strict isolation: Zero write access to Live production.
 */

// 1. Universal CORS Configuration
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
$allowedOrigins = [
    'https://betappl.kcnanja.com',
    'https://betapplapi.kcnanja.com',
    'https://ppl.kcnanja.com',
    'https://pplapi.kcnanja.com',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:4000'
];

if (in_array($origin, $allowedOrigins) || $origin === '*') {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: *");
}

header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Credentials: true");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 2. Paths & Config
$configFile = __DIR__ . '/config.json';
$defaultConfig = [
    'apiKey' => '',
    'model' => 'gemini-1.5-flash',
    'systemPrompt' => 'You are the official Stumpix Cricket League AI Assistant for KCN Cricket League 2026. Be friendly, accurate, and concise. Provide verified tournament statistics, player information, team rosters, and match schedules.',
    'enabled' => true,
    'temperature' => 0.7
];

function loadConfig() {
    global $configFile, $defaultConfig;
    if (file_exists($configFile)) {
        $json = @json_decode(file_get_contents($configFile), true);
        if (is_array($json)) {
            return array_merge($defaultConfig, $json);
        }
    }
    return $defaultConfig;
}

function saveConfig($cfg) {
    global $configFile;
    return @file_put_contents($configFile, json_encode($cfg, JSON_PRETTY_PRINT));
}

// 3. Database Connection (Beta DB u403881955_betappl)
function getDbConnection() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dbConfigFile = __DIR__ . '/db_config.php';
    if (!file_exists($dbConfigFile)) {
        return null;
    }

    $dbConfig = require $dbConfigFile;
    try {
        $dsn = "mysql:host={$dbConfig['host']};dbname={$dbConfig['database']};charset=utf8mb4";
        $pdo = new PDO($dsn, $dbConfig['user'], $dbConfig['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_SILENT,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT => 3
        ]);
        return $pdo;
    } catch (Exception $e) {
        return null;
    }
}

// 4. Grounding Context Generator
function getTournamentContext() {
    $db = getDbConnection();
    $ctx = "=== TOURNAMENT GROUNDING DATA ===\n";
    $ctx .= "Platform: Stumpix Cricket League (Beta Environment)\n";

    if (!$db) {
        $ctx .= "Database: Offline mode (Baseline cached tournament info)\n";
        $ctx .= "Tournament: KCN Cricket League 2026\nFormat: T10 Format (MRS Turf Venue)\n";
        $ctx .= "Teams: 19 Franchise Teams\nPlayers: 58 Registered Players\n";
        return $ctx;
    }

    try {
        // Tournament info
        $t = $db->query("SELECT * FROM Tournaments ORDER BY id DESC LIMIT 1")->fetch();
        if ($t) {
            $ctx .= "Tournament: " . ($t['TournamentName'] ?? 'KCN Cricket League 2026') . "\n";
            if (!empty($t['Format'])) $ctx .= "Format: {$t['Format']}\n";
            if (!empty($t['Venue'])) $ctx .= "Venue: {$t['Venue']}\n";
        }

        // Teams
        $teams = $db->query("SELECT TeamID, Name, ShortName, OwnerName, Captain FROM TeamMasters LIMIT 25")->fetchAll();
        $teamCount = count($teams);
        $ctx .= "Total Teams: $teamCount\n";
        if ($teamCount > 0) {
            $names = array_map(function($tm) {
                return $tm['Name'] . (!empty($tm['ShortName']) ? " ({$tm['ShortName']})" : '');
            }, $teams);
            $ctx .= "Teams: " . implode(', ', $names) . "\n";
        }

        // Registered Players
        $players = $db->query("SELECT PlayerID, Name, Role, BattingStyle, BowlingStyle FROM PlayerMasters LIMIT 30")->fetchAll();
        $playerCount = count($players);
        $ctx .= "Total Registered Players: $playerCount\n";
        if ($playerCount > 0) {
            $sample = array_slice($players, 0, 10);
            $pStrs = array_map(function($p) {
                return "{$p['Name']} (" . ($p['Role'] ?? 'Player') . ")";
            }, $sample);
            $ctx .= "Sample Players: " . implode(', ', $pStrs) . "\n";
        }

        // Matches
        $matches = $db->query("SELECT MatchID, MatchNumber, Venue, Status, ResultNote FROM Matches LIMIT 10")->fetchAll();
        if ($matches) {
            $ctx .= "Matches (" . count($matches) . " scheduled/completed):\n";
            foreach ($matches as $m) {
                $ctx .= "- Match #{$m['MatchNumber']}: Status={$m['Status']}" . (!empty($m['ResultNote']) ? " ({$m['ResultNote']})" : "") . "\n";
            }
        }
    } catch (Exception $e) {
        $ctx .= "Note: Database read partial.\n";
    }

    return $ctx;
}

// 5. Call Google Gemini API
function callGemini($apiKey, $model, $systemPrompt, $context, $userMessage) {
    if (empty($apiKey)) {
        return [
            'success' => false,
            'error' => 'Gemini API Key is not configured on Hosted AI. Please set your Gemini API Key in Admin Settings or at https://ai.kcnanja.com.'
        ];
    }

    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key=" . urlencode($apiKey);

    $prompt = $systemPrompt . "\n\n" . $context . "\n\nUser Question: " . $userMessage;

    $payload = [
        'contents' => [
            [
                'parts' => [
                    ['text' => $prompt]
                ]
            ]
        ],
        'generationConfig' => [
            'temperature' => 0.7,
            'maxOutputTokens' => 1024
        ]
    ];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT => 25,
        CURLOPT_SSL_VERIFYPEER => true
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($curlErr) {
        return ['success' => false, 'error' => "cURL error connecting to Gemini: $curlErr"];
    }

    $json = @json_decode($response, true);
    if ($httpCode !== 200 || !isset($json['candidates'][0]['content']['parts'][0]['text'])) {
        $errMsg = $json['error']['message'] ?? "Gemini API returned HTTP $httpCode: $response";
        return ['success' => false, 'error' => $errMsg];
    }

    $reply = $json['candidates'][0]['content']['parts'][0]['text'];
    return ['success' => true, 'reply' => $reply];
}

// 6. Router
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$requestUri = preg_replace('#^/ai#', '', $requestUri); // normalize if in subdirectory
$requestUri = '/' . ltrim($requestUri, '/');
$method = $_SERVER['REQUEST_METHOD'];

// Route: Health Check
if ($requestUri === '/health' || $requestUri === '/api/health') {
    header('Content-Type: application/json; charset=utf-8');
    $config = loadConfig();
    $db = getDbConnection();
    $teamCount = 0;
    $playerCount = 0;
    if ($db) {
        try {
            $teamCount = (int)$db->query("SELECT count(*) FROM TeamMasters")->fetchColumn();
            $playerCount = (int)$db->query("SELECT count(*) FROM PlayerMasters")->fetchColumn();
        } catch (Exception $e) {}
    }

    echo json_encode([
        'status' => 'ok',
        'service' => 'Stumpix Hosted AI API',
        'domain' => 'ai.kcnanja.com',
        'version' => '1.0.0',
        'configured' => !empty($config['apiKey']),
        'model' => $config['model'] ?? 'gemini-1.5-flash',
        'database' => $db ? 'connected' : 'offline',
        'totalTeams' => $teamCount,
        'totalPlayers' => $playerCount,
        'timestamp' => date('c')
    ], JSON_PRETTY_PRINT);
    exit;
}

// Route: Chat Completion
if ($requestUri === '/api/chat' || $requestUri === '/api/settings/ai/chat') {
    header('Content-Type: application/json; charset=utf-8');
    if ($method !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
        exit;
    }

    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true) ?? [];
    $message = trim($body['message'] ?? '');

    if (empty($message)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Message is required.']);
        exit;
    }

    $config = loadConfig();
    $context = getTournamentContext();
    $res = callGemini($config['apiKey'], $config['model'], $config['systemPrompt'], $context, $message);

    if (!$res['success']) {
        http_response_code(502);
        echo json_encode(['success' => false, 'error' => $res['error'], 'data' => ['reply' => "⚠️ **AI Notice**: " . $res['error']]]);
        exit;
    }

    echo json_encode([
        'success' => true,
        'reply' => $res['reply'],
        'data' => [
            'reply' => $res['reply'],
            'model' => $config['model'],
            'domain' => 'ai.kcnanja.com'
        ]
    ]);
    exit;
}

// Route: Get Settings
if ($requestUri === '/api/settings' || $requestUri === '/api/settings/ai') {
    header('Content-Type: application/json; charset=utf-8');
    $config = loadConfig();

    if ($method === 'GET') {
        $maskedKey = '';
        if (!empty($config['apiKey'])) {
            $maskedKey = '••••••••' . substr($config['apiKey'], -4);
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'provider' => 'hosted',
                'endpointUrl' => 'https://ai.kcnanja.com',
                'model' => $config['model'],
                'apiKey' => $maskedKey,
                'hasKey' => !empty($config['apiKey']),
                'enabled' => (bool)$config['enabled'],
                'systemPrompt' => $config['systemPrompt']
            ]
        ], JSON_PRETTY_PRINT);
        exit;
    }

    if ($method === 'POST' || $method === 'PUT') {
        $raw = file_get_contents('php://input');
        $body = json_decode($raw, true) ?? [];

        if (!empty($body['apiKey']) && strpos($body['apiKey'], '••') === false) {
            $config['apiKey'] = trim($body['apiKey']);
        }
        if (!empty($body['model'])) {
            $config['model'] = trim($body['model']);
        }
        if (isset($body['systemPrompt'])) {
            $config['systemPrompt'] = trim($body['systemPrompt']);
        }
        if (isset($body['enabled'])) {
            $config['enabled'] = (bool)$body['enabled'];
        }

        saveConfig($config);

        echo json_encode([
            'success' => true,
            'message' => 'Hosted AI settings updated successfully.',
            'data' => [
                'provider' => 'hosted',
                'endpointUrl' => 'https://ai.kcnanja.com',
                'model' => $config['model'],
                'hasKey' => !empty($config['apiKey']),
                'enabled' => (bool)$config['enabled']
            ]
        ]);
        exit;
    }
}

// Route: Test API Key
if ($requestUri === '/api/test' || $requestUri === '/api/settings/ai/test') {
    header('Content-Type: application/json; charset=utf-8');
    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true) ?? [];

    $config = loadConfig();
    $testKey = !empty($body['apiKey']) && strpos($body['apiKey'], '••') === false ? trim($body['apiKey']) : $config['apiKey'];
    $testModel = !empty($body['model']) ? trim($body['model']) : $config['model'];

    if (empty($testKey)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'API Key is missing. Please provide a valid Gemini API key.']);
        exit;
    }

    $res = callGemini($testKey, $testModel, "Respond with: PONG", "", "PING");
    if ($res['success']) {
        echo json_encode([
            'success' => true,
            'message' => "Gemini API Key Verified! Model: $testModel is responding normally.",
            'model' => $testModel
        ]);
    } else {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => $res['error']
        ]);
    }
    exit;
}

// 7. Interactive Hosted AI Dashboard (Default Route)
$config = loadConfig();
$db = getDbConnection();
$hasKey = !empty($config['apiKey']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stumpix Hosted AI API (ai.kcnanja.com)</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --border: #1f2937;
      --accent: #4f46e5;
      --accent-glow: rgba(79, 70, 229, 0.3);
      --text: #f3f4f6;
      --text-muted: #9ca3af;
      --success: #10b981;
      --warning: #f59e0b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
    }
    .container {
      max-width: 900px;
      width: 100%;
    }
    header {
      text-align: center;
      margin-bottom: 32px;
    }
    .badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--success);
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 32px;
      font-weight: 800;
      background: linear-gradient(135deg, #fff 0%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    p.subtitle {
      color: var(--text-muted);
      font-size: 15px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      position: relative;
    }
    .card h3 {
      font-size: 14px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .card .value {
      font-size: 22px;
      font-weight: 800;
      color: #fff;
    }
    .card .meta {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .panel {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 28px;
      margin-bottom: 24px;
    }
    .panel h2 {
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .form-group {
      margin-bottom: 18px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 6px;
    }
    input, select, textarea {
      width: 100%;
      background: #0b1120;
      border: 1px solid #374151;
      border-radius: 10px;
      padding: 12px 14px;
      color: #fff;
      font-size: 14px;
      font-family: inherit;
      outline: none;
    }
    input:focus, select:focus, textarea:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-glow);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 22px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .btn-primary {
      background: var(--accent);
      color: #fff;
    }
    .btn-primary:hover {
      background: #4338ca;
    }
    .btn-secondary {
      background: #1f2937;
      color: #e5e7eb;
    }
    .btn-secondary:hover {
      background: #374151;
    }
    .endpoints-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
      margin-top: 12px;
    }
    .endpoints-table th, .endpoints-table td {
      border: 1px solid var(--border);
      padding: 10px 14px;
      text-align: left;
    }
    .endpoints-table th {
      background: rgba(255, 255, 255, 0.03);
      color: var(--text-muted);
    }
    code {
      font-family: 'JetBrains Mono', monospace;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="badge-pill">
        <span>●</span> HOSTED AI API · 24/7 ONLINE
      </div>
      <h1>Stumpix Hosted AI API</h1>
      <p class="subtitle">Dedicated Cloud AI Engine powering the Cricket App Floating Bot (https://ai.kcnanja.com)</p>
    </header>

    <div class="grid">
      <div class="card">
        <h3>Service Status</h3>
        <div class="value" style="color:var(--success);">ONLINE</div>
        <div class="meta">Hosted on Hostinger LiteSpeed</div>
      </div>
      <div class="card">
        <h3>Gemini API Key</h3>
        <div class="value"><?= $hasKey ? '<span style="color:var(--success);">Configured</span>' : '<span style="color:var(--warning);">Missing</span>' ?></div>
        <div class="meta"><?= $hasKey ? '••••' . substr($config['apiKey'], -4) : 'Add key below' ?></div>
      </div>
      <div class="card">
        <h3>Tournament DB</h3>
        <div class="value"><?= $db ? '<span style="color:var(--success);">Connected</span>' : '<span style="color:var(--warning);">Offline</span>' ?></div>
        <div class="meta">u403881955_betappl</div>
      </div>
      <div class="card">
        <h3>Active Model</h3>
        <div class="value" style="font-size:18px;"><?= htmlspecialchars($config['model']) ?></div>
        <div class="meta">Google Gemini Engine</div>
      </div>
    </div>

    <div class="panel">
      <h2>⚙️ Configure Hosted Gemini API Key</h2>
      <form id="settings-form">
        <div class="form-group">
          <label>Google Gemini API Key (GEN API KEY)</label>
          <input type="password" id="gemini-key" placeholder="<?= $hasKey ? '••••••••' . substr($config['apiKey'], -4) . ' (Enter new key to change)' : 'Enter your Gemini API key (AIza...)' ?>" autocomplete="off">
        </div>
        <div class="form-group">
          <label>Model Engine</label>
          <select id="gemini-model">
            <option value="gemini-1.5-flash" <?= $config['model'] === 'gemini-1.5-flash' ? 'selected' : '' ?>>Gemini 1.5 Flash (Ultra-fast, Recommended)</option>
            <option value="gemini-2.0-flash" <?= $config['model'] === 'gemini-2.0-flash' ? 'selected' : '' ?>>Gemini 2.0 Flash (Next-Gen High Performance)</option>
            <option value="gemini-1.5-pro" <?= $config['model'] === 'gemini-1.5-pro' ? 'selected' : '' ?>>Gemini 1.5 Pro (Deep Reasoning & Strategy)</option>
          </select>
        </div>
        <div style="display:flex; gap:12px;">
          <button type="button" class="btn btn-secondary" id="test-btn">⚡ Test Connection</button>
          <button type="submit" class="btn btn-primary" id="save-btn">💾 Save Key & Settings</button>
        </div>
        <div id="status-msg" style="margin-top:14px; font-size:13px; display:none; padding:10px 14px; border-radius:8px;"></div>
      </form>
    </div>

    <div class="panel">
      <h2>🔌 Hosted Endpoints Reference</h2>
      <table class="endpoints-table">
        <thead>
          <tr>
            <th>Method</th>
            <th>Endpoint</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>POST</code></td>
            <td><code>https://ai.kcnanja.com/api/chat</code></td>
            <td>Main AI chat endpoint used by the Cricket Floating Bot</td>
          </tr>
          <tr>
            <td><code>GET</code></td>
            <td><code>https://ai.kcnanja.com/health</code></td>
            <td>Health check with database connection & team counts</td>
          </tr>
          <tr>
            <td><code>GET / POST</code></td>
            <td><code>https://ai.kcnanja.com/api/settings</code></td>
            <td>Get or update Gemini credentials and model configuration</td>
          </tr>
          <tr>
            <td><code>POST</code></td>
            <td><code>https://ai.kcnanja.com/api/test</code></td>
            <td>Live test Gemini API key directly against Google AI Studio</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <script>
    const statusMsg = document.getElementById('status-msg');
    const showMsg = (text, isSuccess) => {
      statusMsg.style.display = 'block';
      statusMsg.style.background = isSuccess ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
      statusMsg.style.color = isSuccess ? '#34d399' : '#f87171';
      statusMsg.style.border = isSuccess ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)';
      statusMsg.textContent = text;
    };

    document.getElementById('test-btn').addEventListener('click', async () => {
      const key = document.getElementById('gemini-key').value.trim();
      const model = document.getElementById('gemini-model').value;
      showMsg('Testing Gemini connectivity...', true);
      try {
        const res = await fetch('/api/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: key, model: model })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showMsg('✅ ' + data.message, true);
        } else {
          showMsg('❌ ' + (data.error || 'Test failed'), false);
        }
      } catch (err) {
        showMsg('❌ Network error: ' + err.message, false);
      }
    });

    document.getElementById('settings-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const key = document.getElementById('gemini-key').value.trim();
      const model = document.getElementById('gemini-model').value;
      const saveBtn = document.getElementById('save-btn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: key, model: model })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showMsg('✅ Settings saved! The Hosted AI is ready for the floating bot.', true);
          setTimeout(() => location.reload(), 1200);
        } else {
          showMsg('❌ ' + (data.error || 'Save failed'), false);
        }
      } catch (err) {
        showMsg('❌ Network error: ' + err.message, false);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save Key & Settings';
      }
    });
  </script>
</body>
</html>
