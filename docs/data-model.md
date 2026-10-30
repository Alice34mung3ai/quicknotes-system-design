# Production Storage Engine & Relational Schema Design

## Strategic Architecture Decision: SQL over NoSQL
For the QuickNotes core system, we have selected an enterprise **Relational SQL Database Engine (PostgreSQL)** over a NoSQL platform. 

### Decision Rationale:
* **Strong ACiD Guarantees:** Notes data requires total consistency; a user editing a note on a phone must see those precise changes reflected immediately on their web browser. Relational engines prevent partial data writes and race conditions naturally.
* **Complex Data Topology:** The social-sharing mechanics, collaborator user invitations, and organized tag structures involve interconnected structural logic. SQL handling handles these entity relations using optimized native JOIN lookups far better than nesting documents in NoSQL collection schemas.

---

## Logical Entity Relationship Blueprint

```text
[ Users ] 1 ─────── 0..N [ Notes ] 1 ─────── 0..N [ Note_Tags ]
                             1
                             │
                             └─ 0..N [ Collaborators ]
```
* **Users** have a One-to-Many (`1:N`) relationship with **Notes**.
* **Notes** have a One-to-Many (`1:N`) mapping with relation tables linking to **Collaborators** and **Note_Tags**.

---

## Core DDL Relational Tables Structure

```sql
-- 1. Users Model Account Management Table
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Notes Content Structural Table
CREATE TABLE notes (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    title VARCHAR(100) NOT NULL,
    body TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Collaborators Authorization Security Matrix Table
CREATE TABLE collaborators (
    id VARCHAR(50) PRIMARY KEY,
    note_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    access_level VARCHAR(20) NOT NULL CHECK (access_level IN ('READ', 'WRITE', 'ADMIN')),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (note_id, user_id)
);

-- 4. Note Tags Organization Index Table
CREATE TABLE note_tags (
    id VARCHAR(50) PRIMARY KEY,
    note_id VARCHAR(50) NOT NULL,
    tag_name VARCHAR(30) NOT NULL,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
    UNIQUE (note_id, tag_name)
);
```

---

## Production Execution Query Reference Examples

### Fetch Active Timelines (Read Query)
```sql
SELECT n.id, n.title, n.body, n.updated_at 
FROM notes n
WHERE n.user_id = 'user_4710bc82'
ORDER BY n.updated_at DESC
LIMIT 20;
```

### Map Sharing Access Controls (Collaborator Query)
```sql
SELECT n.id, n.title, c.access_level 
FROM notes n
JOIN collaborators c ON n.id = c.note_id
WHERE c.user_id = 'user_9912aa44';
```

---

## Performance-Tuning Database Indexes
To maintain ultra-low query latency under 1 million active users, we introduce the following targeted B-Tree indexes:

```sql
-- Speeds up note list generation and chronological sorting for the user dashboard
CREATE INDEX idx_notes_user_id_updated_at ON notes(user_id, updated_at DESC);

-- Speeds up security checks when external collaborators open shared notes
CREATE INDEX idx_collaborators_user_id ON collaborators(user_id);
```
