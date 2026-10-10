/** Structural browser contract also compiles in the Node-only authority build. */
export interface BrowserLocks {
  request<T>(name:string,work:()=>Promise<T>):Promise<T>;
}
export function browserLocks():BrowserLocks|undefined {
  return (globalThis as unknown as {navigator?:{locks?:BrowserLocks}}).navigator?.locks;
}
