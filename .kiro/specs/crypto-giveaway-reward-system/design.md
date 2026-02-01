# Design Document: TZBETZ Giveaway → Balance → Withdraw Ecosystem

## Overview

The TZBETZ Giveaway → Balance → Withdraw Ecosystem is a comprehensive web-based reward management system that processes crypto giveaways from live streams through to final withdrawal. The system implements a secure, multi-stage flow with abuse prevention, user retention mechanisms, and instant payout capabilities.

The architecture follows a microservices pattern with clear separation between giveaway processing, balance management, withdrawal processing, and visualization components. The system emphasizes security through manual admin review, hot wallet management, and comprehensive audit logging.

## Architecture

### High-Level Architecture

The system consists of five primary components:

1. **Giveaway Integration Service**: Handles incoming rewards from Kick Stream platform
2. **Balance Management Service**: Manages user account balances and transaction history
3. **Withdrawal Processing Engine**: Orchestrates the multi-step withdrawal workflow
4. **Admin Review System**: Provides manual approval interface for security
5. **Flow Visualization Component**: Interactive web-based diagram for system understanding

### Technology Stack

**Backend Services**:
- Node.js with Express.js for API services
- PostgreSQL for transactional data storage
- Redis for session management and caching
- WebSocket connections for real-time balance updates

**Frontend Components**:
- React.js for admin dashboard and user interfaces
- Mermaid.js for interactive flow diagram rendering
- Tailwind CSS for dark-themed fintech styling
- Chart.js for balance and transaction visualizations

**Infrastructure**:
- Docker containers for service deployment
- NGINX for load balancing and SSL termination
- Cryptocurrency wallet integration via Web3.js
- External API integrations for Kick Stream and Rainbet platforms

### Security Architecture

**Multi-Layer Security**:
- JWT-based authentication with refresh tokens
- Role-based access control (RBAC) for admin functions
- Rate limiting on all API endpoints
- Input validation and sanitization
- Audit logging for all financial transactions

**Hot Wallet Security**:
- Multi-signature wallet implementation
- Automated balance monitoring with alerts
- Cold storage backup for excess funds
- Transaction signing with hardware security modules

## Components and Interfaces

### Giveaway Integration Service

**Purpose**: Receives and processes giveaway rewards from Kick Stream platform

**Key Interfaces**:
```typescript
interface GiveawayReward {
  userId: string;
  streamId: string;
  amount: number;
  currency: string;
  timestamp: Date;
  source: 'kick_stream';
}

interface GiveawayProcessor {
  processReward(reward: GiveawayReward): Promise<TransactionResult>;
  validateReward(reward: GiveawayReward): boolean;
  preventDirectTip(userId: string, amount: number): void;
}
```

**Integration Points**:
- Kick Stream webhook endpoint for real-time giveaway notifications
- Balance Management Service for crediting user accounts
- Audit logging system for transaction tracking

### Balance Management Service

**Purpose**: Maintains user account balances and provides real-time updates

**Key Interfaces**:
```typescript
interface UserBalance {
  userId: string;
  balance: number;
  currency: string;
  lastUpdated: Date;
  pendingWithdrawals: number;
}

interface BalanceManager {
  creditBalance(userId: string, amount: number): Promise<void>;
  debitBalance(userId: string, amount: number): Promise<boolean>;
  getBalance(userId: string): Promise<UserBalance>;
  getTransactionHistory(userId: string): Promise<Transaction[]>;
}
```

**Real-time Features**:
- WebSocket connections for instant balance updates
- Transaction history with pagination
- Balance change notifications
- Concurrent transaction handling with optimistic locking

### Withdrawal Processing Engine

**Purpose**: Orchestrates the multi-step withdrawal workflow with security checks

**Key Interfaces**:
```typescript
interface WithdrawalRequest {
  userId: string;
  amount: number;
  rainbetId: string;
  requestedAt: Date;
  status: WithdrawalStatus;
}

interface WithdrawalProcessor {
  initiateWithdrawal(userId: string, amount: number): Promise<WithdrawalRequest>;
  checkWagerRequirements(userId: string, amount: number): Promise<WagerStatus>;
  queueForAdminReview(request: WithdrawalRequest): Promise<void>;
  processApprovedWithdrawal(requestId: string): Promise<PayoutResult>;
}
```

**Workflow States**:
- INITIATED: User has selected withdrawal amount
- WAGER_CHECK: Verifying monthly wager requirements
- ADMIN_QUEUE: Awaiting manual admin approval
- HOT_WALLET: Processing through hot wallet
- COMPLETED: Successfully deposited to Rainbet
- FAILED: Error occurred, funds returned to balance

### Admin Review System

**Purpose**: Provides secure manual approval interface for withdrawal requests

**Key Interfaces**:
```typescript
interface AdminReviewQueue {
  getPendingRequests(): Promise<WithdrawalRequest[]>;
  getRequestDetails(requestId: string): Promise<ReviewDetails>;
  approveRequest(requestId: string, adminId: string, notes: string): Promise<void>;
  rejectRequest(requestId: string, adminId: string, reason: string): Promise<void>;
}

interface ReviewDetails {
  request: WithdrawalRequest;
  userHistory: UserActivity[];
  wagerStatus: WagerStatus;
  riskScore: number;
  flaggedReasons: string[];
}
```

**Security Features**:
- Multi-factor authentication for admin access
- Audit trail of all approval decisions
- Risk scoring based on user behavior patterns
- Automated flagging of suspicious activities

### Hot Wallet Management

**Purpose**: Manages pre-loaded cryptocurrency wallet for instant payouts

**Key Interfaces**:
```typescript
interface HotWallet {
  getBalance(): Promise<WalletBalance>;
  sendPayment(address: string, amount: number): Promise<TransactionHash>;
  monitorBalance(): void;
  alertLowBalance(threshold: number): void;
}

interface WalletBalance {
  available: number;
  pending: number;
  reserved: number;
  lastUpdated: Date;
}
```

**Management Features**:
- Real-time balance monitoring with alerts
- Automated cold storage sweeps for excess funds
- Transaction confirmation tracking
- Multi-signature security for large transactions

## Data Models

### User Account Model
```typescript
interface UserAccount {
  userId: string;
  rainbetId: string;
  balance: number;
  totalEarned: number;
  totalWithdrawn: number;
  accountStatus: 'active' | 'suspended' | 'flagged';
  createdAt: Date;
  lastActivity: Date;
}
```

### Transaction Model
```typescript
interface Transaction {
  transactionId: string;
  userId: string;
  type: 'credit' | 'debit' | 'withdrawal' | 'refund';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  source: string;
  metadata: Record<string, any>;
  timestamp: Date;
}
```

### Wager Tracking Model
```typescript
interface MonthlyWager {
  userId: string;
  month: string; // YYYY-MM format
  requiredAmount: number;
  completedAmount: number;
  lastUpdated: Date;
  progressiveMultiplier: number;
}
```

### Withdrawal Request Model
```typescript
interface WithdrawalRequest {
  requestId: string;
  userId: string;
  amount: number;
  status: WithdrawalStatus;
  wagerVerified: boolean;
  adminApproved: boolean;
  adminId?: string;
  approvalNotes?: string;
  transactionHash?: string;
  createdAt: Date;
  completedAt?: Date;
}
```

### Flow Diagram Model
```typescript
interface FlowDiagramConfig {
  theme: 'dark' | 'light';
  layout: 'horizontal' | 'vertical';
  showIcons: boolean;
  interactiveElements: boolean;
  embeddable: boolean;
}

interface FlowStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  type: 'process' | 'decision' | 'terminal';
  connections: string[];
}
```

Now I need to use the prework tool to analyze the acceptance criteria before writing the correctness properties:

<function_calls>
<invoke name="prework">
<parameter name="featureName">crypto-giveaway-reward-system