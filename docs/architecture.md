# Enterprise System Scale & Infrastructure Architecture Design

This infrastructure document models the hardware configurations, operational bounds, and structural design choices required to support 1,000,000 users.

---

## 1. Back-of-the-Envelope Capacity Estimation

### Foundational Constraints:
* **Total Target Users:** 1,000,000
* **Daily Active Users (DAU Ratio):** 20% = **200,000 users**
* **Daily Action Operations:** Each active user writes 5 new notes per day, and views their note feed dashboard 20 times per day.
* **Document Constraints:** Text notes average 2 KB in plain text string storage data.

### Traffic Estimations:
* **Average Writes (Creates/Updates) per Second:**
  \[\text{Total Daily Writes} = 200,000 \times 5 = 1,000,000 \text{ records/day}\]
  \[\text{Avg Writes/sec} = \frac{1,000,000 \text{ writes}}{86,400 \text{ seconds}} \approx \mathbf{11.57 \text{ writes/sec}}\]
* **Average Reads per Second:**
  \[\text{Total Daily Reads} = 200,000 \times 20 = 4,000,000 \text{ lookups/day}\]
  \[\text{Avg Reads/sec} = \frac{4,000,000 \text{ reads}}{86,400 \text{ seconds}} \approx \mathbf{46.30 \text{ reads/sec}}\]
* **Peak Scaled Factor Traffic Spikes (5x Peak Multiplier):**
  \[\text{Peak Peak Reads} = 46.30 \times 5 = \mathbf{231.50 \text{ reads/sec}}\]

### Storage Expansion Footprint per Year:
* \[\text{Daily Storage Gain} = 1,000,000 \text{ new notes} \times 2 \text{ KB} = 2,000,000 \text{ KB} \approx 2 \text{ GB/day}\]
* \[\text{Yearly Storage Delta} = 2 \text{ GB/day} \times 365 \text{ days} = \mathbf{730 \text{ GB/year}}\]

---

## 2. Text-Based System Architecture Blueprint

```text
                        [ Client Applications ]
                                   │
                                   ▼
                       ┌───────────────────────┐
                       │ Cloudflare CDN Edge   │
                       └───────────┬───────────┘
                                   │
                                   ▼
                       ┌───────────────────────┐
                       │ Public Load Balancer  │
                       └───────────┬───────────┘
                                   │ (Reverse Proxy)
                                   ▼
                       ┌───────────────────────┐
                       │ App Servers (Node.js) │
                       └─┬─────────┬─────────┬─┘
                         │         │         │
        ┌────────────────┘         │         └────────────────┐
        ▼                          ▼                          ▼
┌──────────────┐         ┌──────────────────┐       ┌──────────────────┐
│Redis Cluster │         │Database Primary  │       │Database Replica  │
│(Hot Cache)   │         │(Write-Only Pool) │       │(Read-Only Pool)  │
└──────────────┘         └─────────┬────────┘       └──────────────────┘
                                   │
                                   ▼ (WAL Log Events)
                         ┌──────────────────┐
                         │ Message Queue    │
                         └─────────┬────────┘
                                   ▼
                         ┌──────────────────┐
                         │ Background Worker│
                         │ (Analytics/Logs) │
                         └──────────────────┘
```

---

## 3. Structural Components System Definition

* **Cloudflare CDN:** Serves cached static frontend assets close to users worldwide to optimize client loading speeds.
* **Public Load Balancer (Nginx):** Evenly distributes incoming HTTP API client requests across backend nodes to prevent server overload.
* **App Servers (Stateless Node.js Cluster):** Executes application logic, evaluates security policies, and parses input data fields without storing any state locally.
* **Redis Cluster:** Stores temporary active user session states and quick-read note list dashboards in memory to achieve sub-millisecond retrieval times.
* **Database Primary (PostgreSQL):** Acts as the single system source of truth, safely committing all data-altering transactions.
* **Database Replica (PostgreSQL):** Synchronizes asynchronously with the primary node to handle read queries, taking the read load off the primary database.
* **Message Queue (RabbitMQ):** Temporarily holds non-blocking background notifications and indexing metrics until background processing nodes can handle them.
* **Background Worker:** Listens to RabbitMQ to run slow tasks asynchronously, such as sending emails or updating indexing logs, keeping user interaction loops fast.

---

## 4. End-to-End Core Data Lifecycles

### The Note Read Lifecycle Pipeline
1. The user client sends an HTTP `GET /v1/notes` call containing authentication tokens to the **Load Balancer**, which forwards it to an available **App Server**.
2. The **App Server** runs authorization checks on the security token and requests the user's active notes index from the **Redis Cache** cluster.
3. **Cache Hit:** If found, the server passes the structured cache payload straight back to the client immediately.
4. **Cache Miss:** If missing from Redis, the **App Server** executes a read query against the **Database Read Replica**, returns the data to the user, and saves a copy in **Redis** for subsequent calls.

### The Note Write/Creation Lifecycle Pipeline
1. The user client sends an HTTP `POST /v1/notes` request with a JSON body to the **Load Balancer**, which routes it to an active **App Server**.
2. The **App Server** validates that the title is present and under 100 characters.
3. The server connects to the **Database Primary** instance and executes a secure SQL write transaction.
4. On success, the **App Server** invalidates the user's stale cache keys in **Redis** to ensure data consistency.
5. The server publishes an analytics event to the **Message Queue** and returns an HTTP `201 Created` status code directly back to the client.

---

## 5. Architectural Engineering Trade-offs

* **Write-Through Database Cache Invalidation vs. Lazy Loading Caches:** Invalidating active Redis cache keys immediately during write operations prevents users from seeing stale note data. However, this approach slightly slows down write performance, as the app server must complete both a database write and a cache eviction before returning a success code.
* **Relational Database Read Replicas vs. Native NoSQL Storage Sharding:** Adopting a PostgreSQL primary-replica design simplifies setup and ensures data integrity across relation boundaries. However, managing replication lag between databases can occasionally cause brief view delays for clients traveling between global target networks.

---

## 6. Single-Point-of-Failure (SPOF) Hardening Analysis

* **The Core Vulnerability (Database Primary Node):** If our application only has one writeable primary database, a hardware failure or physical corruption on that specific server will crash the service and prevent any notes from being created or updated.
* **The Engineering Mitigation Strategy:** We address this risk by deploying PostgreSQL in a High-Availability (HA) cluster configuration alongside automated health checkers. If the primary database goes offline, an automated failover orchestrator instantly promotes a healthy read replica to the primary position and updates the application servers' connection settings within seconds, keeping the system up and running.
