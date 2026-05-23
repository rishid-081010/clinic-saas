const tokenKey = "authToken";
const staffKey = "activeStaff";

export type AuthUser = {
  id?: string;
  name?: string;
  email: string;
  role: "L2_ADMIN" | "L2_ASSISTANT";
};

export type StaffSession = {
  id?: string;
  label: string;
  email: string;
  avatar: string;
};

const defaultStaff: StaffSession = {
  label: "Admin",
  email: "admin@astergrove.example",
  avatar: "AD",
};

export function readAuthToken() {
  return window.localStorage.getItem(tokenKey);
}

export function writeAuthToken(token: string) {
  window.localStorage.setItem(tokenKey, token);
}

export function hasAuthSession() {
  return Boolean(readAuthToken());
}

export function clearAuthSession() {
  window.localStorage.removeItem(tokenKey);
}

export function readActiveStaff() {
  const stored = window.localStorage.getItem(staffKey);
  if (!stored) return defaultStaff;
  try {
    return { ...defaultStaff, ...JSON.parse(stored) } as StaffSession;
  } catch {
    return defaultStaff;
  }
}

export function writeActiveStaff(staff: StaffSession) {
  window.localStorage.setItem(staffKey, JSON.stringify(staff));
}

export function readSignedInUserId() {
  const staffId = readActiveStaff().id;
  if (staffId) return staffId;

  const token = readAuthToken();
  if (!token) return undefined;
  try {
    const payload = JSON.parse(window.atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { userId?: string };
    return payload.userId;
  } catch {
    return undefined;
  }
}

export function staffFromUser(user: AuthUser): StaffSession {
  const label = user.role === "L2_ADMIN" ? "Admin" : "Assistant";
  const avatar = (user.name || label)
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return { id: user.id, label, email: user.email, avatar: avatar || (user.role === "L2_ADMIN" ? "AD" : "AS") };
}
