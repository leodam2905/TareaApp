// Build-time lock on iOS/Android font scaling.
//
// A large "Text Size"/accessibility setting scales every <Text>/<TextInput> up
// with no bound, which overflows the tightly-designed screens. Runtime patches
// don't survive React 19 + RN 0.81 (defaultProps ignored; Text is a plain
// function component) and monkeypatching the JSX runtime is load-order fragile
// in production/OTA bundles. So we inject `allowFontScaling={false}` directly into
// the compiled JSX for every <Text>/<TextInput> element, locking text to its
// designed size on every device regardless of the OS Text Size setting.
//
// Why allowFontScaling=false and not maxFontSizeMultiplier: `adjustsFontSizeToFit`
// IGNORES maxFontSizeMultiplier (it starts from the raw accessibility size, so a
// capped heading still renders full-size). allowFontScaling=false disables scaling
// outright, so adjustsFontSizeToFit can then only shrink-to-fit, never inflate.
//
// Baked into whatever bundle Metro produces (native build OR `eas update`),
// independent of module load order. Elements that already set allowFontScaling
// keep their own value, and the prop is inserted first so a later {...spread} can
// still override it.
const TARGETS = new Set(["Text", "TextInput", "RNText", "RNTextInput"]);
const PROP = "allowFontScaling";

module.exports = function ({ types: t }) {
  return {
    name: "cap-font-scaling",
    visitor: {
      JSXOpeningElement(path) {
        const name = path.node.name;
        if (!t.isJSXIdentifier(name) || !TARGETS.has(name.name)) return;

        const attrs = path.node.attributes;
        const already = attrs.some(
          (a) =>
            t.isJSXAttribute(a) &&
            t.isJSXIdentifier(a.name) &&
            a.name.name === PROP
        );
        if (already) return;

        attrs.unshift(
          t.jsxAttribute(
            t.jsxIdentifier(PROP),
            t.jsxExpressionContainer(t.booleanLiteral(false))
          )
        );
      },
    },
  };
};
