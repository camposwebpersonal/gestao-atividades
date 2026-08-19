<?php
require_once 'config.php';
ciRequireAuth();
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$pdo    = ciGetDb();

// ── Bootstrap: cria tabelas principais se não existirem ──────────────────────
try { $pdo->exec("CREATE TABLE IF NOT EXISTS ci_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL,
    username VARCHAR(80) DEFAULT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin','auditor','viewer') DEFAULT 'viewer',
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)"); } catch(Throwable $_) {}

try { $pdo->exec("CREATE TABLE IF NOT EXISTS ci_secretariats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    icon VARCHAR(10) DEFAULT '📋',
    color VARCHAR(20) DEFAULT '#3B82F6',
    observacao TEXT DEFAULT NULL,
    responsaveis TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)"); } catch(Throwable $_) {}

try { $pdo->exec("CREATE TABLE IF NOT EXISTS ci_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    secretariat_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    order_num INT DEFAULT 0
)"); } catch(Throwable $_) {}

try { $pdo->exec("CREATE TABLE IF NOT EXISTS ci_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    atividade_id INT NOT NULL,
    category_id INT DEFAULT NULL,
    description VARCHAR(500) NOT NULL,
    item_icon VARCHAR(10) DEFAULT '',
    item_color VARCHAR(20) DEFAULT '',
    status VARCHAR(30) DEFAULT 'pendente',
    observacao TEXT DEFAULT NULL,
    responsaveis TEXT DEFAULT NULL,
    start_date DATE DEFAULT NULL,
    deadline_date DATE DEFAULT NULL,
    conclusion_date DATE DEFAULT NULL,
    show_conclusion_date TINYINT(1) DEFAULT 0,
    order_num INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)"); } catch(Throwable $_) {}

try { $pdo->exec("CREATE TABLE IF NOT EXISTS ci_statuses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    status VARCHAR(30) NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)"); } catch(Throwable $_) {}

try { $pdo->exec("CREATE TABLE IF NOT EXISTS ci_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)"); } catch(Throwable $_) {}

try {
    $cnt = $pdo->query("SELECT COUNT(*) FROM ci_users")->fetchColumn();
    $bootstrapPassword = getenv('CI_BOOTSTRAP_ADMIN_PASSWORD');
    if ((int)$cnt === 0 && $bootstrapPassword !== false && $bootstrapPassword !== '') {
        $pdo->prepare("INSERT INTO ci_users (name,email,username,password,role,active) VALUES (?,?,?,?,?,?)")
            ->execute(['Administrador','admin@workpms.free.nf','admin',password_hash($bootstrapPassword,PASSWORD_DEFAULT),'admin',1]);
    }
} catch(Throwable $_) {}
// ─────────────────────────────────────────────────────────────────────────────

(function(PDO $pdo) {
    $ms = [
        "ALTER TABLE ci_secretariats ADD COLUMN show_stats TINYINT(1) NOT NULL DEFAULT 1",
        "ALTER TABLE ci_secretariats ADD COLUMN show_verba TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE ci_secretariats ADD COLUMN verba_on_subitems TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE ci_secretariats ADD COLUMN verba_sum_subitems TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE ci_secretariats ADD COLUMN verba_has_obs TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE ci_secretariats ADD COLUMN show_origem_verba TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE ci_secretariats ADD COLUMN origem_verba_on_subitems TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE ci_secretariats ADD COLUMN origem_verba_has_obs TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE ci_secretariats ADD COLUMN show_documentacao TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE ci_secretariats ADD COLUMN documentacao_on_subitems TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE ci_secretariats ADD COLUMN documentacao_has_obs TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE ci_secretariats ADD COLUMN show_licitacao TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE ci_secretariats ADD COLUMN licitacao_on_subitems TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE ci_secretariats ADD COLUMN licitacao_has_obs TINYINT(1) NOT NULL DEFAULT 0",
        "ALTER TABLE ci_items ADD COLUMN verba DECIMAL(15,2) DEFAULT NULL",
        "ALTER TABLE ci_items ADD COLUMN verba_obs TEXT DEFAULT NULL",
        "ALTER TABLE ci_items ADD COLUMN origem_verba VARCHAR(255) DEFAULT NULL",
        "ALTER TABLE ci_items ADD COLUMN origem_verba_obs TEXT DEFAULT NULL",
        "ALTER TABLE ci_items ADD COLUMN documentacao TINYINT(1) DEFAULT NULL",
        "ALTER TABLE ci_items ADD COLUMN documentacao_obs TEXT DEFAULT NULL",
        "ALTER TABLE ci_items ADD COLUMN licitacao TINYINT(1) DEFAULT NULL",
        "ALTER TABLE ci_items ADD COLUMN licitacao_obs TEXT DEFAULT NULL",
        "ALTER TABLE ci_subitems ADD COLUMN verba DECIMAL(15,2) DEFAULT NULL",
        "ALTER TABLE ci_subitems ADD COLUMN verba_obs TEXT DEFAULT NULL",
        "ALTER TABLE ci_subitems ADD COLUMN origem_verba VARCHAR(255) DEFAULT NULL",
        "ALTER TABLE ci_subitems ADD COLUMN origem_verba_obs TEXT DEFAULT NULL",
        "ALTER TABLE ci_subitems ADD COLUMN documentacao TINYINT(1) DEFAULT NULL",
        "ALTER TABLE ci_subitems ADD COLUMN documentacao_obs TEXT DEFAULT NULL",
        "ALTER TABLE ci_subitems ADD COLUMN licitacao TINYINT(1) DEFAULT NULL",
        "ALTER TABLE ci_subitems ADD COLUMN licitacao_obs TEXT DEFAULT NULL",
    ];
    foreach ($ms as $sql) { try { $pdo->exec($sql); } catch (Exception $e) {} }
})($pdo);

function ciNormalizeCargoNome($value) {
    $value = trim((string)$value);
    if ($value === '') return '';
    if (function_exists('mb_strtoupper')) {
        $value = mb_strtoupper($value, 'UTF-8');
    } else {
        $value = strtoupper($value);
    }
    $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    if ($ascii !== false) $value = $ascii;
    $value = preg_replace('/^\s*\d+\s*-\s*/', '', $value);
    $value = preg_replace('/[^A-Z0-9]+/', ' ', $value);
    $value = preg_replace('/\s+/', ' ', $value);
    return trim($value);
}

function ciBuildCargoVagasOccupancyMap(PDO $pdo) {
    $rows = $pdo->query(
        "SELECT c.*, o.ultima_competencia
         FROM pms_contratados c
         LEFT JOIN pms_orgaos o ON o.id = c.orgao_id
         WHERE c.orgao_id IS NOT NULL AND TRIM(COALESCE(c.cargo, '')) <> ''"
    )->fetchAll(PDO::FETCH_ASSOC);
    $rows = calc_filtrar_registros_oficiais($rows);
    $map = [];
    foreach ($rows as $row) {
        $key = ((int)$row['orgao_id']) . '|' . ciNormalizeCargoNome($row['cargo'] ?? '');
        if (!isset($map[$key])) $map[$key] = 0;
        $map[$key]++;
    }
    return $map;
}

function ciCargoVagaOccupados(array $occupancyMap, $orgaoId, $cargoNome, $exclude = 0) {
    $key = ((int)$orgaoId) . '|' . ciNormalizeCargoNome($cargoNome);
    $count = (int)($occupancyMap[$key] ?? 0);
    return max(0, $count - max(0, (int)$exclude));
}

function ciFindCargoVagaIdByNormalized(PDO $pdo, $orgaoId, $cargoNome) {
    $st = $pdo->prepare("SELECT id, cargo_nome FROM pms_cargo_vagas WHERE orgao_id=?");
    $st->execute([(int)$orgaoId]);
    $targetNorm = ciNormalizeCargoNome($cargoNome);
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $row) {
        if (ciNormalizeCargoNome($row['cargo_nome'] ?? '') === $targetNorm) {
            return (int)$row['id'];
        }
    }
    return 0;
}

// Auto-migrate: silently add columns that may be missing from older installs
try { $pdo->exec("ALTER TABLE ci_secretariats ADD COLUMN description TEXT DEFAULT NULL"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_secretariats ADD COLUMN observacoes TEXT DEFAULT NULL"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_subitems ADD COLUMN observacao TEXT DEFAULT NULL"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_secretariats ADD COLUMN responsaveis VARCHAR(500) DEFAULT NULL"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_secretariats ADD COLUMN start_date DATE DEFAULT NULL"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_secretariats ADD COLUMN conclusion_date DATE DEFAULT NULL"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_items ADD COLUMN bulk_concluded TINYINT(1) NOT NULL DEFAULT 0"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_subitems ADD COLUMN bulk_concluded TINYINT(1) NOT NULL DEFAULT 0"); } catch(Exception $e) {}
try { $pdo->exec("UPDATE ci_subitems SET responsaveis = NULL WHERE responsaveis = ''"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_items ADD COLUMN responsaveis VARCHAR(500) DEFAULT NULL"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_subitems ADD COLUMN responsaveis VARCHAR(500) DEFAULT NULL"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_categories    ADD COLUMN description TEXT DEFAULT NULL"); } catch(Exception $e) {}
// Controle de Atividades — novos campos em ci_items
try { $pdo->exec("ALTER TABLE ci_items ADD COLUMN atividade_id INT DEFAULT NULL"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_items ADD COLUMN item_icon VARCHAR(30) DEFAULT '📋'"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_items ADD COLUMN item_color VARCHAR(20) DEFAULT '#3B82F6'"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_items ADD COLUMN observacao TEXT DEFAULT NULL"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_items ADD COLUMN start_date DATE DEFAULT NULL"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_items ADD COLUMN deadline_date DATE DEFAULT NULL"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_items ADD COLUMN concluded TINYINT(1) NOT NULL DEFAULT 0"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_items ADD COLUMN conclusion_date DATE DEFAULT NULL"); } catch(Exception $e) {}
// Tornar category_id nullable para suportar itens de atividade (sem categoria)
try { $pdo->exec("ALTER TABLE ci_items DROP FOREIGN KEY ci_items_ibfk_1"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_items MODIFY COLUMN category_id INT DEFAULT NULL"); } catch(Exception $e) {}
// Sub-itens de atividade
try { $pdo->exec("CREATE TABLE IF NOT EXISTS ci_subitems (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id INT NOT NULL,
    description VARCHAR(255) NOT NULL,
    start_date DATE DEFAULT NULL,
    deadline_date DATE DEFAULT NULL,
    concluded TINYINT(1) NOT NULL DEFAULT 0,
    conclusion_date DATE DEFAULT NULL,
    show_conclusion_date TINYINT(1) NOT NULL DEFAULT 1,
    order_num INT NOT NULL DEFAULT 0
)"); } catch(Exception $e) {}

// Campos personalizados dos sub-itens
try { $pdo->exec("CREATE TABLE IF NOT EXISTS ci_field_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    atividade_id INT NULL,
    item_id INT NULL,
    field_name VARCHAR(100) NOT NULL,
    field_type VARCHAR(20) DEFAULT 'text',
    order_num INT DEFAULT 0
)"); } catch(Exception $e) {}
try { $pdo->exec("CREATE TABLE IF NOT EXISTS ci_subitem_fields (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subitem_id INT NOT NULL,
    template_id INT NULL,
    field_name VARCHAR(100) NOT NULL,
    field_value TEXT DEFAULT '',
    order_num INT DEFAULT 0
)"); } catch(Exception $e) {}

// Imagens representativas e galeria
try { $pdo->exec("CREATE TABLE IF NOT EXISTS ci_entity_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(20) NOT NULL,
    entity_id INT NOT NULL,
    is_representative TINYINT(1) DEFAULT 0,
    title VARCHAR(200) DEFAULT '',
    obs TEXT DEFAULT '',
    image_data MEDIUMTEXT NOT NULL,
    order_num INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_entity (entity_type, entity_id)
)"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_secretariats ADD COLUMN cover_thumb MEDIUMTEXT DEFAULT NULL"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_secretariats ADD COLUMN resp_thumb MEDIUMTEXT DEFAULT NULL"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_items ADD COLUMN cover_thumb MEDIUMTEXT DEFAULT NULL"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_items ADD COLUMN resp_thumb MEDIUMTEXT DEFAULT NULL"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_subitems ADD COLUMN cover_thumb MEDIUMTEXT DEFAULT NULL"); } catch(Exception $e) {}
try { $pdo->exec("ALTER TABLE ci_subitems ADD COLUMN resp_thumb MEDIUMTEXT DEFAULT NULL"); } catch(Exception $e) {}

try {
    switch ($action) {

        // ── GET all data (secretariats, categories, items, statuses) ─────────
        case 'data':
            $secretariats = $pdo->query(
                "SELECT * FROM ci_secretariats ORDER BY order_num"
            )->fetchAll();

            $categories = $pdo->query(
                "SELECT * FROM ci_categories ORDER BY secretariat_id, order_num"
            )->fetchAll();

            $items = $pdo->query(
                "SELECT * FROM ci_items ORDER BY category_id, order_num"
            )->fetchAll();

            $statuses = $pdo->query(
                "SELECT s.*, u.name AS updated_by_name
                 FROM ci_status s
                 LEFT JOIN ci_users u ON u.id = s.updated_by"
            )->fetchAll();

            // index statuses by item_id
            $statusMap = [];
            foreach ($statuses as $st) {
                $statusMap[$st['item_id']] = $st;
            }

            $subitems = $pdo->query(
                "SELECT * FROM ci_subitems ORDER BY item_id, order_num"
            )->fetchAll();

            $fieldTemplates = $pdo->query(
                "SELECT * FROM ci_field_templates ORDER BY atividade_id, item_id, order_num"
            )->fetchAll();

            $sfRows = $pdo->query(
                "SELECT * FROM ci_subitem_fields ORDER BY subitem_id, order_num"
            )->fetchAll();
            $subitemFieldsMap = [];
            foreach ($sfRows as $sf) {
                $subitemFieldsMap[(int)$sf['subitem_id']][] = $sf;
            }

            ciJson([
                'ok'             => true,
                'secretariats'   => $secretariats,
                'categories'     => $categories,
                'items'          => $items,
                'subitems'       => $subitems,
                'statuses'       => $statusMap,
                'field_templates'=> $fieldTemplates,
                'subitem_fields' => $subitemFieldsMap,
            ]);
            break;

        // ── UPDATE item status ───────────────────────────────────────────────
        case 'update_status':
            $body        = json_decode(file_get_contents('php://input'), true) ?? [];
            $itemId      = (int)($body['item_id']    ?? 0);
            $status      = $body['status']           ?? 'pendente';
            $notes       = trim($body['notes']       ?? '');
            $responsible = trim($body['responsible'] ?? '');
            $deadline    = $body['deadline']         ?? null;

            $allowed = ['pendente','solicitado','recebido','analisando','aprovado','ressalva','reprovado'];
            if (!in_array($status, $allowed)) {
                ciJson(['ok' => false, 'error' => 'Status inválido'], 400);
            }
            if ($deadline === '') $deadline = null;

            $stmt = $pdo->prepare(
                "INSERT INTO ci_status (item_id, status, notes, responsible, deadline, updated_by)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                   status      = VALUES(status),
                   notes       = VALUES(notes),
                   responsible = VALUES(responsible),
                   deadline    = VALUES(deadline),
                   updated_by  = VALUES(updated_by),
                   updated_at  = NOW()"
            );
            $stmt->execute([$itemId, $status, $notes, $responsible, $deadline, $_SESSION['ci_uid']]);

            // get item description for log
            $desc = $pdo->prepare("SELECT description FROM ci_items WHERE id = ?");
            $desc->execute([$itemId]);
            $row  = $desc->fetch();
            ciLogAction($pdo, 'update_status', "Item #$itemId → $status | " . substr($row['description'] ?? '', 0, 80));

            ciJson(['ok' => true, 'item_id' => $itemId, 'status' => $status]);
            break;

        // ── GET users (admin only) ───────────────────────────────────────────
        case 'users':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            try {
                $users = $pdo->query(
                    "SELECT id, name, email, username, role, active, created_at FROM ci_users ORDER BY name"
                )->fetchAll();
            } catch (\PDOException $e) {
                // username column may not exist yet (migration pending) — fallback without it
                $users = $pdo->query(
                    "SELECT id, name, email, NULL as username, role, active, created_at FROM ci_users ORDER BY name"
                )->fetchAll();
            }
            ciJson(['ok' => true, 'users' => $users]);
            break;

        // ── ADD user (admin only) ────────────────────────────────────────────
        case 'add_user':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body     = json_decode(file_get_contents('php://input'), true) ?? [];
            $name     = trim($body['name']     ?? '');
            $email    = trim($body['email']    ?? '');
            $pass     = $body['password']      ?? '';
            $role     = $body['role']          ?? 'viewer';
            $username = trim($body['username'] ?? '') ?: null;

            if (!$name || !$email || !$pass) ciJson(['ok' => false, 'error' => 'Campos obrigatórios faltando'], 400);
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) ciJson(['ok' => false, 'error' => 'E-mail inválido'], 400);

            $roles = ['admin','auditor','viewer'];
            if (!in_array($role, $roles)) ciJson(['ok' => false, 'error' => 'Perfil inválido'], 400);

            // Validar username se fornecido
            if ($username !== null) {
                if (!preg_match('/^[a-zA-Z0-9._-]{3,60}$/', $username)) {
                    ciJson(['ok' => false, 'error' => 'Usuário deve ter 3-60 caracteres (letras, números, ponto, traço, underscore)'], 400);
                }
            }

            $hash = password_hash($pass, PASSWORD_DEFAULT);
            // Remove restrição UNIQUE de email (idempotente: falha silenciosamente se já removida)
            try { $pdo->exec("ALTER TABLE ci_users DROP INDEX uk_email"); } catch (Throwable $_) {}
try { $pdo->exec("CREATE TABLE IF NOT EXISTS ci_entity_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entity_type VARCHAR(20) NOT NULL COMMENT 'activity, item, subitem',
    entity_id INT NOT NULL,
    is_representative TINYINT(1) DEFAULT 0,
    title VARCHAR(200) DEFAULT '',
    obs TEXT DEFAULT '',
    image_data MEDIUMTEXT NOT NULL,
    order_num INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_entity (entity_type, entity_id)
)"); } catch(Throwable $_) {}
try { $pdo->exec("ALTER TABLE ci_items ADD COLUMN verbas_list TEXT NOT NULL DEFAULT '[]'"); } catch(Throwable $_) {}
try { $pdo->exec("ALTER TABLE ci_subitems ADD COLUMN verbas_list TEXT NOT NULL DEFAULT '[]'"); } catch(Throwable $_) {}
            try {
                $pdo->prepare("INSERT INTO ci_users (name, email, username, password, role) VALUES (?, ?, ?, ?, ?)")
                    ->execute([$name, $email, $username, $hash, $role]);
                ciLogAction($pdo, 'add_user', "Novo usuário: $name ($email)" . ($username ? " @$username" : '') . " — $role");
                ciJson(['ok' => true, 'id' => $pdo->lastInsertId()]);
            } catch (PDOException $e) {
                if (strpos($e->getMessage(), 'username') !== false) {
                    ciJson(['ok' => false, 'error' => 'Nome de usuário já cadastrado'], 409);
                }
                ciJson(['ok' => false, 'error' => 'Erro ao criar usuário: ' . $e->getMessage()], 500);
            }
            break;

        // ── TOGGLE user active (admin only) ─────────────────────────────────
        case 'toggle_user':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body   = json_decode(file_get_contents('php://input'), true) ?? [];
            $userId = (int)($body['user_id'] ?? 0);
            if ($userId === (int)$_SESSION['ci_uid']) ciJson(['ok' => false, 'error' => 'Você não pode desativar sua própria conta'], 400);
            $pdo->prepare("UPDATE ci_users SET active = 1 - active WHERE id = ?")
                ->execute([$userId]);
            ciLogAction($pdo, 'toggle_user', "Usuário #$userId ativado/desativado");
            ciJson(['ok' => true]);
            break;

        // ── RESET user password (admin only) ────────────────────────────────
        case 'reset_password':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body     = json_decode(file_get_contents('php://input'), true) ?? [];
            $userId   = (int)($body['user_id']  ?? 0);
            $newPass  = $body['new_password'] ?? '';
            if (!$newPass || strlen($newPass) < 6) ciJson(['ok' => false, 'error' => 'Senha muito curta (mínimo 6 caracteres)'], 400);
            $hash = password_hash($newPass, PASSWORD_DEFAULT);
            $pdo->prepare("UPDATE ci_users SET password = ? WHERE id = ?")->execute([$hash, $userId]);
            ciLogAction($pdo, 'reset_password', "Senha redefinida para usuário #$userId");
            ciJson(['ok' => true]);
            break;

        // ── EDIT user (admin only) ───────────────────────────────────────────
        case 'edit_user':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body     = json_decode(file_get_contents('php://input'), true) ?? [];
            $userId   = (int)($body['user_id']  ?? 0);
            $name     = trim($body['name']       ?? '');
            $email    = trim($body['email']      ?? '');
            $role     = $body['role']            ?? '';
            $newPass  = $body['new_password']    ?? '';
            $username = array_key_exists('username', $body) ? (trim($body['username']) ?: null) : false;
            if (!$userId || !$name || !$email) ciJson(['ok' => false, 'error' => 'Campos obrigatórios faltando'], 400);
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) ciJson(['ok' => false, 'error' => 'E-mail inválido'], 400);
            $roles = ['admin','auditor','viewer'];
            if (!in_array($role, $roles)) ciJson(['ok' => false, 'error' => 'Perfil inválido'], 400);
            if ($newPass !== '' && strlen($newPass) < 6) ciJson(['ok' => false, 'error' => 'Senha muito curta (mínimo 6 caracteres)'], 400);
            if ($username !== false && $username !== null) {
                if (!preg_match('/^[a-zA-Z0-9._-]{3,60}$/', $username)) {
                    ciJson(['ok' => false, 'error' => 'Usuário deve ter 3-60 caracteres (letras, números, ponto, traço, underscore)'], 400);
                }
            }
            try {
                // Build dynamic update
                $sets  = ['name=?', 'email=?', 'role=?'];
                $vals  = [$name, $email, $role];
                if ($newPass !== '') {
                    $sets[] = 'password=?';
                    $vals[] = password_hash($newPass, PASSWORD_DEFAULT);
                }
                if ($username !== false) {
                    $sets[] = 'username=?';
                    $vals[] = $username;
                }
                $vals[] = $userId;
                $pdo->prepare('UPDATE ci_users SET ' . implode(',', $sets) . ' WHERE id=?')
                    ->execute($vals);
                ciLogAction($pdo, 'edit_user', "Usuário #$userId editado: $name ($email) — $role");
                ciJson(['ok' => true]);
            } catch (PDOException $e) {
                if (strpos($e->getMessage(), 'username') !== false) {
                    ciJson(['ok' => false, 'error' => 'Nome de usuário já cadastrado por outro usuário'], 409);
                }
                ciJson(['ok' => false, 'error' => 'Erro ao atualizar usuário: ' . $e->getMessage()], 500);
            }
            break;

        // ── DELETE user (admin only) ─────────────────────────────────────────
        case 'delete_user':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body   = json_decode(file_get_contents('php://input'), true) ?? [];
            $userId = (int)($body['user_id'] ?? 0);
            if (!$userId) ciJson(['ok' => false, 'error' => 'ID inválido'], 400);
            if ($userId === (int)$_SESSION['ci_uid']) ciJson(['ok' => false, 'error' => 'Você não pode deletar sua própria conta'], 400);
            $pdo->prepare("DELETE FROM ci_users WHERE id = ?")->execute([$userId]);
            ciLogAction($pdo, 'delete_user', "Usuário #$userId removido");
            ciJson(['ok' => true]);
            break;

        // ── AUDIT LOG (admin only) ────────────────────────────────────────────
        case 'audit_log':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $limit = min((int)($_GET['limit'] ?? 100), 500);
            $logs  = $pdo->prepare(
                "SELECT l.*, u.name AS user_name
                 FROM ci_audit_log l
                 LEFT JOIN ci_users u ON u.id = l.user_id
                 ORDER BY l.created_at DESC LIMIT ?"
            );
            $logs->execute([$limit]);
            ciJson(['ok' => true, 'logs' => $logs->fetchAll()]);
            break;

        // ── STATS summary ───────────────────────────────────────────────────
        case 'stats':
            $totalItems = (int)$pdo->query("SELECT COUNT(*) FROM ci_items")->fetchColumn();
            $byStatus   = $pdo->query(
                "SELECT status, COUNT(*) AS cnt FROM ci_status GROUP BY status"
            )->fetchAll();
            $statusMap  = [];
            foreach ($byStatus as $r) $statusMap[$r['status']] = (int)$r['cnt'];

            $bySecretariat = $pdo->query(
                "SELECT sec.id, sec.name, sec.color, sec.icon,
                    COUNT(i.id)   AS total,
                    SUM(CASE WHEN st.status = 'aprovado' THEN 1 ELSE 0 END) AS aprovados,
                    SUM(CASE WHEN st.status = 'reprovado' THEN 1 ELSE 0 END) AS reprovados,
                    SUM(CASE WHEN st.status = 'ressalva' THEN 1 ELSE 0 END) AS ressalva
                 FROM ci_secretariats sec
                 JOIN ci_categories cat ON cat.secretariat_id = sec.id
                 JOIN ci_items i ON i.category_id = cat.id
                 LEFT JOIN ci_status st ON st.item_id = i.id
                 GROUP BY sec.id ORDER BY sec.order_num"
            )->fetchAll();

            ciJson([
                'ok'             => true,
                'total'          => $totalItems,
                'by_status'      => $statusMap,
                'by_secretariat' => $bySecretariat,
            ]);
            break;

        // ── ADD secretariat ─────────────────────────────────────────
        case 'add_secretariat':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body  = json_decode(file_get_contents('php://input'), true) ?? [];
            $name      = trim($body['name']        ?? '');
            $icon      = trim($body['icon']        ?? '📋');
            $color     = trim($body['color']       ?? '#3B82F6');
            $desc      = trim($body['description'] ?? '');
            $observ      = trim($body['observacoes']  ?? '');
            $responsaveis= trim($body['responsaveis'] ?? '');
            $startDate   = ($body['start_date'] ?? '') ?: null;
            if (!$name) ciJson(['ok' => false, 'error' => 'Nome é obrigatório'], 400);

            $showStats=isset($body['show_stats'])?(int)(bool)$body['show_stats']:1;
            $showVerba=(int)!empty($body['show_verba']);$vOnSubs=(int)!empty($body['verba_on_subitems']);
            $vSumSubs=(int)!empty($body['verba_sum_subitems']);$vHasObs=(int)!empty($body['verba_has_obs']);
            $showOV=(int)!empty($body['show_origem_verba']);$ovOnSubs=(int)!empty($body['origem_verba_on_subitems']);
            $ovHasObs=(int)!empty($body['origem_verba_has_obs']);$showDoc=(int)!empty($body['show_documentacao']);
            $docOnSubs=(int)!empty($body['documentacao_on_subitems']);$docHasObs=(int)!empty($body['documentacao_has_obs']);
            $showLic=(int)!empty($body['show_licitacao']);$licOnSubs=(int)!empty($body['licitacao_on_subitems']);
            $licHasObs=(int)!empty($body['licitacao_has_obs']);
            $maxStmt = $pdo->query("SELECT COALESCE(MAX(order_num),0) FROM ci_secretariats");
            $maxOrd  = (int)$maxStmt->fetchColumn();
            $pdo->prepare("INSERT INTO ci_secretariats (name,icon,color,description,observacoes,responsaveis,start_date,order_num,show_stats,show_verba,verba_on_subitems,verba_sum_subitems,verba_has_obs,show_origem_verba,origem_verba_on_subitems,origem_verba_has_obs,show_documentacao,documentacao_on_subitems,documentacao_has_obs,show_licitacao,licitacao_on_subitems,licitacao_has_obs) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
                ->execute([$name, $icon, $color, $desc, $observ, $responsaveis, $startDate, $maxOrd + 1,$showStats,$showVerba,$vOnSubs,$vSumSubs,$vHasObs,$showOV,$ovOnSubs,$ovHasObs,$showDoc,$docOnSubs,$docHasObs,$showLic,$licOnSubs,$licHasObs]);
            ciLogAction($pdo, 'add_secretariat', "Nova secretaria: $name");
            ciJson(['ok' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'edit_secretariat':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body  = json_decode(file_get_contents('php://input'), true) ?? [];
            $id    = (int)($body['id']         ?? 0);
            $name      = trim($body['name']        ?? '');
            $icon      = trim($body['icon']        ?? '📋');
            $color     = trim($body['color']       ?? '#3B82F6');
            $desc      = trim($body['description'] ?? '');
            $observ      = trim($body['observacoes']  ?? '');
            $responsaveis= trim($body['responsaveis'] ?? '');
            $startDate   = ($body['start_date'] ?? '') ?: null;
            if (!$id || !$name) ciJson(['ok' => false, 'error' => 'Dados inválidos'], 400);

            $showStats=isset($body['show_stats'])?(int)(bool)$body['show_stats']:1;
            $showVerba=(int)!empty($body['show_verba']);$vOnSubs=(int)!empty($body['verba_on_subitems']);
            $vSumSubs=(int)!empty($body['verba_sum_subitems']);$vHasObs=(int)!empty($body['verba_has_obs']);
            $showOV=(int)!empty($body['show_origem_verba']);$ovOnSubs=(int)!empty($body['origem_verba_on_subitems']);
            $ovHasObs=(int)!empty($body['origem_verba_has_obs']);$showDoc=(int)!empty($body['show_documentacao']);
            $docOnSubs=(int)!empty($body['documentacao_on_subitems']);$docHasObs=(int)!empty($body['documentacao_has_obs']);
            $showLic=(int)!empty($body['show_licitacao']);$licOnSubs=(int)!empty($body['licitacao_on_subitems']);
            $licHasObs=(int)!empty($body['licitacao_has_obs']);
            $pdo->prepare("UPDATE ci_secretariats SET name=?,icon=?,color=?,description=?,observacoes=?,responsaveis=?,start_date=?,show_stats=?,show_verba=?,verba_on_subitems=?,verba_sum_subitems=?,verba_has_obs=?,show_origem_verba=?,origem_verba_on_subitems=?,origem_verba_has_obs=?,show_documentacao=?,documentacao_on_subitems=?,documentacao_has_obs=?,show_licitacao=?,licitacao_on_subitems=?,licitacao_has_obs=? WHERE id=?")
                ->execute([$name, $icon, $color, $desc, $observ, $responsaveis, $startDate,$showStats,$showVerba,$vOnSubs,$vSumSubs,$vHasObs,$showOV,$ovOnSubs,$ovHasObs,$showDoc,$docOnSubs,$docHasObs,$showLic,$licOnSubs,$licHasObs,$id]);
            ciLogAction($pdo, 'edit_secretariat', "Secretaria #$id editada: $name");
            ciJson(['ok' => true]);
            break;

        case 'delete_secretariat':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body = json_decode(file_get_contents('php://input'), true) ?? [];
            $id   = (int)($body['id'] ?? 0);
            if (!$id) ciJson(['ok' => false, 'error' => 'ID inválido'], 400);
            $cats = $pdo->prepare("SELECT id FROM ci_categories WHERE secretariat_id=?");
            $cats->execute([$id]);
            foreach ($cats->fetchAll(PDO::FETCH_COLUMN) as $cid) {
                $itms = $pdo->prepare("SELECT id FROM ci_items WHERE category_id=?");
                $itms->execute([$cid]);
                foreach ($itms->fetchAll(PDO::FETCH_COLUMN) as $iid) {
                    $pdo->prepare("DELETE FROM ci_status WHERE item_id=?")->execute([$iid]);
                }
                $pdo->prepare("DELETE FROM ci_items WHERE category_id=?")->execute([$cid]);
            }
            $pdo->prepare("DELETE FROM ci_categories WHERE secretariat_id=?")->execute([$id]);
            // Deletar também itens ligados diretamente à atividade (novo modelo)
            $pdo->prepare("DELETE FROM ci_items WHERE atividade_id=?")->execute([$id]);
            $pdo->prepare("DELETE FROM ci_secretariats WHERE id=?")->execute([$id]);
            ciLogAction($pdo, 'delete_secretariat', "Atividade #$id excluída");
            ciJson(['ok' => true]);
            break;

        // ── ADD/EDIT/DELETE category ─────────────────────────────────
        case 'add_category':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body  = json_decode(file_get_contents('php://input'), true) ?? [];
            $secId = (int)($body['secretariat_id'] ?? 0);
            $name  = trim($body['name']            ?? '');
            $desc  = trim($body['description']     ?? '');
            if (!$secId || !$name) ciJson(['ok' => false, 'error' => 'Dados inválidos'], 400);
            $moStmt = $pdo->prepare("SELECT COALESCE(MAX(order_num),0) FROM ci_categories WHERE secretariat_id=?");
            $moStmt->execute([$secId]);
            $maxOrd = (int)$moStmt->fetchColumn();
            $pdo->prepare("INSERT INTO ci_categories (secretariat_id,name,description,order_num) VALUES(?,?,?,?)")
                ->execute([$secId, $name, $desc, $maxOrd + 1]);
            ciLogAction($pdo, 'add_category', "Nova categoria: $name");
            ciJson(['ok' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'edit_category':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body = json_decode(file_get_contents('php://input'), true) ?? [];
            $id   = (int)($body['id']          ?? 0);
            $name = trim($body['name']          ?? '');
            $desc = trim($body['description']   ?? '');
            if (!$id || !$name) ciJson(['ok' => false, 'error' => 'Dados inválidos'], 400);
            $pdo->prepare("UPDATE ci_categories SET name=?,description=? WHERE id=?")
                ->execute([$name, $desc, $id]);
            ciLogAction($pdo, 'edit_category', "Categoria #$id editada: $name");
            ciJson(['ok' => true]);
            break;

        case 'delete_category':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body = json_decode(file_get_contents('php://input'), true) ?? [];
            $id   = (int)($body['id'] ?? 0);
            if (!$id) ciJson(['ok' => false, 'error' => 'ID inválido'], 400);
            $itms = $pdo->prepare("SELECT id FROM ci_items WHERE category_id=?");
            $itms->execute([$id]);
            foreach ($itms->fetchAll(PDO::FETCH_COLUMN) as $iid) {
                $pdo->prepare("DELETE FROM ci_status WHERE item_id=?")->execute([$iid]);
            }
            $pdo->prepare("DELETE FROM ci_items WHERE category_id=?")->execute([$id]);
            $pdo->prepare("DELETE FROM ci_categories WHERE id=?")->execute([$id]);
            ciLogAction($pdo, 'delete_category', "Categoria #$id excluída");
            ciJson(['ok' => true]);
            break;

        // ── ADD/EDIT/DELETE item ──────────────────────────────────────
        case 'add_ci_item':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body   = json_decode(file_get_contents('php://input'), true) ?? [];
            $catId  = (int)($body['category_id']  ?? 0);
            $desc   = trim($body['description']   ?? '');
            if (!$catId || !$desc) ciJson(['ok' => false, 'error' => 'Dados inválidos'], 400);
            $moStmt2 = $pdo->prepare("SELECT COALESCE(MAX(order_num),0) FROM ci_items WHERE category_id=?");
            $moStmt2->execute([$catId]);
            $maxOrd2 = (int)$moStmt2->fetchColumn();
            $pdo->prepare("INSERT INTO ci_items (category_id,description,order_num) VALUES(?,?,?)")
                ->execute([$catId, $desc, $maxOrd2 + 1]);
            ciLogAction($pdo, 'add_ci_item', "Novo item: " . substr($desc, 0, 80));
            ciJson(['ok' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'edit_ci_item':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body = json_decode(file_get_contents('php://input'), true) ?? [];
            $id   = (int)($body['id']          ?? 0);
            $desc = trim($body['description']  ?? '');
            if (!$id || !$desc) ciJson(['ok' => false, 'error' => 'Dados inválidos'], 400);
            $pdo->prepare("UPDATE ci_items SET description=? WHERE id=?")->execute([$desc, $id]);
            ciLogAction($pdo, 'edit_ci_item', "Item #$id editado");
            ciJson(['ok' => true]);
            break;

        case 'delete_ci_item':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body = json_decode(file_get_contents('php://input'), true) ?? [];
            $id   = (int)($body['id'] ?? 0);
            if (!$id) ciJson(['ok' => false, 'error' => 'ID inválido'], 400);
            $pdo->prepare("DELETE FROM ci_status WHERE item_id=?")->execute([$id]);
            $pdo->prepare("DELETE FROM ci_subitems WHERE item_id=?")->execute([$id]);
            $pdo->prepare("DELETE FROM ci_items WHERE id=?")->execute([$id]);
            ciLogAction($pdo, 'delete_ci_item', "Item #$id excluído");
            ciJson(['ok' => true]);
            break;

        // ── ADD item de atividade (direto na atividade, sem categoria) ──────
        case 'add_atividade_item':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body        = json_decode(file_get_contents('php://input'), true) ?? [];
            $atividadeId = (int)($body['atividade_id'] ?? 0);
            $desc        = trim($body['description'] ?? '');
            if (!$atividadeId || !$desc) ciJson(['ok' => false, 'error' => 'Dados inválidos'], 400);
            $icon        = trim($body['item_icon']     ?? '') ?: '📋';
            $color       = trim($body['item_color']    ?? '') ?: '#3B82F6';
            $observacao  = trim($body['observacao']    ?? '');
            $responsaveis= trim($body['responsaveis']  ?? '');
            $startDate   = ($body['start_date']        ?? '') ?: null;
            $deadlineDate= ($body['deadline_date']     ?? '') ?: null;
            $moAt = $pdo->prepare("SELECT COALESCE(MAX(order_num),0) FROM ci_items WHERE atividade_id=?");
            $moAt->execute([$atividadeId]);
            $maxAt = (int)$moAt->fetchColumn();

            $verba=is_numeric($body['verba']??'')?((float)$body['verba']):null;
            $vObs=trim($body['verba_obs']??'')?:null;$oV=trim($body['origem_verba']??'')?:null;
            $oVObs=trim($body['origem_verba_obs']??'')?:null;
            $docV=(isset($body['documentacao'])&&$body['documentacao']!==''&&$body['documentacao']!==null)?(int)$body['documentacao']:null;
            $docObs=trim($body['documentacao_obs']??'')?:null;
            $licV=(isset($body['licitacao'])&&$body['licitacao']!==''&&$body['licitacao']!==null)?(int)$body['licitacao']:null;
            $licObs=trim($body['licitacao_obs']??'')?:null;
            $vbList=json_encode(array_values(array_filter(is_array($body['verbas_list']??null)?$body['verbas_list']:json_decode($body['verbas_list']??'[]',true)??[],fn($e)=>is_array($e)&&is_numeric($e['v']??''))));
            $pdo->prepare(
                "INSERT INTO ci_items (atividade_id, description, item_icon, item_color, observacao, responsaveis, start_date, deadline_date, order_num, verba, verba_obs, origem_verba, origem_verba_obs, documentacao, documentacao_obs, licitacao, licitacao_obs, verbas_list)
                 VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
            )->execute([$atividadeId, $desc, $icon, $color, $observacao, $responsaveis, $startDate, $deadlineDate, $maxAt + 1,$verba,$vObs,$oV,$oVObs,$docV,$docObs,$licV,$licObs,$vbList]);
            ciLogAction($pdo, 'add_atividade_item', "Novo item atividade: " . substr($desc, 0, 80));
            ciJson(['ok' => true, 'id' => $pdo->lastInsertId()]);
            break;

        // ── EDIT item de atividade ───────────────────────────────────────────
        case 'edit_atividade_item':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body        = json_decode(file_get_contents('php://input'), true) ?? [];
            $id          = (int)($body['id'] ?? 0);
            $desc        = trim($body['description'] ?? '');
            if (!$id || !$desc) ciJson(['ok' => false, 'error' => 'Dados inválidos'], 400);
            $icon        = trim($body['item_icon']     ?? '') ?: '📋';
            $color       = trim($body['item_color']    ?? '') ?: '#3B82F6';
            $observacao  = trim($body['observacao']    ?? '');
            $responsaveis= trim($body['responsaveis']  ?? '');
            $startDate   = ($body['start_date']        ?? '') ?: null;
            $deadlineDate= ($body['deadline_date']     ?? '') ?: null;

            $verba=is_numeric($body['verba']??'')?((float)$body['verba']):null;
            $vObs=trim($body['verba_obs']??'')?:null;$oV=trim($body['origem_verba']??'')?:null;
            $oVObs=trim($body['origem_verba_obs']??'')?:null;
            $docV=(isset($body['documentacao'])&&$body['documentacao']!==''&&$body['documentacao']!==null)?(int)$body['documentacao']:null;
            $docObs=trim($body['documentacao_obs']??'')?:null;
            $licV=(isset($body['licitacao'])&&$body['licitacao']!==''&&$body['licitacao']!==null)?(int)$body['licitacao']:null;
            $licObs=trim($body['licitacao_obs']??'')?:null;
            $vbList=json_encode(array_values(array_filter(is_array($body['verbas_list']??null)?$body['verbas_list']:json_decode($body['verbas_list']??'[]',true)??[],fn($e)=>is_array($e)&&is_numeric($e['v']??''))));
            $pdo->prepare(
                "UPDATE ci_items SET description=?, item_icon=?, item_color=?, observacao=?, responsaveis=?, start_date=?, deadline_date=?, verba=?, verba_obs=?, origem_verba=?, origem_verba_obs=?, documentacao=?, documentacao_obs=?, licitacao=?, licitacao_obs=?, verbas_list=? WHERE id=?"
            )->execute([$desc, $icon, $color, $observacao, $responsaveis, $startDate, $deadlineDate,$verba,$vObs,$oV,$oVObs,$docV,$docObs,$licV,$licObs,$vbList, $id]);
            // Propagar responsaveis para sub-itens que ainda não têm responsável (IS NULL)
            if ($responsaveis !== '') {
                $pdo->prepare("UPDATE ci_subitems SET responsaveis=? WHERE item_id=? AND responsaveis IS NULL")
                    ->execute([$responsaveis, $id]);
            }
            ciLogAction($pdo, 'edit_atividade_item', "Item atividade #$id editado");
            ciJson(['ok' => true]);
            break;

        // ── MARCAR ATIVIDADE CONCLUÍDA (todos os itens + sub-itens) ────────────
        case 'mark_activity_concluded':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body            = json_decode(file_get_contents('php://input'), true) ?? [];
            $secId           = (int)($body['atividade_id'] ?? 0);
            $concDate        = ($body['conclusion_date'] ?? '') ?: null;
            $applyToChildren = !empty($body['apply_date_to_children']);
            if (!$secId) ciJson(['ok' => false, 'error' => 'ID inválido'], 400);
            if ($concDate) { $pdo->prepare("UPDATE ci_secretariats SET conclusion_date=? WHERE id=?")->execute([$concDate, $secId]); }
            $iStmt = $pdo->prepare("SELECT id, concluded, conclusion_date FROM ci_items WHERE atividade_id=?");
            $iStmt->execute([$secId]);
            foreach ($iStmt->fetchAll(PDO::FETCH_ASSOC) as $itm) {
                if ($itm['concluded'] != 1) {
                    $iDate = $applyToChildren && $concDate ? $concDate : null;
                    $pdo->prepare("UPDATE ci_items SET concluded=1, conclusion_date=?, bulk_concluded=1 WHERE id=?")->execute([$iDate, $itm['id']]);
                }
                $sStmt = $pdo->prepare("SELECT id, concluded, conclusion_date FROM ci_subitems WHERE item_id=?");
                $sStmt->execute([$itm['id']]);
                foreach ($sStmt->fetchAll(PDO::FETCH_ASSOC) as $sub) {
                    if ($sub['concluded'] != 1) {
                        $sDate = $applyToChildren && $concDate ? $concDate : null;
                        $pdo->prepare("UPDATE ci_subitems SET concluded=1, conclusion_date=?, bulk_concluded=1 WHERE id=?")->execute([$sDate, $sub['id']]);
                    }
                }
            }
            ciLogAction($pdo, 'mark_activity_concluded', "Atividade #$secId marcada como concluída");
            ciJson(['ok' => true]);
            break;

        // ── MARCAR ITEM CONCLUÍDO (item + todos os seus sub-itens) ───────────
        case 'mark_item_concluded':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body            = json_decode(file_get_contents('php://input'), true) ?? [];
            $itemId          = (int)($body['item_id'] ?? 0);
            $concDate        = ($body['conclusion_date'] ?? '') ?: null;
            $applyToChildren = !empty($body['apply_date_to_children']);
            if (!$itemId) ciJson(['ok' => false, 'error' => 'ID inválido'], 400);
            $iRow = $pdo->prepare("SELECT concluded, conclusion_date FROM ci_items WHERE id=?");
            $iRow->execute([$itemId]);
            $itmRow = $iRow->fetch(PDO::FETCH_ASSOC);
            if ($itmRow && $itmRow['concluded'] != 1) {
                $finalDate = $concDate ?: null;
                $pdo->prepare("UPDATE ci_items SET concluded=1, conclusion_date=?, bulk_concluded=1 WHERE id=?")->execute([$finalDate, $itemId]);
            }
            $sStmt = $pdo->prepare("SELECT id, concluded, conclusion_date FROM ci_subitems WHERE item_id=?");
            $sStmt->execute([$itemId]);
            foreach ($sStmt->fetchAll(PDO::FETCH_ASSOC) as $sub) {
                if ($sub['concluded'] != 1) {
                    $sDate = $applyToChildren && $concDate ? $concDate : null;
                    $pdo->prepare("UPDATE ci_subitems SET concluded=1, conclusion_date=?, bulk_concluded=1 WHERE id=?")->execute([$sDate, $sub['id']]);
                }
            }
            ciLogAction($pdo, 'mark_item_concluded', "Item #$itemId marcado como concluído");
            ciJson(['ok' => true]);
            break;

        // ── CAMPO TEMPLATES (CRUD) ────────────────────────────────────────────
        case 'add_field_template':
            if (!ciIsAdmin()) ciJson(['ok'=>false,'error'=>'Sem permissão'],403);
            $body  = json_decode(file_get_contents('php://input'),true) ?? [];
            $atId  = isset($body['atividade_id']) && $body['atividade_id'] ? (int)$body['atividade_id'] : null;
            $itId  = isset($body['item_id'])      && $body['item_id']      ? (int)$body['item_id']      : null;
            $fname = trim($body['field_name'] ?? '');
            $ftype = in_array($body['field_type']??'',['text','tel','email','number','date','textarea']) ? $body['field_type'] : 'text';
            if (!$fname) ciJson(['ok'=>false,'error'=>'Nome obrigatório'],400);
            if ($itId) {
                $st = $pdo->prepare("SELECT COALESCE(MAX(order_num),0) FROM ci_field_templates WHERE item_id=?");
                $st->execute([$itId]); $maxOrd=(int)$st->fetchColumn();
            } elseif ($atId) {
                $st = $pdo->prepare("SELECT COALESCE(MAX(order_num),0) FROM ci_field_templates WHERE atividade_id=? AND item_id IS NULL");
                $st->execute([$atId]); $maxOrd=(int)$st->fetchColumn();
            } else { $maxOrd=0; }
            $pdo->prepare("INSERT INTO ci_field_templates (atividade_id,item_id,field_name,field_type,order_num) VALUES(?,?,?,?,?)")
                ->execute([$atId,$itId,$fname,$ftype,$maxOrd+1]);
            ciLogAction($pdo,'add_field_template',"Campo '$fname' adicionado");
            ciJson(['ok'=>true,'id'=>(int)$pdo->lastInsertId()]);
            break;

        case 'edit_field_template':
            if (!ciIsAdmin()) ciJson(['ok'=>false,'error'=>'Sem permissão'],403);
            $body  = json_decode(file_get_contents('php://input'),true) ?? [];
            $id    = (int)($body['id'] ?? 0);
            $fname = trim($body['field_name'] ?? '');
            $ftype = in_array($body['field_type']??'',['text','tel','email','number','date','textarea']) ? $body['field_type'] : 'text';
            if (!$id || !$fname) ciJson(['ok'=>false,'error'=>'Dados inválidos'],400);
            $pdo->prepare("UPDATE ci_field_templates SET field_name=?,field_type=? WHERE id=?")->execute([$fname,$ftype,$id]);
            ciJson(['ok'=>true]);
            break;

        case 'delete_field_template':
            if (!ciIsAdmin()) ciJson(['ok'=>false,'error'=>'Sem permissão'],403);
            $body = json_decode(file_get_contents('php://input'),true) ?? [];
            $id   = (int)($body['id'] ?? 0);
            if (!$id) ciJson(['ok'=>false,'error'=>'ID inválido'],400);
            $pdo->prepare("DELETE FROM ci_subitem_fields WHERE template_id=?")->execute([$id]);
            $pdo->prepare("DELETE FROM ci_field_templates WHERE id=?")->execute([$id]);
            ciLogAction($pdo,'delete_field_template',"Campo #$id excluído");
            ciJson(['ok'=>true]);
            break;

        case 'save_subitem_fields':
            if (!ciIsAdmin()) ciJson(['ok'=>false,'error'=>'Sem permissão'],403);
            $body      = json_decode(file_get_contents('php://input'),true) ?? [];
            $subitemId = (int)($body['subitem_id'] ?? 0);
            $fields    = $body['fields'] ?? [];
            if (!$subitemId) ciJson(['ok'=>false,'error'=>'subitem_id obrigatório'],400);
            $pdo->prepare("DELETE FROM ci_subitem_fields WHERE subitem_id=?")->execute([$subitemId]);
            $stmt = $pdo->prepare("INSERT INTO ci_subitem_fields (subitem_id,template_id,field_name,field_value,order_num) VALUES(?,?,?,?,?)");
            foreach ($fields as $i => $f) {
                $tid = isset($f['template_id']) && $f['template_id'] ? (int)$f['template_id'] : null;
                $fn  = trim($f['field_name']  ?? '');
                $fv  = trim($f['field_value'] ?? '');
                if ($fn) $stmt->execute([$subitemId,$tid,$fn,$fv,$i+1]);
            }
            ciJson(['ok'=>true]);
            break;

        // ── REORDENAR ITENS ───────────────────────────────────────────────────
        case 'reorder_items':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body  = json_decode(file_get_contents('php://input'), true) ?? [];
            $items = $body['items'] ?? [];
            $stmt  = $pdo->prepare("UPDATE ci_items SET order_num=? WHERE id=?");
            foreach ($items as $it) {
                $iid = (int)($it['id'] ?? 0); $ord = (int)($it['order_num'] ?? 0);
                if ($iid) $stmt->execute([$ord, $iid]);
            }
            ciJson(['ok' => true]);
            break;

        // ── REORDENAR SUB-ITENS ───────────────────────────────────────────────
        case 'reorder_subitems':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body  = json_decode(file_get_contents('php://input'), true) ?? [];
            $subs  = $body['subitems'] ?? [];
            $stmtS = $pdo->prepare("UPDATE ci_subitems SET order_num=? WHERE id=?");
            foreach ($subs as $s) {
                $sid = (int)($s['id'] ?? 0); $ord = (int)($s['order_num'] ?? 0);
                if ($sid) $stmtS->execute([$ord, $sid]);
            }
            ciJson(['ok' => true]);
            break;

        // ── LIMPAR TUDO (todos os itens+subitems → pendente) ─────────────────
        case 'clear_activity':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body  = json_decode(file_get_contents('php://input'), true) ?? [];
            $secId = (int)($body['atividade_id'] ?? 0);
            if (!$secId) ciJson(['ok' => false, 'error' => 'ID inválido'], 400);
            $pdo->prepare("UPDATE ci_items SET concluded=0, conclusion_date=NULL, bulk_concluded=0 WHERE atividade_id=?")->execute([$secId]);
            $pdo->prepare("UPDATE ci_subitems SET concluded=0, conclusion_date=NULL, bulk_concluded=0 WHERE item_id IN (SELECT id FROM ci_items WHERE atividade_id=?)")->execute([$secId]);
            $pdo->prepare("UPDATE ci_secretariats SET conclusion_date=NULL WHERE id=?")->execute([$secId]);
            ciLogAction($pdo, 'clear_activity', "Atividade #$secId totalmente limpa");
            ciJson(['ok' => true]);
            break;

        // ── DESMARCAR ATIVIDADE (só os itens/subitems marcados em lote) ────────
        case 'unmark_activity_concluded':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body  = json_decode(file_get_contents('php://input'), true) ?? [];
            $secId = (int)($body['atividade_id'] ?? 0);
            if (!$secId) ciJson(['ok' => false, 'error' => 'ID inválido'], 400);
            $pdo->prepare("UPDATE ci_items SET concluded=0, conclusion_date=NULL, bulk_concluded=0 WHERE atividade_id=? AND bulk_concluded=1")->execute([$secId]);
            $pdo->prepare("UPDATE ci_subitems SET concluded=0, conclusion_date=NULL, bulk_concluded=0 WHERE bulk_concluded=1 AND item_id IN (SELECT id FROM ci_items WHERE atividade_id=?)")->execute([$secId]);
            $pdo->prepare("UPDATE ci_secretariats SET conclusion_date=NULL WHERE id=?")->execute([$secId]);
            ciLogAction($pdo, 'unmark_activity_concluded', "Atividade #$secId desmarcada");
            ciJson(['ok' => true]);
            break;

        // ── DESMARCAR ITEM (só itens/subitems marcados em lote) ─────────────
        case 'unmark_item_concluded':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body   = json_decode(file_get_contents('php://input'), true) ?? [];
            $itemId = (int)($body['item_id'] ?? 0);
            if (!$itemId) ciJson(['ok' => false, 'error' => 'ID inválido'], 400);
            $pdo->prepare("UPDATE ci_items SET concluded=0, conclusion_date=NULL, bulk_concluded=0 WHERE id=? AND bulk_concluded=1")->execute([$itemId]);
            $pdo->prepare("UPDATE ci_subitems SET concluded=0, conclusion_date=NULL, bulk_concluded=0 WHERE item_id=? AND bulk_concluded=1")->execute([$itemId]);
            ciLogAction($pdo, 'unmark_item_concluded', "Item #$itemId desmarcado");
            ciJson(['ok' => true]);
            break;

        // ── TOGGLE concluído ─────────────────────────────────────────────────
        case 'toggle_concluded':
            $body           = json_decode(file_get_contents('php://input'), true) ?? [];
            $id             = (int)($body['id']      ?? 0);
            $concluded      = (int)($body['concluded'] ?? 0);
            $conclusionDate = ($body['conclusion_date'] ?? '') ?: null;
            if (!$id) ciJson(['ok' => false, 'error' => 'ID inválido'], 400);
            $pdo->prepare("UPDATE ci_items SET concluded=?, conclusion_date=? WHERE id=?")
                ->execute([$concluded, $conclusionDate, $id]);
            ciLogAction($pdo, 'toggle_concluded', "Item #$id concluído=$concluded");
            ciJson(['ok' => true]);
            break;

        // ── CRUD de sub-itens ────────────────────────────────────────────────
        case 'add_subitem':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body   = json_decode(file_get_contents('php://input'), true) ?? [];
            $itemId = (int)($body['item_id'] ?? 0);
            $desc   = trim($body['description'] ?? '');
            if (!$itemId || !$desc) ciJson(['ok' => false, 'error' => 'Dados inválidos'], 400);
            $startDate    = ($body['start_date']    ?? '') ?: null;
            $deadlineDate = ($body['deadline_date'] ?? '') ?: null;
            $showConcDate  = isset($body['show_conclusion_date']) ? (int)$body['show_conclusion_date'] : 1;
            $subObs        = trim($body['observacao']   ?? '');
            $subRespRaw    = trim($body['responsaveis'] ?? '');
            // Auto-herdar responsaveis do item pai se não foi informado
            if ($subRespRaw === '') {
                $pRow = $pdo->prepare("SELECT responsaveis FROM ci_items WHERE id=?");
                $pRow->execute([$itemId]);
                $pItem = $pRow->fetch(PDO::FETCH_ASSOC);
                $subResp = ($pItem && !empty($pItem['responsaveis'])) ? $pItem['responsaveis'] : null;
            } else {
                $subResp = $subRespRaw;
            }
            $maxOrd = (int)$pdo->prepare("SELECT COALESCE(MAX(order_num),0) FROM ci_subitems WHERE item_id=?")->execute([$itemId]) ? $pdo->query("SELECT COALESCE(MAX(order_num),0) FROM ci_subitems WHERE item_id=$itemId")->fetchColumn() : 0;

            $verba=is_numeric($body['verba']??'')?((float)$body['verba']):null;
            $vObs=trim($body['verba_obs']??'')?:null;$oV=trim($body['origem_verba']??'')?:null;
            $oVObs=trim($body['origem_verba_obs']??'')?:null;
            $docV=(isset($body['documentacao'])&&$body['documentacao']!==''&&$body['documentacao']!==null)?(int)$body['documentacao']:null;
            $docObs=trim($body['documentacao_obs']??'')?:null;
            $licV=(isset($body['licitacao'])&&$body['licitacao']!==''&&$body['licitacao']!==null)?(int)$body['licitacao']:null;
            $licObs=trim($body['licitacao_obs']??'')?:null;
            $vbList=json_encode(array_values(array_filter(is_array($body['verbas_list']??null)?$body['verbas_list']:json_decode($body['verbas_list']??'[]',true)??[],fn($e)=>is_array($e)&&is_numeric($e['v']??''))));
            $st = $pdo->prepare("INSERT INTO ci_subitems (item_id, description, start_date, deadline_date, show_conclusion_date, observacao, responsaveis, order_num, verba, verba_obs, origem_verba, origem_verba_obs, documentacao, documentacao_obs, licitacao, licitacao_obs, verbas_list) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
            $st->execute([$itemId, $desc, $startDate, $deadlineDate, $showConcDate, $subObs, $subResp, $maxOrd + 1,$verba,$vObs,$oV,$oVObs,$docV,$docObs,$licV,$licObs,$vbList]);
            ciLogAction($pdo, 'add_subitem', "Sub-item adicionado: " . substr($desc, 0, 80));
            ciJson(['ok' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'edit_subitem':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body   = json_decode(file_get_contents('php://input'), true) ?? [];
            $id     = (int)($body['id'] ?? 0);
            $desc   = trim($body['description'] ?? '');
            if (!$id || !$desc) ciJson(['ok' => false, 'error' => 'Dados inválidos'], 400);
            $startDate    = ($body['start_date']    ?? '') ?: null;
            $deadlineDate = ($body['deadline_date'] ?? '') ?: null;
            $showConcDate  = isset($body['show_conclusion_date']) ? (int)$body['show_conclusion_date'] : 1;
            $subObs        = trim($body['observacao']   ?? '');
            $subResp       = trim($body['responsaveis'] ?? '');

            $verba=is_numeric($body['verba']??'')?((float)$body['verba']):null;
            $vObs=trim($body['verba_obs']??'')?:null;$oV=trim($body['origem_verba']??'')?:null;
            $oVObs=trim($body['origem_verba_obs']??'')?:null;
            $docV=(isset($body['documentacao'])&&$body['documentacao']!==''&&$body['documentacao']!==null)?(int)$body['documentacao']:null;
            $docObs=trim($body['documentacao_obs']??'')?:null;
            $licV=(isset($body['licitacao'])&&$body['licitacao']!==''&&$body['licitacao']!==null)?(int)$body['licitacao']:null;
            $licObs=trim($body['licitacao_obs']??'')?:null;
            $vbList=json_encode(array_values(array_filter(is_array($body['verbas_list']??null)?$body['verbas_list']:json_decode($body['verbas_list']??'[]',true)??[],fn($e)=>is_array($e)&&is_numeric($e['v']??''))));
            $pdo->prepare(
                "UPDATE ci_subitems SET description=?, start_date=?, deadline_date=?, show_conclusion_date=?, observacao=?, responsaveis=?, verba=?, verba_obs=?, origem_verba=?, origem_verba_obs=?, documentacao=?, documentacao_obs=?, licitacao=?, licitacao_obs=?, verbas_list=? WHERE id=?"
            )->execute([$desc, $startDate, $deadlineDate, $showConcDate, $subObs, $subResp,$verba,$vObs,$oV,$oVObs,$docV,$docObs,$licV,$licObs,$vbList, $id]);
            ciLogAction($pdo, 'edit_subitem', "Sub-item #$id editado");
            ciJson(['ok' => true]);
            break;

        case 'delete_subitem':
            if (!ciIsAdmin()) ciJson(['ok' => false, 'error' => 'Sem permissão'], 403);
            $body = json_decode(file_get_contents('php://input'), true) ?? [];
            $id   = (int)($body['id'] ?? 0);
            if (!$id) ciJson(['ok' => false, 'error' => 'ID inválido'], 400);
            $pdo->prepare("DELETE FROM ci_subitems WHERE id=?")->execute([$id]);
            ciLogAction($pdo, 'delete_subitem', "Sub-item #$id excluído");
            ciJson(['ok' => true]);
            break;

        case 'toggle_subitem_concluded':
            $body           = json_decode(file_get_contents('php://input'), true) ?? [];
            $id             = (int)($body['id']       ?? 0);
            $concluded      = (int)($body['concluded'] ?? 0);
            $conclusionDate = ($body['conclusion_date'] ?? '') ?: null;
            if (!$id) ciJson(['ok' => false, 'error' => 'ID inválido'], 400);
            $pdo->prepare("UPDATE ci_subitems SET concluded=?, conclusion_date=? WHERE id=?")
                ->execute([$concluded, $conclusionDate, $id]);
            ciLogAction($pdo, 'toggle_subitem', "Sub-item #$id concluído=$concluded");
            ciJson(['ok' => true]);
            break;

        // ── IMAGENS ──────────────────────────────────────────────────────
        case 'get_entity_images':
            $eType = $_GET['entity_type'] ?? '';
            $eId   = (int)($_GET['entity_id'] ?? 0);
            if (!$eType || !$eId) ciJson(['ok'=>false,'error'=>'Parâmetros inválidos'], 400);
            $st = $pdo->prepare("SELECT id,entity_type,entity_id,is_representative,title,obs,image_data,order_num FROM ci_entity_images WHERE entity_type=? AND entity_id=? ORDER BY is_representative DESC, order_num ASC");
            $st->execute([$eType, $eId]);
            ciJson(['ok'=>true, 'images'=>$st->fetchAll()]);
            break;

        case 'add_entity_image':
            if (!ciIsAdmin()) ciJson(['ok'=>false,'error'=>'Sem permissão'], 403);
            $body   = json_decode(file_get_contents('php://input'), true) ?? [];
            $eType  = $body['entity_type'] ?? '';
            $eId    = (int)($body['entity_id'] ?? 0);
            $isRep  = (int)($body['is_representative'] ?? 0);
            $title  = trim($body['title'] ?? '');
            $obs    = trim($body['obs'] ?? '');
            $imgD   = $body['image_data'] ?? '';
            $thumb  = $body['cover_thumb'] ?? $imgD;
            $rThumb = $body['resp_thumb'] ?? null;
            $order  = (int)($body['order_num'] ?? 0);
            if (!$eType || !$eId || !$imgD) ciJson(['ok'=>false,'error'=>'Dados inválidos'], 400);
            $tbl = $eType==='activity' ? 'ci_secretariats' : ($eType==='item' ? 'ci_items' : 'ci_subitems');
            if ($isRep) {
                $pdo->prepare("DELETE FROM ci_entity_images WHERE entity_type=? AND entity_id=? AND is_representative=1")->execute([$eType, $eId]);
                $pdo->prepare("UPDATE `$tbl` SET cover_thumb=? WHERE id=?")->execute([$thumb, $eId]);
            }
            if ($rThumb !== null) {
                $pdo->prepare("UPDATE `$tbl` SET resp_thumb=? WHERE id=?")->execute([$rThumb ?: null, $eId]);
            }
            $pdo->prepare("INSERT INTO ci_entity_images (entity_type,entity_id,is_representative,title,obs,image_data,order_num) VALUES(?,?,?,?,?,?,?)")
                ->execute([$eType, $eId, $isRep, $title, $obs, $imgD, $order]);
            ciJson(['ok'=>true, 'id'=>$pdo->lastInsertId()]);
            break;

        case 'update_entity_image':
            if (!ciIsAdmin()) ciJson(['ok'=>false,'error'=>'Sem permissão'], 403);
            $body  = json_decode(file_get_contents('php://input'), true) ?? [];
            $imgId = (int)($body['id'] ?? 0);
            $title = trim($body['title'] ?? '');
            $obs   = trim($body['obs'] ?? '');
            $order = (int)($body['order_num'] ?? 0);
            $isRep = (int)($body['is_representative'] ?? 0);
            if (!$imgId) ciJson(['ok'=>false,'error'=>'ID inválido'], 400);
            $pdo->prepare("UPDATE ci_entity_images SET is_representative=?,title=?,obs=?,order_num=? WHERE id=?")->execute([$isRep,$title,$obs,$order,$imgId]);
            ciJson(['ok'=>true]);
            break;

        case 'delete_entity_image':
            if (!ciIsAdmin()) ciJson(['ok'=>false,'error'=>'Sem permissão'], 403);
            $body  = json_decode(file_get_contents('php://input'), true) ?? [];
            $imgId = (int)($body['id'] ?? 0);
            if (!$imgId) ciJson(['ok'=>false,'error'=>'ID inválido'], 400);
            $st = $pdo->prepare("SELECT entity_type,entity_id,is_representative FROM ci_entity_images WHERE id=?");
            $st->execute([$imgId]);
            $row = $st->fetch();
            $pdo->prepare("DELETE FROM ci_entity_images WHERE id=?")->execute([$imgId]);
            if ($row && $row['is_representative']) {
                $tbl = $row['entity_type']==='activity' ? 'ci_secretariats' : ($row['entity_type']==='item' ? 'ci_items' : 'ci_subitems');
                $pdo->prepare("UPDATE `$tbl` SET cover_thumb=NULL WHERE id=?")->execute([$row['entity_id']]);
            }
            ciJson(['ok'=>true]);
            break;

        case 'save_resp_thumb':
            if (!ciIsAdmin()) ciJson(['ok'=>false,'error'=>'Sem permissão'], 403);
            $body  = json_decode(file_get_contents('php://input'), true) ?? [];
            $eType = $body['entity_type'] ?? '';
            $eId   = (int)($body['entity_id'] ?? 0);
            $thumb = $body['resp_thumb'] ?? null;
            if (!$eType || !$eId) ciJson(['ok'=>false,'error'=>'Dados inválidos'], 400);
            $tbl = $eType==='activity' ? 'ci_secretariats' : ($eType==='item' ? 'ci_items' : 'ci_subitems');
            $pdo->prepare("UPDATE `$tbl` SET resp_thumb=? WHERE id=?")->execute([$thumb ?: null, $eId]);
            ciJson(['ok'=>true]);
            break;

        // ── FIM DAS AÇÕES ────────────────────────────────────────────────


        default:
            ciJson(["ok" => false, "error" => "Ação desconhecida"], 404);
    }

} catch (Exception $e) {
    error_log("[CI API] " . $e->getMessage());
    ciJson(["ok" => false, "error" => "Erro interno do servidor"], 500);
}
