# QuickNotes Core API Specifications

This technical reference document maps out the production REST API endpoints for QuickNotes, providing concrete JSON payloads, responses, and validation codes.

## Base URL Configuration
* **Production Gateway:** `https://quicknotes-service.com`

---

## Endpoint Inventory

| HTTP Verb | Resource Path | Description | Access Rights |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Provision new client user identity profiles | Anonymous Public |
| `POST` | `/auth/login` | Authorize tokens using user credentials | Anonymous Public |
| `GET` | `/notes` | Retrieve filtered array indices of user records | Authorized User Token |
| `POST` | `/notes` | Save a new note document payload to the user file | Authorized User Token |
| `PUT` | `/notes/{id}` | Overwrite the title or text content of a single note | Authorized User Owner |
| `DELETE`| `/notes/{id}` | Permanently destroy an existing single note document | Authorized User Owner |

---

## Comprehensive JSON Traffic Payloads

### 1. Read Notes Index (`GET /notes`)
* **Headers:** `Authorization: Bearer <jwt_access_token>`
* **Success JSON Response (`200 OK`):**
```json
[
  {
    "id": "note_9281a0b3",
    "title": "Weekly Architectural Action Plan",
    "body": "De-couple downstream queue processes from core database locks.",
    "userId": "user_4710bc82",
    "updatedAt": "2026-10-30T19:15:00Z"
  },
  {
    "id": "note_1048df39",
    "title": "System Shopping Reminders",
    "body": "Provision Redis cloud instances and adjust security parameters.",
    "userId": "user_4710bc82",
    "updatedAt": "2026-10-30T21:40:22Z"
  }
]
```

### 2. Post New Asset (`POST /notes`)
* **Headers:** `Content-Type: application/json`, `Authorization: Bearer <jwt_access_token>`
* **Request JSON Body Payload:**
```json
{
  "title": "Infrastructure Performance Metric Checklist",
  "body": "Ensure target sub-millisecond response values across microservices."
}
```
* **Success JSON Response (`201 Created`):**
```json
{
  "id": "note_5539fa21",
  "title": "Infrastructure Performance Metric Checklist",
  "body": "Ensure target sub-millisecond response values across microservices.",
  "userId": "user_4710bc82",
  "createdAt": "2026-10-30T22:30:15Z"
}
```

---

## Global System Error Code Matrix

Our API returns structured errors with consistent semantic values:

| HTTP Status Code | Short Reason Phrase | API Error Message Detail | Root Cause Context |
| :--- | :--- | :--- | :--- |
| `400` | Bad Request | `"Validation Error: The note title field exceeds 100 character limits."` | Input text failed constraint rules. |
| `401` | Unauthorized | `"Access Token Invalid: Please pass a valid session Bearer header."` | Missing, expired, or structural token fault. |
| `403` | Forbidden | `"Resource Access Denied: Action restricted from this specific item."` | Authenticated user is trying to touch another user's notes. |
| `404` | Not Found | `"Target Resource Identifiers not found on cluster directories."` | Target id link is invalid or deleted. |
| `500` | Internal Server Error | `"Data Layer Failure: Unable to commit changes to database pools."` | Infrastructure failure or unhandled backend fault. |
