// Type declarations for Jest global helpers
declare global {
  var describeIf: (condition: boolean) => typeof describe;
  var itIf: (condition: boolean) => typeof it;
}

export {};
