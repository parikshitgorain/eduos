# Task Completion Checklist & Commands

**Purpose:** Systematic workflow to ensure nothing is missed after completing each task  
**Last Updated:** 2026-02-05

---

## 📋 Standard Command Template

After completing any task, send this command to ensure everything is properly managed:

```
Complete task [TASK_NUMBER] and finalize:

1. Run all tests and verify passing
2. Create implementation summary document
3. Create verification report (if needed)
4. Update all README files
5. Update PROJECT_STATUS.md
6. Commit changes with proper message
7. Push to GitHub
8. Verify on GitHub that all files are uploaded

Task: [TASK_NUMBER] - [TASK_NAME]
```

---

## 🎯 Detailed Command (Copy & Paste)

### For Regular Tasks

```
Complete and finalize task [TASK_NUMBER]:

IMPLEMENTATION:
✅ Task [TASK_NUMBER] - [TASK_NAME]

VERIFICATION CHECKLIST:
1. ✅ Run all tests (npm test)
2. ✅ Verify all acceptance criteria met
3. ✅ Check code coverage (should be > 80%)
4. ✅ Test error handling scenarios
5. ✅ Verify performance targets

DOCUMENTATION:
1. ✅ Create implementation summary (docs/tasks/TASK_[X.X.X]_IMPLEMENTATION_SUMMARY.md)
2. ✅ Create verification report (if complex task)
3. ✅ Update main README.md
4. ✅ Update docs/README.md
5. ✅ Update docs/PROJECT_STATUS.md
6. ✅ Create/update feature-specific documentation

GIT WORKFLOW:
1. ✅ Stage all changes (git add .)
2. ✅ Commit with descriptive message
3. ✅ Push to GitHub (git push EduOS EduOS_v3)
4. ✅ Verify on GitHub web interface

FINAL VERIFICATION:
1. ✅ All files visible on GitHub
2. ✅ All tests passing
3. ✅ Documentation complete
4. ✅ Ready for next task
```

---

## 🚀 Quick Command Templates

### Template 1: Simple Task Completion

```
Finalize task [X.X.X]:
1. Run tests
2. Create summary doc
3. Update all READMEs
4. Commit and push to GitHub
5. Verify everything uploaded
```

### Template 2: Complex Task with Verification

```
Complete task [X.X.X] with full verification:
1. Run all tests and verify passing
2. Create implementation summary
3. Create verification report
4. Update all documentation (README, PROJECT_STATUS, docs/README)
5. Commit with detailed message
6. Push to GitHub
7. Verify all files on GitHub
```

### Template 3: Task with New Features

```
Finalize task [X.X.X] - [FEATURE_NAME]:
1. Run tests (npm test)
2. Create implementation summary
3. Create feature documentation guide
4. Update API documentation (if applicable)
5. Update all README files
6. Commit and push
7. Verify on GitHub
```

---

## 📝 Specific Commands by Task Type

### For Database Tasks (1.1.x)

```
Complete database task [X.X.X]:
1. Run database tests (psql -f database/tests/...)
2. Verify migrations applied
3. Create implementation summary
4. Update database/README.md
5. Update main README and PROJECT_STATUS
6. Commit and push
7. Verify on GitHub
```

### For API Tasks (1.2.x, 1.3.x)

```
Complete API task [X.X.X]:
1. Run API tests (npm test)
2. Test all endpoints manually
3. Create implementation summary
4. Create API documentation guide
5. Update all READMEs
6. Commit and push
7. Verify on GitHub
```

### For Infrastructure Tasks (Redis, Auth, etc.)

```
Complete infrastructure task [X.X.X]:
1. Run all tests
2. Verify service health
3. Create implementation summary
4. Create architecture documentation
5. Update docker-compose.yml (if needed)
6. Update all READMEs
7. Commit and push
8. Verify on GitHub
```

---

## 🔍 Verification Checklist

### Before Saying "Task Complete"

- [ ] All tests passing (npm test)
- [ ] Code coverage > 80%
- [ ] All acceptance criteria met
- [ ] Error handling tested
- [ ] Performance targets met
- [ ] Implementation summary created
- [ ] Verification report created (if complex)
- [ ] Main README.md updated
- [ ] docs/README.md updated
- [ ] docs/PROJECT_STATUS.md updated
- [ ] Feature documentation created
- [ ] Git committed with proper message
- [ ] Git pushed to GitHub
- [ ] Verified on GitHub web interface
- [ ] All files visible and correct

---

## 📦 File Checklist

### Files That Should Be Created/Updated

#### Always Create:
1. `docs/tasks/TASK_[X.X.X]_IMPLEMENTATION_SUMMARY.md`

#### Update Always:
1. `README.md` - Main project README
2. `docs/README.md` - Documentation index
3. `docs/PROJECT_STATUS.md` - Project status dashboard
4. `.kiro/specs/eduos-platform/tasks.md` - Mark task as complete

#### Create If Needed:
1. `docs/tasks/TASK_[X.X.X]_VERIFICATION_REPORT.md` - For complex tasks
2. `docs/[FEATURE_NAME].md` - Feature-specific documentation
3. New migration files (if database changes)
4. New test files
5. New API route files

---

## 🎨 Commit Message Template

### Standard Format

```
feat: Complete Task [X.X.X] - [Task Name]

✨ New Features:
- [Feature 1]
- [Feature 2]
- [Feature 3]

🏗️ Architecture:
- [Architecture change 1]
- [Architecture change 2]

📊 Performance:
- [Performance metric 1]
- [Performance metric 2]

🧪 Testing:
- [Test count] tests passing
- [Coverage]% code coverage
- All acceptance criteria met

📚 Documentation:
- Implementation summary
- [Feature] documentation guide
- Updated all READMEs

🔧 Technical Details:
- [Technical detail 1]
- [Technical detail 2]

Tasks Completed:
✅ [X.X.X] - [Task name]

Next: Task [Y.Y.Y] - [Next task name]
```

---

## 🔄 Complete Workflow Example

### Example: After Completing Task 1.3.1

**Command to send:**

```
Complete and finalize task 1.3.1:

IMPLEMENTATION:
✅ Task 1.3.1 - OAuth2/OIDC Authentication Service

VERIFICATION CHECKLIST:
1. ✅ Run all tests (npm test)
2. ✅ Verify OAuth2 flow works
3. ✅ Test OIDC discovery endpoint
4. ✅ Verify JWT token generation
5. ✅ Test token expiry

DOCUMENTATION:
1. ✅ Create docs/tasks/TASK_1.3.1_IMPLEMENTATION_SUMMARY.md
2. ✅ Create docs/AUTH_SERVICE.md
3. ✅ Update README.md (mark 1.3.1 complete)
4. ✅ Update docs/README.md (add auth docs)
5. ✅ Update docs/PROJECT_STATUS.md (7/13 tasks)

GIT WORKFLOW:
1. ✅ git add .
2. ✅ git commit -m "feat: Complete Task 1.3.1 - OAuth2/OIDC Authentication"
3. ✅ git push EduOS EduOS_v3
4. ✅ Verify on GitHub

FINAL VERIFICATION:
1. ✅ All files on GitHub
2. ✅ Tests passing
3. ✅ Documentation complete
4. ✅ Ready for task 1.3.2
```

---

## 🎯 One-Line Quick Command

For quick tasks, use this simplified version:

```
Finalize task [X.X.X]: tests → summary → update READMEs → commit → push → verify GitHub
```

---

## 📊 Progress Tracking

### After Each Task, Update:

1. **Task Status** in `tasks.md`:
   ```markdown
   - [x] X.X.X Task name
   ```

2. **Progress Percentage** in `PROJECT_STATUS.md`:
   ```markdown
   **Progress:** 7/13 tasks complete (54%)
   ```

3. **Completed Tasks List** in `PROJECT_STATUS.md`:
   ```markdown
   X. **Task X.X.X: Task Name** - COMPLETE ✅
   ```

4. **Next Task** in all READMEs:
   ```markdown
   **Next Task:** X.X.X - Next task name
   ```

---

## 🚨 Critical Reminders

### Never Forget:

1. ✅ **Run tests** before saying complete
2. ✅ **Create implementation summary** (mandatory)
3. ✅ **Update all 3 READMEs** (main, docs, PROJECT_STATUS)
4. ✅ **Commit with descriptive message**
5. ✅ **Push to GitHub**
6. ✅ **Verify on GitHub web interface**

### Common Mistakes to Avoid:

- ❌ Forgetting to update PROJECT_STATUS.md
- ❌ Not creating implementation summary
- ❌ Committing without running tests
- ❌ Not verifying files on GitHub
- ❌ Incomplete commit messages
- ❌ Not updating progress percentages

---

## 🎓 Best Practices

### Documentation:

1. **Implementation Summary** should include:
   - What was implemented
   - How it works
   - Test results
   - Performance metrics
   - API examples
   - Known limitations

2. **Verification Report** (for complex tasks) should include:
   - All acceptance criteria checked
   - Test coverage details
   - Performance verification
   - Security considerations
   - Production readiness

3. **Feature Documentation** should include:
   - Architecture overview
   - Configuration guide
   - API reference
   - Usage examples
   - Troubleshooting

### Git Commits:

1. Use semantic commit messages
2. Include emojis for visual clarity
3. List all major changes
4. Reference task numbers
5. Mention next task

---

## 📱 Mobile-Friendly Quick Command

```
Task [X.X.X] done:
1. Tests ✅
2. Summary doc ✅
3. READMEs ✅
4. Commit ✅
5. Push ✅
6. Verify GitHub ✅
```

---

## 🔗 Related Documents

- [Project Status](PROJECT_STATUS.md)
- [Documentation Index](README.md)
- [Task List](../.kiro/specs/eduos-platform/tasks.md)
- [File Organization](FILE_ORGANIZATION.md)

---

## 💡 Pro Tips

1. **Copy this checklist** at the start of each task
2. **Check off items** as you complete them
3. **Use the templates** - don't write from scratch
4. **Verify on GitHub** - always double-check
5. **Keep it systematic** - same process every time

---

**Remember:** Consistency is key! Use the same process for every task to ensure nothing is missed.

---

**Last Updated:** 2026-02-05  
**Version:** 1.0
