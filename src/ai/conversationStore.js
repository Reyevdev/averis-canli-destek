const store = new Map();

const MAX_HISTORY = 10;

export function getHistory(userId) {
	return store.get(userId) || [];
}

export function addMessage(userId, role, content) {
	const history = store.get(userId) || [];
	history.push({ role, content });

	while (history.length > MAX_HISTORY) {
		history.shift();
	}

	store.set(userId, history);
}

export function clearHistory(userId) {
	store.delete(userId);
}