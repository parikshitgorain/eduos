# File Organization Guide

**Last Updated:** 2026-02-05

---

## 📁 Directory Structure

```
eduos-platform/
│
├── 📄 Root Files (Essential Only)
│   ├── README.md                      # Main project documentation
│   ├── package.json                   # Dependencies and scripts
│   ├── setup.js                       # Automated setup script
│   ├── jest.config.js                 # Test configuration
│   ├── docker-compose.yml             # Docker services
│   ├── .env                           # Environment variables (not in git)
│   ├── .env.example                   # Environment template
│   └── .gitignore                     # Git ignore rules
│
├── 📂 .kiro/specs/eduos-platform/     # Project Specifications
│   ├── requirements.md                # System requirements
│   ├── design.md                      # Technical design
│   └── tasks.md                       # Implementation roadmap
│
├── 📂 database/                       # Database Layer
│   ├── migrations/                    # SQL migration files
│   │   ├── 001_setup_rls_foundation.sql
│   │   └── 002_tenant_provisioning.sql
│   ├── tests/                         # Database tests
│   │   └── rls_isolation.test.sql
│   ├── docs/                          # Database documentation
│   │   └── RLS_POLICY_REFERENCE.md
│   ├── migrate.js                     # Migration runner
│   ├── setup.sh                       # Unix setup script
│   ├── validate.sh                    # Unix validation
│   ├── validate.ps1                   # Windows validation
│   ├── README.md                      # Database guide
│   └── QUICK_REFERENCE.md             # Quick reference
│
├── 📂 docs/                           # Documentation
│   ├── README.md                      # Documentation index
│   ├── PROJECT_STATUS.md              # Current project status
│   ├── FILE_ORGANIZATION.md           # This file
│   ├── SETUP_GUIDE.md                 # Installation guide
│   ├── TENANT_PROVISIONING_API.md     # API documentation
│   ├── RESET_POSTGRES_PASSWORD.md     # PostgreSQL password reset
│   └── tasks/                         # Task summaries
│       ├── TASK_1.1.1_IMPLEMENTATION_SUMMARY.md
│       ├── TASK_1.1.2_IMPLEMENTATION_SUMMARY.md
│       ├── TASK_1.1.2_REVIEW.md
│       ├── TASK_1.1.3_IMPLEMENTATION_SUMMARY.md
│       └── TASK_1.1.3_TEST_FIXES.md
│
├── 📂 scripts/                        # Utility Scripts
│   ├── reset-postgres-password.ps1    # PowerShell password reset
│   └── reset-postgres-password.sql    # SQL password reset
│
└── 📂 src/                            # Source Code
    ├── config/                        # Configuration
    │   └── database.js                # Database connection
    ├── middleware/                    # Express middleware
    │   ├── tenantContext.js           # Tenant isolation
    │   ├── tenantContext.test.js      # Middleware tests
    │   └── tenantContext.simple.test.js
    ├── routes/                        # API routes
    │   ├── tenants.js                 # Tenant endpoints
    │   └── tenants.test.js            # Route tests
    ├── services/                      # Business logic
    │   └── tenantService.js           # Tenant service
    ├── utils/                         # Utilities
    │   └── generateToken.js           # JWT utilities
    ├── server.js                      # Express server
    └── server.test.js                 # Server tests
```

---

## 📋 File Organization Rules

### ✅ DO

1. **Root Directory**
   - Keep only essential configuration files
   - No temporary or utility files
   - No documentation files (use `docs/`)

2. **Documentation**
   - All docs go in `docs/` folder
   - Task summaries in `docs/tasks/`
   - Use clear, descriptive filenames
   - Include date in summaries

3. **Scripts**
   - Utility scripts in `scripts/` folder
   - Use descriptive names
   - Include comments explaining usage

4. **Source Code**
   - Organize by feature/layer
   - Co-locate tests with source files
   - Use consistent naming conventions

5. **Database**
   - Migrations numbered sequentially
   - Include rollback scripts
   - Document schema changes

### ❌ DON'T

1. **Avoid Root Clutter**
   - No random markdown files
   - No temporary scripts
   - No test output files
   - No backup files

2. **Don't Mix Concerns**
   - Keep docs separate from code
   - Keep tests with their modules
   - Keep scripts separate from source

3. **Don't Duplicate**
   - One source of truth for each concept
   - Link to existing docs instead of copying
   - Use references, not repetition

---

## 📝 Naming Conventions

### Files

- **Documentation:** `UPPERCASE_WITH_UNDERSCORES.md`
- **Source Code:** `camelCase.js` or `PascalCase.js`
- **Tests:** `filename.test.js` or `filename.spec.js`
- **Scripts:** `kebab-case.ps1` or `kebab-case.sh`
- **Migrations:** `###_descriptive_name.sql`

### Directories

- **Lowercase:** `database/`, `docs/`, `scripts/`
- **Descriptive:** Clear purpose from name
- **Plural:** Use plural for collections (`tasks/`, `migrations/`)

---

## 🗂️ File Categories

### 1. Configuration Files (Root)

```
.env                    # Environment variables (not in git)
.env.example            # Environment template
.gitignore              # Git ignore rules
docker-compose.yml      # Docker services
jest.config.js          # Test configuration
package.json            # Dependencies and scripts
```

### 2. Documentation Files (docs/)

```
README.md               # Documentation index
PROJECT_STATUS.md       # Current status
FILE_ORGANIZATION.md    # This file
SETUP_GUIDE.md          # Installation guide
TENANT_PROVISIONING_API.md  # API docs
RESET_POSTGRES_PASSWORD.md  # Password reset guide
tasks/                  # Task summaries
```

### 3. Database Files (database/)

```
migrations/             # SQL migration files
tests/                  # Database tests
docs/                   # Database documentation
migrate.js              # Migration runner
README.md               # Database guide
```

### 4. Source Code (src/)

```
config/                 # Configuration
middleware/             # Express middleware
routes/                 # API routes
services/               # Business logic
utils/                  # Utilities
server.js               # Express server
```

### 5. Utility Scripts (scripts/)

```
reset-postgres-password.ps1  # PowerShell scripts
reset-postgres-password.sql  # SQL scripts
```

---

## 🔍 Finding Files

### By Purpose

**Need to setup the project?**
→ `README.md` → `docs/SETUP_GUIDE.md`

**Need API documentation?**
→ `docs/TENANT_PROVISIONING_API.md`

**Need to check project status?**
→ `docs/PROJECT_STATUS.md`

**Need to reset PostgreSQL password?**
→ `docs/RESET_POSTGRES_PASSWORD.md` → `scripts/reset-postgres-password.ps1`

**Need to see task implementation?**
→ `docs/tasks/TASK_X.X.X_IMPLEMENTATION_SUMMARY.md`

**Need to understand database schema?**
→ `database/README.md` → `database/docs/RLS_POLICY_REFERENCE.md`

**Need to run migrations?**
→ `database/migrate.js` → `database/migrations/`

---

## 🧹 Cleanup Checklist

When organizing files, ensure:

- [ ] No files in root except essentials
- [ ] All docs in `docs/` folder
- [ ] All scripts in `scripts/` folder
- [ ] All task summaries in `docs/tasks/`
- [ ] No duplicate documentation
- [ ] No temporary files committed
- [ ] No backup files (*.bak, *.old)
- [ ] .gitignore is up to date
- [ ] Documentation index is current
- [ ] All links in docs are working

---

## 📊 File Count Summary

```
Root:           9 files (configuration only)
docs/:          5 files + 5 task summaries
scripts/:       2 files (utilities)
database/:      7 files + migrations + tests
src/:           ~15 files (source + tests)
```

**Total:** ~45 organized files

---

## 🔄 Maintenance

### When Adding New Files

1. **Determine Category**
   - Documentation? → `docs/`
   - Script? → `scripts/`
   - Source code? → `src/`
   - Database? → `database/`

2. **Follow Naming Convention**
   - Use appropriate case
   - Be descriptive
   - Include version/date if applicable

3. **Update Documentation**
   - Add to `docs/README.md` index
   - Update `PROJECT_STATUS.md` if needed
   - Link from relevant documents

4. **Update .gitignore**
   - Add patterns for generated files
   - Exclude sensitive data
   - Exclude temporary files

### When Removing Files

1. **Check References**
   - Search for links in documentation
   - Check imports in source code
   - Verify no dependencies

2. **Update Documentation**
   - Remove from indexes
   - Update status documents
   - Fix broken links

3. **Archive if Needed**
   - Move to archive folder
   - Or document in git history
   - Don't just delete important files

---

## ✅ Current Organization Status

**Status:** ✅ **ORGANIZED**

- ✅ Root directory clean (9 essential files only)
- ✅ All documentation in `docs/` folder
- ✅ All scripts in `scripts/` folder
- ✅ Task summaries in `docs/tasks/`
- ✅ Source code properly structured
- ✅ Database files organized
- ✅ No duplicate files
- ✅ No temporary files in git
- ✅ Documentation index up to date
- ✅ All links working

**Last Cleanup:** 2026-02-05

---

## 📞 Questions?

If you're unsure where a file should go:

1. Check this guide first
2. Look at similar existing files
3. Follow the "DO" rules above
4. When in doubt, ask the team

**Remember:** A well-organized project is easier to maintain, understand, and scale! 🚀

