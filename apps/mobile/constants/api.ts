import axios from "axios";
import * as SecureStore from "expo-secure-store";

export const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";

export const api = axios.create({ baseURL: API_BASE, timeout: 10000 });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("tarea_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
