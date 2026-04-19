const DEFAULT_FIREBASE_TEST_HINT =
  'Development: add numbers under Firebase Authentication → Phone → Phone numbers for testing; enter the matching test code from the console (no SMS).';


export function getFirebaseTestPhoneHint(): string | undefined {
  if (!import.meta.env.DEV) return undefined;
  return DEFAULT_FIREBASE_TEST_HINT;
}
