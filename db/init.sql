-- СПП
CREATE TABLE IF NOT EXISTS spp_items (
    id SERIAL PRIMARY KEY,

    parent_id INTEGER REFERENCES spp_items(id),

    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,

    is_active BOOLEAN DEFAULT TRUE,

    valid_from DATE NOT NULL,
    valid_to DATE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Отделы
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,

    name VARCHAR(255) NOT NULL UNIQUE
);

-- Связь СПП Отдел

CREATE TABLE IF NOT EXISTS spp_departments (
    id SERIAL PRIMARY KEY,

    spp_id INTEGER NOT NULL REFERENCES spp_items(id),
    department_id INTEGER NOT NULL REFERENCES departments(id)
);

-- Сохраненные расчеты

CREATE TABLE IF NOT EXISTS calculations (
    id SERIAL PRIMARY KEY,

    session_id VARCHAR(255) NOT NULL,

    status VARCHAR(50) NOT NULL,

    spp_version_date DATE NOT NULL,

    result_json JSONB NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- Демо данные
-- Отделы

INSERT INTO departments (name)
VALUES
('ИТ'),
('Бухгалтерия'),
('Логистика'),
('Производство')
ON CONFLICT DO NOTHING;

-- СПП
INSERT INTO spp_items
(parent_id, code, name, is_active, valid_from, valid_to)
VALUES

(NULL, '1', 'Компания', TRUE, '2024-01-01', NULL),

(1, '1.1', 'Производственный блок', TRUE, '2024-01-01', NULL),
(1, '1.2', 'Административный блок', TRUE, '2024-01-01', NULL),

(2, '1.1.1', 'Цех №1', TRUE, '2024-01-01', NULL),
(2, '1.1.2', 'Цех №2', TRUE, '2024-01-01', NULL),

(3, '1.2.1', 'Финансовый отдел', TRUE, '2024-01-01', NULL),
(3, '1.2.2', 'ИТ отдел', TRUE, '2024-01-01', NULL);

-- Привязка отделов
INSERT INTO spp_departments
(spp_id, department_id)
VALUES
(4, 4),
(5, 4),
(6, 2),
(7, 1);

-- Историчность
INSERT INTO spp_items
(parent_id, code, name, is_active, valid_from, valid_to)
VALUES
(
    3,
    '1.2.3',
    'Отдел цифровой трансформации',
    TRUE,
    '2025-01-01',
    NULL
);