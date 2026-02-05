# Reset PostgreSQL Password - Quick Guide

## Method 1: Using pgAdmin (Easiest)

1. Open **pgAdmin 4** from Start menu
2. When it asks for password, try: `postgres`, `admin`, or the password you set
3. Once connected:
   - Expand: PostgreSQL 18 → Login/Group Roles
   - Right-click "postgres" → Properties
   - Go to "Definition" tab
   - Set password to: `postgres`
   - Click Save

## Method 2: Temporarily Disable Password (If you forgot)

1. **Stop PostgreSQL service:**
   ```powershell
   Stop-Service postgresql-x64-18
   ```

2. **Edit pg_hba.conf:**
   - Open: `C:\Program Files\PostgreSQL\18\data\pg_hba.conf`
   - Find these lines:
     ```
     host    all             all             127.0.0.1/32            scram-sha-256
     host    all             all             ::1/128                 scram-sha-256
     ```
   - Change `scram-sha-256` to `trust`:
     ```
     host    all             all             127.0.0.1/32            trust
     host    all             all             ::1/128                 trust
     ```
   - Save the file

3. **Start PostgreSQL service:**
   ```powershell
   Start-Service postgresql-x64-18
   ```

4. **Reset password (no password needed now):**
   ```powershell
   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"
   ```

5. **Restore pg_hba.conf:**
   - Change `trust` back to `scram-sha-256`
   - Save the file

6. **Restart PostgreSQL:**
   ```powershell
   Restart-Service postgresql-x64-18
   ```

## Method 3: Reinstall PostgreSQL

If nothing works, uninstall and reinstall PostgreSQL, making sure to set password to `postgres` during installation.

## After Password Reset

Run these commands:
```bash
npm run setup
npm test
```

All 18 tests should pass! 🚀
