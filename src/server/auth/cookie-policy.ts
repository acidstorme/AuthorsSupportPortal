export function sessionCookieOptions(appUrl: string) {
  return { path: "/", httpOnly: true, sameSite: "lax" as const, secure: new URL(appUrl).protocol === "https:" };
}

export function isSessionCookie(name: string, projectRef: string | undefined) {
  const key = `sb-${projectRef}-auth-token`;
  return name === key || name.startsWith(`${key}.`);
}
