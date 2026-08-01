import React from "react";
import { Stack } from "expo-router";
import { C } from "@/constants/colors";

// Cap font scaling app-wide so a large iOS "Text Size"/accessibility setting can't
// blow up the tightly-designed layouts. In RN 0.81 + React 19, Text/TextInput are
// plain function components: defaultProps is ignored and there's no forwardRef
// .render to patch. Import-interop can also copy `react-native` exports by value,
// so patching the module surface is unreliable. Instead patch React 19's automatic
// JSX runtime (every JSX element flows through jsx/jsxs): match the real Text/
// TextInput component by function identity and inject a maxFontSizeMultiplier cap.
// A component that sets its own maxFontSizeMultiplier still wins.
const CAP = 1.15;
(() => {
  try {
    const RN = require("react-native");
    const CAPPED = new Set<any>([RN.Text, RN.TextInput]);
    const patch = (runtime: any) => {
      if (!runtime) return;
      (["jsx", "jsxs"] as const).forEach((key) => {
        const orig = runtime[key];
        if (typeof orig !== "function" || orig.__capped) return;
        const wrapped = function (type: any, props: any, ...rest: any[]) {
          if (CAPPED.has(type) && props && props.maxFontSizeMultiplier == null) {
            props = { ...props, maxFontSizeMultiplier: CAP };
          }
          return orig(type, props, ...rest);
        };
        (wrapped as any).__capped = true;
        try { runtime[key] = wrapped; }
        catch { Object.defineProperty(runtime, key, { configurable: true, value: wrapped }); }
      });
    };
    patch(require("react/jsx-runtime"));
    try { patch(require("react/jsx-dev-runtime")); } catch { /* not bundled in release */ }
  } catch { /* best-effort */ }
})();

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: C.ink },
        animation: "none",
      }}
    />
  );
}
