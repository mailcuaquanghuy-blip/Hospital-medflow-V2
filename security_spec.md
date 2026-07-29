# Security Specification - Hospital medflow

## 1. Data Invariants
- **Appointments**: Must belong to a valid patient, staff, and procedure. Standard business hours must be respected (though warnings are allowed).
- **Users**: Only admins can manage other users. Staff can manage their own profiles if allowed.
- **Attendance**: Linked to existing staff members.
- **System Config**: Read-only for standard users, writable by admins or system processes.
- **Backups**: Immutable once created (only create/read).

## 2. The "Dirty Dozen" Payloads (Attack Scenarios)

1. **Identity Spoofing**: User A attempts to update User B's profile (role/permissions).
2. **Orphaned Appointment**: Creating an appointment with a non-existent `patientId`.
3. **Privilege Escalation**: Standard user attempts to become an ADMIN by updating their own account.
4. **ID Poisoning**: Injecting a 2KB string as a `patientId`.
5. **State Shortcut**: Moving an appointment from `PENDING` to `COMPLETED` without passing through `IN_PROGRESS` (if state machine enforced).
6. **Immutable field violation**: Changing `createdAt` on a backup.
7. **Size Limit Bypass**: Injecting a 1MB string into a patient's `name` field.
8. **Unauthorized List**: A user trying to list all `backups` without being an admin.
9. **Type Mismatch**: Sending a string for a `durationMinutes` field in `procedures`.
10. **Ghost Field Injection**: Adding a `isVerified: true` field to a `users` document that doesn't exist in schema.
11. **Relational Bypass**: Deleting a `staff` member who still has active `appointments`.
12. **Timestamp Spoofing**: Providing a client-side `createdAt` date instead of `request.time`.

## 3. Test Runner Strategy
We will use `firestore.rules.test.ts` to verify these invariants.

[... tests would go here ...]
