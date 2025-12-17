# BUG-030: Keyboard Controls Stop Working

## Bug Information

**Bug ID**: BUG-030  
**Title**: Arrow Key Movement Stops Responding After Interacting with UI  
**Severity**: Medium  
**Status**: Open  
**Date Reported**: 2025-12-02  
**Reporter**: Development Team  
**Assignee**: Unassigned  

---

## Summary

After clicking on UI elements like chat input, video call controls, or settings panels, the keyboard arrow key movement for the avatar stops working. Users must click back on the game canvas to regain keyboard control, which is not intuitive.

---

## Affected Components

| Component | File Path | Type |
|-----------|-----------|------|
| Space Page | `frontend/src/app/space/[id]/page.tsx` | Frontend |
| Office Space Viewer | `frontend/src/components/OfficeSpaceViewer.tsx` | Frontend |
| Chat Panel | `frontend/src/components/ChatPanel.tsx` | Frontend |

---

## Reproduction Steps

1. Join a space as a user
2. Use arrow keys to move avatar - works correctly
3. Click on the chat input field
4. Type a message and press Enter to send
5. Try to use arrow keys to move avatar
6. Arrow keys don't move avatar anymore!
7. Click on the game area/canvas
8. Arrow keys work again

**Expected Behavior**:  
Arrow keys should continue to move avatar after closing chat input.

**Actual Behavior**:  
Arrow keys stop working until user clicks on the game canvas.

---

## Root Cause Analysis

### Focus Management Issue

When a user interacts with form elements (input, textarea, buttons), browser focus moves to those elements. Keyboard events are then captured by the focused element, not the window/document event listener.

```typescript
// Current implementation
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      // Handle movement
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);

// Problem: When chat input is focused, keydown goes to input, not window
```

### UI Elements Capture Focus

```tsx
// Chat input captures focus and arrow key events
<input
  type="text"
  value={message}
  onChange={(e) => setMessage(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === 'Enter') sendMessage();
    // Arrow keys also captured here!
  }}
/>
```

---

## Solution

### 1. Blur Input After Sending Message

```tsx
// frontend/src/components/ChatPanel.tsx

const ChatPanel = () => {
  const inputRef = useRef<HTMLInputElement>(null);

  const sendMessage = () => {
    if (message.trim()) {
      onSend(message);
      setMessage('');
      // Blur input to return focus to game
      inputRef.current?.blur();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={message}
      onChange={(e) => setMessage(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          sendMessage();
        }
        if (e.key === 'Escape') {
          inputRef.current?.blur();
        }
      }}
    />
  );
};
```

### 2. Implement Focus Tracking

```typescript
// frontend/src/hooks/useFocusTracker.ts

export function useFocusTracker() {
  const [isUIFocused, setIsUIFocused] = useState(false);

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const isFormElement = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;
      
      setIsUIFocused(isFormElement);
    };

    const handleFocusOut = () => {
      // Small delay to handle focus transfer between elements
      setTimeout(() => {
        const active = document.activeElement;
        const isFormElement = 
          active?.tagName === 'INPUT' ||
          active?.tagName === 'TEXTAREA' ||
          active?.tagName === 'SELECT';
        
        setIsUIFocused(!!isFormElement);
      }, 10);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return isUIFocused;
}
```

### 3. Conditionally Handle Keyboard Events

```typescript
// frontend/src/app/space/[id]/page.tsx

const SpacePage = () => {
  const isUIFocused = useFocusTracker();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle movement when UI element is focused
      if (isUIFocused) {
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        handleMovement(e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUIFocused]);

  // Show indicator when controls are disabled
  return (
    <div>
      {isUIFocused && (
        <div className="controls-hint">
          Press Escape or click canvas to enable movement
        </div>
      )}
      {/* ... rest of UI */}
    </div>
  );
};
```

### 4. Add Click Handler to Return Focus

```tsx
// frontend/src/components/OfficeSpaceViewer.tsx

const OfficeSpaceViewer = () => {
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleCanvasClick = () => {
    // Blur any focused input
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    // Focus the canvas container
    canvasRef.current?.focus();
  };

  return (
    <div
      ref={canvasRef}
      tabIndex={0}  // Make div focusable
      onClick={handleCanvasClick}
      className="game-canvas"
      style={{ outline: 'none' }}  // Remove focus outline
    >
      {/* Canvas/game content */}
    </div>
  );
};
```

### 5. Global Escape Key Handler

```typescript
// frontend/src/hooks/useGlobalEscape.ts

export function useGlobalEscape() {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Blur any focused element
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        // Close any open modals/panels
        // Trigger event for components to handle
        window.dispatchEvent(new CustomEvent('global-escape'));
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);
}
```

### 6. Alternative: Use WASD Keys That Don't Conflict

```typescript
// frontend/src/app/space/[id]/page.tsx

const keyToDirection: Record<string, { dx: number; dy: number }> = {
  // Arrow keys
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  // WASD keys (work even when typing if not in input)
  w: { dx: 0, dy: -1 },
  s: { dx: 0, dy: 1 },
  a: { dx: -1, dy: 0 },
  d: { dx: 1, dy: 0 },
};

const handleKeyDown = (e: KeyboardEvent) => {
  // Skip WASD when typing in input
  if (isUIFocused && ['w', 'a', 's', 'd'].includes(e.key.toLowerCase())) {
    return;
  }
  
  const direction = keyToDirection[e.key] || keyToDirection[e.key.toLowerCase()];
  if (direction) {
    if (!isUIFocused) {
      e.preventDefault();
    }
    handleMovement(direction);
  }
};
```

---

## UI Improvements

### Show Control Status

```tsx
// frontend/src/components/ControlsIndicator.tsx

interface Props {
  isEnabled: boolean;
}

const ControlsIndicator: React.FC<Props> = ({ isEnabled }) => {
  if (isEnabled) return null;

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 
                    bg-yellow-500/80 text-black px-4 py-2 rounded-lg 
                    text-sm font-medium z-50">
      ⌨️ Press <kbd className="bg-white/50 px-1 rounded">Esc</kbd> to enable movement
    </div>
  );
};
```

### Add Keyboard Shortcuts Help

```tsx
// frontend/src/components/KeyboardShortcutsHelp.tsx

const KeyboardShortcutsHelp = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>?</button>
      {isOpen && (
        <div className="modal">
          <h3>Keyboard Shortcuts</h3>
          <table>
            <tbody>
              <tr><td>Arrow Keys / WASD</td><td>Move avatar</td></tr>
              <tr><td>Enter</td><td>Open/send chat</td></tr>
              <tr><td>Escape</td><td>Close panels / enable movement</td></tr>
              <tr><td>M</td><td>Toggle mute</td></tr>
              <tr><td>V</td><td>Toggle video</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};
```

---

## Testing

### Test Scenarios

| Action | Expected Result |
|--------|-----------------|
| Move with arrows | Avatar moves |
| Click chat input | Arrows type in input |
| Send message (Enter) | Input clears, arrows move avatar |
| Press Escape | Input blurs, arrows move avatar |
| Click on canvas | Input blurs, arrows move avatar |
| Use WASD while typing | WASD types in input |
| Click video controls | After click, arrows still work |

---

## Prevention

1. **Always blur inputs** after completing their action
2. **Provide Escape key** as universal "return to game"
3. **Visual indicator** when keyboard controls are disabled
4. **Consider gamepad support** which doesn't have focus issues
5. **Test all UI interactions** with keyboard navigation

---

## Related Issues

- **Related Bugs**: BUG-031 (chat steals all keyboard input)
- **Accessibility**: Focus management also affects screen readers
- **Mobile**: Touch controls don't have this issue

---

## Notes

- This is a common issue in browser-based games
- Consider implementing a dedicated "game mode" that captures all input
- Phaser.js has its own input management that may conflict
- Some users prefer leaving cursor in chat while moving with WASD
