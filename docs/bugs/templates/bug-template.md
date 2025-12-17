# Bug Report Template

## Bug Information

**Bug ID**: BUG-XXX  
**Title**: [Brief description of the bug]  
**Severity**: Critical | Major | Minor  
**Status**: Open | In Progress | Fixed | Verified  
**Date Reported**: YYYY-MM-DD  
**Date Fixed**: YYYY-MM-DD (if applicable)  
**Reporter**: [Name]  
**Assignee**: [Name]  

---

## Summary

[One paragraph summary of what the bug is and its impact]

---

## Affected Components

| Component | File Path | Type |
|-----------|-----------|------|
| [Component Name] | [file/path.ts] | Frontend/Backend/Database |

---

## Reproduction Steps

1. Step one
2. Step two
3. Step three
4. ...

**Expected Behavior**:  
[What should happen]

**Actual Behavior**:  
[What actually happens]

---

## Environment

- **Browser**: Chrome/Firefox/Safari/Edge
- **OS**: Windows/macOS/Linux
- **Node Version**: vX.X.X
- **User Count**: [How many users in space when bug occurs]

---

## Console Logs / Error Messages

```
[Paste relevant console output here]
```

---

## Root Cause Analysis

### Problem

[Detailed explanation of why this bug occurs]

### Technical Details

```typescript
// Code snippet showing the problematic code
```

---

## Solution

### Approach

[Description of how to fix the bug]

### Code Changes

**File**: `[file/path.ts]`

```typescript
// BEFORE (buggy code)
const buggyCode = 'old code';

// AFTER (fixed code)
const fixedCode = 'new code';
```

---

## Testing

### Manual Testing

1. [Test step 1]
2. [Test step 2]
3. [Verify expected behavior]

### Automated Testing

```typescript
// Test case
describe('Bug BUG-XXX', () => {
  it('should [expected behavior]', () => {
    // Test implementation
  });
});
```

---

## Related Issues

- **Related Bugs**: BUG-XXX, BUG-YYY
- **PR/Commit**: [Link to PR or commit]
- **Documentation**: [Link to relevant docs]

---

## Notes

[Any additional notes, workarounds, or considerations]
