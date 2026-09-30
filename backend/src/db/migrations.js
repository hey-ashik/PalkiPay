'use strict';

/**
 * Ordered, append-only list of schema migrations.
 * Never edit a migration that has shipped — add a new one instead.
 * Each migration is a list of SQL statements executed in order.
 */

const TABLE_OPTS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

module.exports = [
  {
    id: '001_initial_schema',
    up: [
      `CREATE TABLE IF NOT EXISTS users (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(190) NOT NULL,
        phone VARCHAR(20) NULL,
        password_hash VARCHAR(100) NOT NULL,
        slug VARCHAR(40) NULL,
        role ENUM('merchant','admin') NOT NULL DEFAULT 'merchant',
        status ENUM('active','suspended') NOT NULL DEFAULT 'active',
        api_key VARCHAR(64) NOT NULL,
        last_login_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_users_email (email),
        UNIQUE KEY uq_users_slug (slug),
        UNIQUE KEY uq_users_api_key (api_key)
      ) ${TABLE_OPTS}`,

      `CREATE TABLE IF NOT EXISTS merchant_settings (
        user_id INT UNSIGNED NOT NULL,
        brand_name VARCHAR(120) NULL,
        brand_logo MEDIUMTEXT NULL,
        support_phone VARCHAR(30) NULL,
        support_email VARCHAR(190) NULL,
        default_webhook_url VARCHAR(1000) NULL,
        telegram_enabled TINYINT(1) NOT NULL DEFAULT 0,
        telegram_bot_token VARCHAR(120) NULL,
        telegram_bot_username VARCHAR(64) NULL,
        telegram_chat_id VARCHAR(40) NULL,
        telegram_secret VARCHAR(64) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id),
        CONSTRAINT fk_settings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ${TABLE_OPTS}`,

      `CREATE TABLE IF NOT EXISTS payment_methods (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        provider VARCHAR(20) NOT NULL,
        account_type ENUM('personal','agent') NOT NULL DEFAULT 'personal',
        account_number VARCHAR(20) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_methods_user_provider (user_id, provider),
        CONSTRAINT fk_methods_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ${TABLE_OPTS}`,

      `CREATE TABLE IF NOT EXISTS devices (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        name VARCHAR(80) NOT NULL,
        platform ENUM('android','ios','other') NOT NULL DEFAULT 'android',
        device_key VARCHAR(64) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        app_version VARCHAR(20) NULL,
        last_seen_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_devices_key (device_key),
        KEY idx_devices_user (user_id),
        CONSTRAINT fk_devices_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ${TABLE_OPTS}`,

      `CREATE TABLE IF NOT EXISTS sms_messages (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        device_id INT UNSIGNED NULL,
        sender VARCHAR(60) NULL,
        body TEXT NOT NULL,
        provider VARCHAR(20) NULL,
        transaction_id VARCHAR(40) NULL,
        amount DECIMAL(12,2) NULL,
        from_number VARCHAR(20) NULL,
        balance DECIMAL(14,2) NULL,
        status ENUM('unused','used','invalid') NOT NULL DEFAULT 'unused',
        payment_id BIGINT UNSIGNED NULL,
        received_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_sms_user_trx (user_id, provider, transaction_id),
        KEY idx_sms_user_status (user_id, status, created_at),
        CONSTRAINT fk_sms_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_sms_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE SET NULL
      ) ${TABLE_OPTS}`,

      `CREATE TABLE IF NOT EXISTS payments (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id INT UNSIGNED NOT NULL,
        invoice_id VARCHAR(32) NOT NULL,
        source ENUM('api','link') NOT NULL DEFAULT 'api',
        full_name VARCHAR(150) NOT NULL,
        email VARCHAR(190) NULL,
        amount DECIMAL(12,2) NOT NULL,
        fee DECIMAL(12,2) NOT NULL DEFAULT 0,
        currency CHAR(3) NOT NULL DEFAULT 'BDT',
        description VARCHAR(255) NULL,
        metadata TEXT NULL,
        redirect_url VARCHAR(1000) NULL,
        cancel_url VARCHAR(1000) NULL,
        webhook_url VARCHAR(1000) NULL,
        return_type ENUM('GET','POST') NOT NULL DEFAULT 'GET',
        status ENUM('unpaid','processing','pending','completed','failed','cancelled','expired') NOT NULL DEFAULT 'unpaid',
        payment_method VARCHAR(20) NULL,
        sender_number VARCHAR(20) NULL,
        transaction_id VARCHAR(40) NULL,
        paid_amount DECIMAL(12,2) NULL,
        sms_id BIGINT UNSIGNED NULL,
        verified_by ENUM('auto','dashboard','telegram') NULL,
        failure_reason VARCHAR(255) NULL,
        customer_ip VARCHAR(45) NULL,
        submitted_at DATETIME NULL,
        completed_at DATETIME NULL,
        expires_at DATETIME NOT NULL,
        webhook_status ENUM('none','pending','delivered','failed') NOT NULL DEFAULT 'none',
        webhook_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
        telegram_message_id BIGINT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_payments_invoice (invoice_id),
        KEY idx_payments_user_status (user_id, status, created_at),
        KEY idx_payments_user_trx (user_id, transaction_id),
        KEY idx_payments_status_submitted (status, submitted_at),
        CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      ) ${TABLE_OPTS}`,
    ],
  },
];
