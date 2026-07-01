# CloudCrate Backend

It is a learning project. A high-performance, cost-optimized cloud storage and file-sharing API. This backend handles direct-to-cloud multipart uploads, strict storage quota enforcement, and secure, expiring share links. 

Built to scale on free-tier infrastructure without sacrificing data integrity or security.

## Architectural Highlights

This project was built with a strict focus on system design, concurrency handling, and infrastructure cost optimization. 

* **Atomic Storage Quotas:** Uses Redis Lua scripts to atomically check and reserve storage space. This completely eliminates race conditions where concurrent uploads could bypass user limits.
* **Financial-Style Ledgers:** Storage usage is tracked via an append-only MongoDB transaction ledger. Redis acts as a high-speed cache, backed by a daily reconciliation cron job that self-heals the cache from the database if the memory store is ever flushed.
* **Direct-to-Cloud Multipart Uploads:** The backend generates presigned URLs, allowing the client to push chunks directly to Backblaze B2 (or S3). The Node server never touches the heavy file bytes, keeping memory footprint near zero.
* **HTTP Cron Architecture:** Replaced traditional message queues with secure, HTTP-triggered cron endpoints. This decision was made to eliminate background worker memory spikes and stay strictly within free-tier infrastructure limits while maintaining reliable orphaned file cleanup.
* **Atomic Download Limits:** Share link download counters use MongoDB aggregation pipelines in the update query. This ensures that if a link has a limit of 1, exactly 1 download will succeed, even if 100 requests hit the endpoint at the exact same millisecond.

## Tech Stack

* **Runtime:** Node.js with TypeScript
* **Framework:** Express.js
* **Database:** MongoDB (Mongoose)
* **Caching & Quotas:** Redis (ioredis)
* **Cloud Storage:** AWS S3 SDK (Configured for Backblaze B2 and local Floci emulation)
* **Validation:** Zod
* **Security:** JWT, bcrypt, Cryptographically secure random tokens

## Core Modules

### 1. Media & Upload Engine
Handles the complete lifecycle of a file. It initiates pending database records, generates presigned chunk URLs, finalizes multipart assemblies, and manages soft deletions. It includes a deduplication engine that checks SHA1 checksums to instantly link duplicate files without re-uploading bytes.

### 2. ShareLink System
Allows users to generate secure, public download links for their files. Supports optional password protection, strict expiration dates, and hard download limits. Passwords are hashed with bcrypt, and the system uses POST requests for public access to prevent password leakage in URL logs.

### 3. System Automation (Cron)
A suite of secured, hidden API endpoints triggered by external cron schedulers. 
* **Purge Orphaned Files:** Finds soft-deleted files no longer referenced by any active user and permanently erases them from cloud storage.
* **Abort Expired Uploads:** Cleans up abandoned multipart uploads to prevent paying for ghost storage chunks.
* **Reconcile Storage:** Rebuilds the Redis quota cache from the MongoDB ledger to ensure absolute data integrity.

### 4. Audit Logging
An immutable, append-only logging system that tracks critical system actions. Captures the actor, target resource, IP address, and User-Agent. Documents automatically expire and delete themselves after 90 days via MongoDB TTL indexes to manage database size.

## Local Development Setup

This project uses Floci to emulate Backblaze B2/S3 locally, allowing you to test direct-to-cloud uploads without incurring real cloud costs.

### Prerequisites
* Node.js (v18 or higher)
* MongoDB
* Redis
* Floci (Local S3 emulator)
<img width="1035" height="555" alt="Floci1" src="https://github.com/user-attachments/assets/4f4e36cf-2c19-40c5-babd-050d7f2fdc3b" />

<img width="1037" height="549" alt="Floci2" src="https://github.com/user-attachments/assets/94b5dd7e-5fe7-44ab-869c-53ca707ca3a6" />
