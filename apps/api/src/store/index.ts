import type { Session, User, Swipe } from "@homeblend/types";

// Sessions by internal id (for server use)
export const sessionsById = new Map<string, Session>();
// Sessions by public join code (uppercase)
export const sessionsByCode = new Map<string, Session>();
// Users by id
export const usersById = new Map<string, User>();
// Users by session (sessionId -> User[])
export const usersBySession = new Map<string, User[]>();
// Swipes: key = `${sessionId}:${userId}`, value = Swipe[] (one per listing)
export const swipesBySessionUser = new Map<string, Swipe[]>();

export function getSessionByCode(code: string): Session | undefined {
  return sessionsByCode.get(code.toUpperCase());
}

export function getUsersInSession(sessionId: string): User[] {
  return usersBySession.get(sessionId) ?? [];
}

export function getSwipesForSession(sessionId: string): Swipe[] {
  const users = getUsersInSession(sessionId);
  const all: Swipe[] = [];
  for (const u of users) {
    const key = `${sessionId}:${u.id}`;
    const swipes = swipesBySessionUser.get(key) ?? [];
    all.push(...swipes);
  }
  return all;
}

export function getSwipesForUser(sessionId: string, userId: string): Swipe[] {
  return swipesBySessionUser.get(`${sessionId}:${userId}`) ?? [];
}
