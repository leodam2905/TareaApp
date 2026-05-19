import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";

export const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";

export const api = axios.create({ baseURL: API_BASE, timeout: 10000 });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("tarea_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync("tarea_token");
      await SecureStore.deleteItemAsync("tarea_role");
      await SecureStore.deleteItemAsync("tarea_user");
      router.replace("/(auth)/login");
    }
    return Promise.reject(error);
  }
);
