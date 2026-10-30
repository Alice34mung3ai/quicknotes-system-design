# Relational Data Architecture Blueprint

## Architectural Framework Selection: Relational SQL
For QuickNotes, we have selected an enterprise **Relational SQL Database (PostgreSQL)** over a Document NoSQL framework.

### Rationale:
* **Strong ACID Safety:** User updates across mobile and web interfaces must reflect immediately. SQL databases guarantee strict data consistency, preventing dirty reads or partial writes.
* **Fully Normalized Interconnected Structures:** QuickNotes requires users to share documents with collaborators and assign tag indices. A relational model handles these structures efficiently via optimized foreign key mappings, avoiding data duplication and keeping storage footprints minimal.

---

## Logical System Entity Diagram

This normalized layout splits out `tags` from the join structure to prevent data duplication and enable efficient system-wide tag searches.

```text
[ users ] 1 ─────── 0..N [ notes ] 1 ─────── 0..N [ note_tags ]
                                                      0..N
                                                        │
                                                      1 └── [ tags ]
```

---

## Production DDL Schema Blueprint

```sql
-- 1. Identity Account Records
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Core Notes Text Content
CREATE TABLE notes (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    title VARCHAR(100) NOT NULL,
    body TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Normalized Tags Master Lookup Table
CREATE TABLE tags (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Many-to-Many Notes-to-Tags Relation Table
CREATE TABLE note_tags (
    note_id VARCHAR(50) NOT NULL,
    tag_id VARCHAR(50) NOT NULL,
    PRIMARY KEY (note_id, tag_id),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

---

## Core SQL Queries

### Chronological Notes Listing (JOIN)
```sql
SELECT n.id, n.title, n.body, n.updated_at, t.name AS tag_name
FROM notes n
LEFT JOIN note_tags nt ON n.id = nt.note_id
LEFT JOIN tags t ON nt.tag_id = t.id
WHERE n.user_id = 'usr_3910ff21'
ORDER BY n.updated_at DESC;
```

### Save Note Record
```sql
INSERT INTO notes (id, user_id, title, body)
VALUES ('nt_5520fa', 'usr_3910ff21', 'Refactoring API Client', 'Extracted fetch into a reusable request function.');
```

### Fetch Notes matching a Specific Tag
```sql
SELECT n.id, n.title, n.body
FROM notes n
JOIN note_tags nt ON n.id = nt.note_id
JOIN tags t ON nt.tag_id = t.id
WHERE t.name = 'scalability';
```

---

## Database Performance Indexes

```sql
-- Accelerates chronological listing and ordering of user note dashboards
CREATE INDEX idx_notes_user_id_updated_at ON notes(user_id, updated_at DESC);

-- Speeds up many-to-many lookup joins when users search or browse items by tag references
CREATE INDEX idx_note_tags_tag_id ON note_tags(tag_id);
```
