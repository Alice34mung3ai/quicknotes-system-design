# Real QuickNotes Backend API Design Specification

This technical specification details the complete REST API interface for production execution of the QuickNotes application cluster.

## System Base Gateway URL
* **Production API Cluster URL:** `https://quicknotes-platform.net`

---

## Central REST Endpoints Table

| HTTP Verb | Resource Target | Target Action Summary | Expected Status |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Register a new user profile | `201 Created` |
| `POST` | `/auth/login` | Authenticate credentials and emit JWT security tokens | `200 OK` |
| `GET` | `/notes` | List chronologically sorted notes indexes for user | `200 OK` |
| `POST` | `/notes` | Create a new structured note document instance | `201 Created` |
| `PUT` | `/notes/{id}` | Overwrite existing text parameters inside an explicit note | `200 OK` |
| `DELETE`| `/notes/{id}` | Remove a targeted record from database records | `200 OK` |

---

## Structured JSON Traffic Examples

### List Notes Index (`GET /notes`)
* **Headers:** `Authorization: Bearer <jwt_token>`
* **Response Body (`200 OK`):**
```json
[
  {
    "id": "nt_8d249f0a",
    "title": "System Scalability Guidelines",
    "body": "De-couple downstream worker processes from write paths.",
    "userId": "usr_3910ff21",
    "updatedAt": "2026-10-30T14:22:00Z"
  },
  {
    "id": "nt_44a11b9c",
    "title": "Database Normalization Audit Checklist",
    "body": "Ensure the tags junction entity remains normalized to eliminate duplicate strings.",
    "userId": "usr_3910ff21",
    "updatedAt": "2026-10-30T16:05:11Z"
  }
]
```

### Create New Note (`POST /notes`)
* **Headers:** `Content-Type: application/json`, `Authorization: Bearer <jwt_token>`
* **Request Body:**
```json
{
  "title": "Cache Invalidation Matrix Review",
  "body": "Evict matching user index keys instantly on resource updates."
}
```
* **Response Body (`201 Created`):**
```json
{
  "id": "nt_99210ccb",
  "title": "Cache Invalidation Matrix Review",
  "body": "Evict matching user index keys instantly on resource updates.",
  "userId": "usr_3910ff21",
  "createdAt": "2026-10-30T22:45:00Z"
}
```

---

## Global Error Responses & Status Code Guide

The application platform uses standard REST style error handling. When an operation fails, the API responds with an explicit error structure:

### Standardized Error JSON Structure
```json
{
  "error": {
    "status": 400,
    "code": "VALIDATION_FAILED",
    "message": "Validation Error: The note title field is required and must not exceed 100 characters.",
    "timestamp": "2026-10-30T22:46:12Z"
  }
}
```

### Supported API Status Code Mappings

| HTTP Code | Error Reference Identifier | Error Message Body Detail | Root Cause Context |
| :--- | :--- | :--- | :--- |
| `400` | `VALIDATION_FAILED` | `"Validation Error: Title must be 100 characters or fewer."` | Client payload failed checking constraints. |
| `401` | `INVALID_AUTH` | `"Authentication failed: Missing or expired session token."` | Token is invalid, missing, or structurally corrupt. |
| `403` | `ACCESS_DENIED` | `"Access Denied: Restricted action from this asset location."` | User lacks permissions to access or alter this note. |
| `404` | `NOT_FOUND` | `"Target note reference identifier could not be verified."` | The requested item does not exist or has been deleted. |
| `500` | `INTERNAL_FAULT` | `"Data cluster error: Failed to commit write operations."` | Infrastructure failure or unhandled exception. |
