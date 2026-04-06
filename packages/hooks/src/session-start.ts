export {};

console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: "px session initialized",
  },
  systemMessage: "Welcome to px!",
}));
