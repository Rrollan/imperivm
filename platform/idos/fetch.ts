// Umi's node-fetch transport uses the browser's native fetch in the static build.
export default globalThis.fetch.bind(globalThis);
export const {Headers, Request, Response} = globalThis;
