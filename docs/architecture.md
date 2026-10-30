# System Scalability Architecture Documentation

This specifications plan maps out the system scaling requirements, throughput calculations, and high-availability mitigation plans to support 1,000,000 users.

## 1. System Requirements Target Spec

### Functional Scope:
* Users can authenticate, create, read, update, and delete rich markdown text notes.
* Notes can be tagged and securely shared with read/write access permissions among multiple collaborators.

### Non-Functional Targets:
* **High Availability:** Maintain 99.99% uptime across production cycles.
* **Low Latency:** API endpoints should return data within 100ms globally.
* **Scalability:** Scale out horizontally to easily handle sudden traffic spikes.

---

## 2. Load and Storage Capacity Estimates

### Operational Constraints:
* **Total User Base:** 1,000,000 accounts.
* **Daily Active Users (DAU):** 20% = **200,000 active users**.
* **Activity Profile:** Each active user saves 5 new notes and loads their notes index dashboard 20 times per day.
* **Note Size:** Average plain-text note payload is 2 KB.

### Traffic Throughput Math:
* **Average Writes per Second:**
  \[\text{Total Daily Writes} = 200,000 \text{ DAU} \times 5 = 1,000,000 \text{ operations/day}\]
  \[\text{Avg Writes Throughput} = \frac{1,000,000 \text{ writes}}{86,400 \text{ seconds/day}} \approx \mathbf{11.57 \text{ writes/sec}}\]
* **Average Reads per Second:**
  \[\text{Total Daily Reads} = 200,000 \text{ DAU} \times 20 = 4,000,000 \text{ operations/day}\]
  \[\text{Avg Reads Throughput} = \frac{4,000,000 \text{ reads}}{86,400 \text{ seconds/day}} \approx \mathbf{46.30 \text{ reads/sec}}\]
* **Peak Peak Read Thresholds (5x Surge Factor):**
  \[\text{Peak Compute Reads} = 46.30 \text{ reads/sec} \times 5 = \mathbf{231.50 \text{ reads/sec}}\]

### Total Yearly Storage Footprint:
* \[\text{Daily Growth Data} = 1,000,000 \text{ notes} \times 2 \text{ KB} = 2,000,000 \text{ KB} \approx 2 \text{ GB/day}\]
* \[\text{Yearly Storage Space} = 2 \text{ GB/day} \times 365 \text{ days} = \mathbf{730 \text{ GB/year}}\]

---

## 3. Infrastructure Diagram

```text
                        [ Client Web / Mobile Apps ]
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │        Anycast DNS      │
                        └────────────┬────────────
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │   Cloudflare CDN Edge   │
                        └────────────┬────────────┘
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │   High-Availability LB  │
                        └──────┬───────────┬──────┘
                               │           │ (Round-Robin Proxy)
                               ▼           ▼
                        ┌──────────┐   ┌──────────┐
                        │App Node 1│   │App Node 2│
                        └──┬───┬───┘   └──┬───┬───┘
                           │   │          │   │
        ┌──────────────────┘   │          │   └──────────────────┐
        ▼                      ▼          ▼                      ▼
┌──────────────┐         ┌──────────────────┐          ┌──────────────────┐
│Redis Cluster │         │PostgreSQL Primary│          │PostgreSQL Replica│
│(Shared Cache)│         │(Write Instance)  │          │(Read-Only Pool)  │
└──────────────┘         └─────────┬────────┘          └──────────────────┘
                                   │ (WAL Streaming)
                                   ▼
                         ┌──────────────────┐
                         │ Message Queue    │
                         └─────────┬────────┘
                                   ▼
                         ┌──────────────────┐
                         │ Asynchronous     │
                         │ Background Worker│
                         └──────────────────┘
```

---

## 4. Component Definitions

* **Anycast DNS:** Routes initial domain requests to the geographically nearest network entry point to minimize connection times.
* **CDN (Content Delivery Network):** Caches and serves static application assets (like HTML, CSS, and JS) from edge nodes to offload main servers.
* **Load Balancer:** Spreads incoming network traffic across multiple app server nodes to prevent bottlenecks and ensure stability.
* **App Servers (Stateless Node.js Cluster):** Processes incoming user requests and runs application business logic without saving any session data on the local disk.
* **Shared Cache (Redis):** Keeps active session data and hot user note indexes in memory to provide ultra-fast, sub-millisecond data access.
* **PostgreSQL Primary:** Acts as the secure single source of truth for all data modifications, enforcing strict transactional safety.
* **PostgreSQL Read Replica:** Syncs asynchronously with the primary node to handle read queries, taking the read load off the write database.
* **Message Queue:** Absorbs busy spikes in background tasks by holding event updates safely until backend systems can handle them.
* **Background Worker:** Listens to the message queue to process slow, non-blocking tasks asynchronously, such as compiling system usage logs or firing off email notifications.

---

## 5. Request Lifecycle Pipelines

### GET /notes Flow
1. The client sends a `GET /v1/notes` request with a validation JWT header.
2. The **Load Balancer** receives the request and forwards it to a healthy **App Server** node.
3. The **App Server** validates the token and checks the **Redis Cache** for the user's note index.
4. On a **Cache Hit**, the server returns the cached list to the user instantly. On a **Cache Miss**, the server fetches the notes from the **PostgreSQL Read Replica**, saves them back to **Redis**, and returns the response.

### POST /notes Flow
1. The client sends a `POST /v1/notes` request containing the note's text title and body payload.
2. The **Load Balancer** routes the request to an available **App Server** node.
3. The **App Server** validates that the title is present and under 100 characters.
4. The server commits a write transaction to the **PostgreSQL Primary** database, updates or invalidates the user's cached index in **Redis**, publishes an update event to the **Message Queue**, and returns a `201 Created` status to the user.

---

## 6. System Trade-offs

* **Cache Invalidation vs. Stale Reads:** We chose to explicitly evict Redis cache keys immediately during write operations. This guarantees that users always see their latest note updates across all devices, though it introduces a slight write penalty since the app server has to touch both the database and the cache cluster before returning success.
* **Relational Storage over Sharded Document Databases:** Opting for PostgreSQL ensures strict ACID transactional safety and makes complex sharing logic easy to handle via structured queries. The trade-off is that horizontal scaling requires managing read replicas and handling query sync delays, whereas a NoSQL setup would scale out-of-the-box but struggle with relational consistency.

---

## 7. Single Point of Failure (SPOF) Hardening Analysis

To scale reliably toward 1 million active users, we have systematically eliminated single points of failure across all layers of our infrastructure:

* **Database Layer Protection:** Relying on a single database primary means a hardware crash would bring down the entire note-taking service. We eliminate this vulnerability by deploying an active secondary **Read Replica** using automated failover tooling (such as Patroni or AWS RDS Multi-AZ). If the primary node fails, health-checking monitors spot the outage and automatically promote the replica to primary, updating server connection strings in seconds.
* **Load Balancer Layer Protection:** If the main load balancer goes down, all traffic to the API stops. We fix this by deploying redundant load balancers in an active-passive pair using **Keepalived and Virtual IP (VIP)** routing. If the active load balancer stops responding, the passive backup node seamlessly assumes the public IP address, routing traffic without interrupting active client connections.
* **Shared Cache Layer Protection:** A sudden crash in a single cache node can swamp the underlying database with costly note compilation queries, triggering a cascade failure. We protect against this by running Redis in **Redis Cluster Mode** with multi-zone sharding and automatic replication, ensuring the cache layer stays up even if an entire availability zone goes offline.
