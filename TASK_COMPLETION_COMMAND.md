# 🎯 Task Completion Command (Quick Reference)

**Copy and paste this command after completing ANY task:**

---

## 📋 STANDARD COMMAND

```
Complete and finalize task [TASK_NUMBER]:

VERIFICATION:
1. Run all tests (npm test) ✅
2. Verify all acceptance criteria met ✅
3. Check code coverage > 80% ✅

DOCUMENTATION:
1. Create implementation summary ✅
2. Create verification report (if complex) ✅
3. Update README.md ✅
4. Update docs/README.md ✅
5. Update docs/PROJECT_STATUS.md ✅

GIT:
1. git add . ✅
2. git commit with proper message ✅
3. git push EduOS EduOS_v3 ✅
4. Verify on GitHub web interface ✅

Task: [TASK_NUMBER] - [TASK_NAME]
```

---

## 🚀 QUICK VERSION

```
Finalize task [X.X.X]:
1. Tests → 2. Summary → 3. READMEs → 4. Commit → 5. Push → 6. Verify GitHub
```

---

## 📝 EXAMPLE USAGE

### For Task 1.3.1:

```
Complete and finalize task 1.3.1:

VERIFICATION:
1. Run all tests (npm test) ✅
2. Verify OAuth2 flow works ✅
3. Check code coverage > 80% ✅

DOCUMENTATION:
1. Create docs/tasks/TASK_1.3.1_IMPLEMENTATION_SUMMARY.md ✅
2. Create docs/AUTH_SERVICE.md ✅
3. Update README.md ✅
4. Update docs/README.md ✅
5. Update docs/PROJECT_STATUS.md ✅

GIT:
1. git add . ✅
2. git commit -m "feat: Complete Task 1.3.1 - OAuth2/OIDC" ✅
3. git push EduOS EduOS_v3 ✅
4. Verify on GitHub ✅

Task: 1.3.1 - OAuth2/OIDC Authentication Service
```

---

## ✅ CHECKLIST

Before saying "task complete":

- [ ] All tests passing
- [ ] Implementation summary created
- [ ] All READMEs updated (3 files)
- [ ] Committed to git
- [ ] Pushed to GitHub
- [ ] Verified on GitHub web

---

## 📂 FILES TO UPDATE

**Always Create:**
- `docs/tasks/TASK_[X.X.X]_IMPLEMENTATION_SUMMARY.md`

**Always Update:**
- `README.md`
- `docs/README.md`
- `docs/PROJECT_STATUS.md`
- `.kiro/specs/eduos-platform/tasks.md`

---

## 🎨 COMMIT MESSAGE FORMAT

```
feat: Complete Task [X.X.X] - [Task Name]

✨ Features: [list]
🧪 Testing: [X] tests passing
📚 Documentation: Complete
✅ Task [X.X.X] complete

Next: Task [Y.Y.Y]
```

---

**Full Guide:** See [docs/TASK_COMPLETION_CHECKLIST.md](docs/TASK_COMPLETION_CHECKLIST.md)
