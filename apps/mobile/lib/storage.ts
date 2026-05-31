import { Platform } from "react-native";

export const TOKEN_KEY = "tarea_token";
export const ROLE_KEY  = "tarea_role";

async function secureGet(key: string): Promise<string | null> {
  const { getItemAsync } = await import("expo-secure-store");
  return getItemAsync(key);
}
async function secureSet(key: string, value: string): Promise<void> {
  const { setItemAsync } = await import("expo-secure-store");
  return setItemAsync(key, value);
}
async function secureDelete(key: string): Promise<void> {
  const { deleteItemAsync } = await import("expo-secure-store");
  return deleteItemAsync(key);
}

export const saveToken = (token: string) =>
  Platform.OS === "web" ? Promise.resolve(localStorage.setItem(TOKEN_KEY, token)) : secureSet(TOKEN_KEY, token);

export const getToken = () =>
  Platform.OS === "web" ? Promise.resolve(localStorage.getItem(TOKEN_KEY)) : secureGet(TOKEN_KEY);

export const saveRole = (role: string) =>
  Platform.OS === "web" ? Promise.resolve(localStorage.setItem(ROLE_KEY, role)) : secureSet(ROLE_KEY, role);

export const getRole = () =>
  Platform.OS === "web" ? Promise.resolve(localStorage.getItem(ROLE_KEY)) : secureGet(ROLE_KEY);

export const clearAuth = async () => {
  if (Platform.OS === "web") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
  } else {
    await secureDelete(TOKEN_KEY);
    await secureDelete(ROLE_KEY);
  }
};
