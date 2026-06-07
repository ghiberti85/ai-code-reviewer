import '@testing-library/jest-dom'

// jsdom does not implement navigator.clipboard — stub it with plain async functions
// so vi.spyOn works correctly in individual test files
const mockClipboard = {
  writeText: async (_text: string) => {},
  readText: async () => '',
}
Object.defineProperty(navigator, 'clipboard', {
  get: () => mockClipboard,
  configurable: true,
})
