// analytics.js
// The SINGLE choke point for product events in this app.
// Every click handler in app.js calls track(eventName, props) instead of
// talking to an analytics vendor directly. Today this just logs and queues
// in memory. Later, swap the body of track() to call Umami (or anything
// else) and no other file needs to change.
//
// Rule: never pass personal data (raw search text, names, emails, etc.)
// in `props`. Counts and ids only.

const queue = [];

/**
 * @param {string} eventName  short, snake_case event name
 * @param {object} [props]    small, non-personal metadata about the event
 */
export function track(eventName, props = {}) {
  const event = { eventName, props, ts: Date.now() };
  queue.push(event);
  console.log("[analytics]", eventName, props);
}
