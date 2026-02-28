"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.swipesBySessionUser = exports.usersBySession = exports.usersById = exports.sessionsByCode = exports.sessionsById = void 0;
exports.getSessionByCode = getSessionByCode;
exports.getUsersInSession = getUsersInSession;
exports.getSwipesForSession = getSwipesForSession;
exports.getSwipesForUser = getSwipesForUser;
// Sessions by internal id (for server use)
exports.sessionsById = new Map();
// Sessions by public join code (uppercase)
exports.sessionsByCode = new Map();
// Users by id
exports.usersById = new Map();
// Users by session (sessionId -> User[])
exports.usersBySession = new Map();
// Swipes: key = `${sessionId}:${userId}`, value = Swipe[] (one per listing)
exports.swipesBySessionUser = new Map();
function getSessionByCode(code) {
    return exports.sessionsByCode.get(code.toUpperCase());
}
function getUsersInSession(sessionId) {
    return exports.usersBySession.get(sessionId) ?? [];
}
function getSwipesForSession(sessionId) {
    const users = getUsersInSession(sessionId);
    const all = [];
    for (const u of users) {
        const key = `${sessionId}:${u.id}`;
        const swipes = exports.swipesBySessionUser.get(key) ?? [];
        all.push(...swipes);
    }
    return all;
}
function getSwipesForUser(sessionId, userId) {
    return exports.swipesBySessionUser.get(`${sessionId}:${userId}`) ?? [];
}
