export const workerPort = 4318;
export const workerUrl = `http://127.0.0.1:${workerPort}`;

export function isLoopbackHost(host: string | null | undefined) {
  return /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host ?? "");
}
