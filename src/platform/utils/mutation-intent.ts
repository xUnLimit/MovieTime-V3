// An intent belongs to a submitted form, not to an individual HTTP attempt.
// A separate intent allows an intentional second operation with identical data.
export function createMutationIntent() {
  const keys = new Map<string, string>();
  return {
    keyFor(input: unknown): string {
      const fingerprint = JSON.stringify(input);
      let key = keys.get(fingerprint);
      if (!key) {
        key = crypto.randomUUID();
        keys.set(fingerprint, key);
      }
      return key;
    },
  };
}
