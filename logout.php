<?php
require_once 'config.php';
if (!empty($_SESSION['ci_uid'])) {
    try { ciLogAction(ciGetDb(), 'logout', 'Sessão encerrada'); } catch (Exception $e) {}
}
session_destroy();
header('Location: login.php');
exit;
