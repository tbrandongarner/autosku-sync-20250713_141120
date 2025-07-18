export function useAuthenticatedFetch() {
  return async function authenticatedFetch(input: RequestInfo, init?: RequestInit) {
    return fetch(input, init)
  }
}
