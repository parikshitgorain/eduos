# Offline-First Mobile Attendance Module

## Overview

The offline-first mobile attendance module enables teachers to mark attendance on mobile devices without requiring network connectivity. Data is stored locally in SQLite and synced to the server when connectivity is available.

## Architecture

```
┌─────────────────────────────────────────┐
│         Mobile App (React Native)       │
│  ┌───────────────────────────────────┐  │
│  │   Attendance Marking UI           │  │
│  │   • Bulk select (all present)     │  │
│  │   • Individual marking            │  │
│  │   • Status: Present/Absent/Late   │  │
│  └───────────────┬───────────────────┘  │
│                  │                       │
│  ┌───────────────▼───────────────────┐  │
│  │   Local SQLite Database           │  │
│  │   • offline_events table          │  │
│  │   • Stores pending sync events    │  │
│  │   • Works 100% offline            │  │
│  └───────────────┬───────────────────┘  │
│                  │                       │
│  ┌───────────────▼───────────────────┐  │
│  │   Background Sync Service         │  │
│  │   • Monitors network status       │  │
│  │   • Auto-sync when online         │  │
│  │   • Manual "Sync Now" button      │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                  │
                  │ HTTPS
                  ▼
┌─────────────────────────────────────────┐
│      Server (Attendance Service)        │
│  • Idempotent sync API                  │
│  • Conflict resolution                  │
│  • Timezone normalization               │
└─────────────────────────────────────────┘
```

## Mobile SQLite Schema

### offline_events Table

Stores attendance events locally before syncing to the server.

```sql
CREATE TABLE offline_events (
  -- Primary identifier
  event_id TEXT PRIMARY KEY,
  
  -- Idempotency
  idempotency_key TEXT UNIQUE NOT NULL,
  
  -- Device and user info
  device_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  
  -- Timestamps
  client_ts TEXT NOT NULL,           -- ISO 8601 with timezone
  client_local_time TEXT NOT NULL,   -- Original local time
  
  -- Event details
  event_type TEXT NOT NULL,          -- 'attendance_mark'
  data TEXT NOT NULL,                -- JSON blob with attendance data
  
  -- Sync status
  sync_status TEXT DEFAULT 'pending', -- 'pending', 'synced', 'conflict'
  
  -- Metadata
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Indexes for performance
CREATE INDEX idx_sync_status ON offline_events(sync_status);
CREATE INDEX idx_device_id ON offline_events(device_id);
CREATE INDEX idx_created_at ON offline_events(created_at);
```

### Event Data Structure

The `data` field contains a JSON blob with the following structure:

```json
{
  "batch_id": "uuid-v4",
  "session_id": "uuid-v4",
  "student_id": "uuid-v4",
  "status": "present | absent | late",
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "accuracy_meters": 10
  }
}
```

## Mobile Implementation Guide

### 1. Initialize SQLite Database

```javascript
import SQLite from 'react-native-sqlite-storage';

const db = SQLite.openDatabase({
  name: 'attendance.db',
  location: 'default'
});

// Create table on first launch
db.transaction(tx => {
  tx.executeSql(`
    CREATE TABLE IF NOT EXISTS offline_events (
      event_id TEXT PRIMARY KEY,
      idempotency_key TEXT UNIQUE NOT NULL,
      device_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      client_ts TEXT NOT NULL,
      client_local_time TEXT NOT NULL,
      event_type TEXT NOT NULL,
      data TEXT NOT NULL,
      sync_status TEXT DEFAULT 'pending',
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
  
  tx.executeSql(`
    CREATE INDEX IF NOT EXISTS idx_sync_status 
    ON offline_events(sync_status)
  `);
});
```

### 2. Mark Attendance (Offline)

```javascript
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

async function markAttendance(studentId, sessionId, batchId, status, userId, deviceId) {
  const eventId = uuidv4();
  const clientTs = new Date().toISOString();
  
  // Generate idempotency key
  const idempotencyData = `${eventId}:${deviceId}:${clientTs}`;
  const idempotencyKey = crypto
    .createHash('sha256')
    .update(idempotencyData)
    .digest('hex');
  
  // Get location (optional)
  const location = await getCurrentLocation();
  
  // Prepare event data
  const eventData = {
    batch_id: batchId,
    session_id: sessionId,
    student_id: studentId,
    status: status,
    location: location
  };
  
  // Store in SQLite
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `INSERT INTO offline_events (
          event_id, idempotency_key, device_id, user_id,
          client_ts, client_local_time, event_type, data, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventId,
          idempotencyKey,
          deviceId,
          userId,
          clientTs,
          clientTs,
          'attendance_mark',
          JSON.stringify(eventData),
          'pending'
        ],
        (tx, result) => resolve(result),
        (tx, error) => reject(error)
      );
    });
  });
}
```

### 3. Bulk Attendance Marking

```javascript
async function markBulkAttendance(students, sessionId, batchId, status, userId, deviceId) {
  const events = [];
  
  for (const student of students) {
    const eventId = uuidv4();
    const clientTs = new Date().toISOString();
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${eventId}:${deviceId}:${clientTs}`)
      .digest('hex');
    
    events.push({
      event_id: eventId,
      idempotency_key: idempotencyKey,
      device_id: deviceId,
      user_id: userId,
      client_ts: clientTs,
      client_local_time: clientTs,
      event_type: 'attendance_mark',
      data: JSON.stringify({
        batch_id: batchId,
        session_id: sessionId,
        student_id: student.id,
        status: status
      }),
      sync_status: 'pending'
    });
  }
  
  // Batch insert
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      events.forEach(event => {
        tx.executeSql(
          `INSERT INTO offline_events (
            event_id, idempotency_key, device_id, user_id,
            client_ts, client_local_time, event_type, data, sync_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            event.event_id,
            event.idempotency_key,
            event.device_id,
            event.user_id,
            event.client_ts,
            event.client_local_time,
            event.event_type,
            event.data,
            event.sync_status
          ]
        );
      });
    }, reject, resolve);
  });
}
```

### 4. Sync to Server

```javascript
async function syncOfflineEvents(authToken) {
  // Get pending events
  const pendingEvents = await new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM offline_events WHERE sync_status = 'pending'`,
        [],
        (tx, result) => {
          const events = [];
          for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows.item(i);
            events.push({
              event_id: row.event_id,
              device_id: row.device_id,
              user_id: row.user_id,
              client_ts: row.client_ts,
              client_local_time: row.client_local_time,
              event_type: row.event_type,
              data: JSON.parse(row.data)
            });
          }
          resolve(events);
        },
        (tx, error) => reject(error)
      );
    });
  });
  
  if (pendingEvents.length === 0) {
    return { status: 'success', message: 'No events to sync' };
  }
  
  // Send to server
  const response = await fetch('https://api.eduos.com/api/v1/attendance/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ events: pendingEvents })
  });
  
  const result = await response.json();
  
  // Update sync status for successful events
  if (result.status === 'success') {
    await new Promise((resolve, reject) => {
      db.transaction(tx => {
        result.details.forEach(detail => {
          if (detail.status === 'synced' || detail.status === 'conflict_resolved') {
            tx.executeSql(
              `UPDATE offline_events SET sync_status = 'synced' WHERE event_id = ?`,
              [detail.event_id]
            );
          } else if (detail.status === 'conflict_rejected') {
            tx.executeSql(
              `UPDATE offline_events SET sync_status = 'conflict' WHERE event_id = ?`,
              [detail.event_id]
            );
          }
        });
      }, reject, resolve);
    });
  }
  
  return result;
}
```

### 5. Background Sync Service

```javascript
import NetInfo from '@react-native-community/netinfo';

// Monitor network status and auto-sync
NetInfo.addEventListener(state => {
  if (state.isConnected && state.isInternetReachable) {
    syncOfflineEvents(authToken)
      .then(result => {
        console.log('Auto-sync completed:', result);
        showNotification('Attendance synced successfully');
      })
      .catch(error => {
        console.error('Auto-sync failed:', error);
      });
  }
});

// Manual sync button
function handleManualSync() {
  syncOfflineEvents(authToken)
    .then(result => {
      showNotification(`Synced ${result.synced_events} events`);
    })
    .catch(error => {
      showError('Sync failed. Will retry when online.');
    });
}
```

### 6. Local Validation (Prevent Duplicates)

```javascript
async function checkDuplicateAttendance(studentId, sessionId) {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT COUNT(*) as count FROM offline_events 
         WHERE json_extract(data, '$.student_id') = ? 
         AND json_extract(data, '$.session_id') = ?`,
        [studentId, sessionId],
        (tx, result) => {
          const count = result.rows.item(0).count;
          resolve(count > 0);
        },
        (tx, error) => reject(error)
      );
    });
  });
}

// Use before marking attendance
async function markAttendanceWithValidation(studentId, sessionId, batchId, status, userId, deviceId) {
  const isDuplicate = await checkDuplicateAttendance(studentId, sessionId);
  
  if (isDuplicate) {
    throw new Error('Attendance already marked for this student in this session');
  }
  
  return markAttendance(studentId, sessionId, batchId, status, userId, deviceId);
}
```

## UI Components

### Bulk Attendance Marking UI

```javascript
import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Button } from 'react-native';

function BulkAttendanceScreen({ students, sessionId, batchId }) {
  const [attendanceMap, setAttendanceMap] = useState({});
  
  const markAll = (status) => {
    const newMap = {};
    students.forEach(student => {
      newMap[student.id] = status;
    });
    setAttendanceMap(newMap);
  };
  
  const toggleStatus = (studentId) => {
    const currentStatus = attendanceMap[studentId] || 'absent';
    const nextStatus = currentStatus === 'present' ? 'absent' : 
                       currentStatus === 'absent' ? 'late' : 'present';
    setAttendanceMap({
      ...attendanceMap,
      [studentId]: nextStatus
    });
  };
  
  const saveAttendance = async () => {
    const markedStudents = Object.entries(attendanceMap).map(([studentId, status]) => ({
      id: studentId,
      status: status
    }));
    
    await markBulkAttendance(
      markedStudents,
      sessionId,
      batchId,
      'present', // Default, overridden by individual status
      userId,
      deviceId
    );
    
    showNotification('Attendance saved locally. Will sync when online.');
  };
  
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <Button title="Mark All Present" onPress={() => markAll('present')} />
        <Button title="Mark All Absent" onPress={() => markAll('absent')} />
      </View>
      
      <FlatList
        data={students}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => toggleStatus(item.id)}>
            <View style={{ flexDirection: 'row', padding: 10 }}>
              <Text>{item.name}</Text>
              <Text style={{ marginLeft: 'auto' }}>
                {attendanceMap[item.id] || 'Not Marked'}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
      
      <Button title="Save Attendance" onPress={saveAttendance} />
    </View>
  );
}
```

## Server API

### Sync Endpoint

**POST** `/api/v1/attendance/sync`

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "events": [
    {
      "event_id": "uuid-v4",
      "device_id": "device-identifier",
      "user_id": "teacher-uuid",
      "client_ts": "2026-02-04T09:15:30+05:30",
      "client_local_time": "2026-02-04T09:15:30+05:30",
      "event_type": "attendance_mark",
      "data": {
        "batch_id": "batch-uuid",
        "session_id": "session-uuid",
        "student_id": "student-uuid",
        "status": "present",
        "location": {
          "latitude": 12.9716,
          "longitude": 77.5946,
          "accuracy_meters": 10
        }
      }
    }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "synced_events": 25,
  "conflicts_resolved": 2,
  "errors": 0,
  "details": [
    {
      "event_id": "uuid-v4",
      "status": "synced"
    },
    {
      "event_id": "uuid-v4",
      "status": "conflict_resolved",
      "resolution": {
        "action": "replace",
        "winner": "new",
        "reason": "Earlier client timestamp"
      }
    }
  ]
}
```

## Conflict Resolution

The system uses the "Earliest Client Timestamp" rule to resolve conflicts:

1. **Scenario:** Two teachers mark the same student at different times
2. **Detection:** Server detects multiple events for same (student_id, session_id)
3. **Resolution:** Event with earlier `client_ts` wins
4. **Logging:** Conflict is logged in `sync_conflicts` table
5. **Notification:** Both teachers are notified of the conflict

## Testing

### Local Validation Tests

```javascript
describe('Local Validation', () => {
  test('should prevent duplicate attendance marking', async () => {
    await markAttendance('student-1', 'session-1', 'batch-1', 'present', 'user-1', 'device-1');
    
    const isDuplicate = await checkDuplicateAttendance('student-1', 'session-1');
    expect(isDuplicate).toBe(true);
  });
  
  test('should allow marking different students', async () => {
    await markAttendance('student-1', 'session-1', 'batch-1', 'present', 'user-1', 'device-1');
    
    const isDuplicate = await checkDuplicateAttendance('student-2', 'session-1');
    expect(isDuplicate).toBe(false);
  });
});
```

## Performance Considerations

1. **Batch Inserts:** Use transactions for bulk attendance marking
2. **Indexes:** Create indexes on `sync_status` and `device_id` for fast queries
3. **Cleanup:** Periodically delete synced events older than 7 days
4. **Sync Throttling:** Limit sync frequency to avoid overwhelming the server

## Security

1. **Authentication:** All sync requests require valid JWT token
2. **Tenant Isolation:** Server enforces tenant_id from JWT
3. **Idempotency:** Prevents duplicate records from multiple sync attempts
4. **Location Privacy:** Location data is optional and encrypted in transit

## Troubleshooting

### Sync Failures

If sync fails:
1. Events remain in `pending` status
2. User sees "Will sync when online" message
3. Background service retries automatically
4. Manual "Sync Now" button available

### Conflicts

If conflicts occur:
1. Server applies "Earliest Client Timestamp" rule
2. Losing event is logged in `sync_conflicts` table
3. Admin can review and manually override if needed
4. Both teachers receive notification

## Future Enhancements

1. **Biometric Verification:** Add fingerprint/face recognition for attendance
2. **Geofencing:** Restrict attendance marking to specific locations
3. **Photo Capture:** Optional photo capture for attendance verification
4. **Offline Reports:** Generate attendance reports offline
5. **Multi-Language Support:** Localize UI for different languages
