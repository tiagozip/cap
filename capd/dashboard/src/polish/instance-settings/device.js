const BROWSERS = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Windows/, "Windows"],
  [/Linux/, "Linux"],
];

export const device = ({ ua, browser: b, os } = {}) => {
  if (typeof ua !== "string") ua = "";
  const browser = b || BROWSERS.find(([re]) => re.test(ua))?.[1];
  const system = os || SYSTEMS.find(([re]) => re.test(ua))?.[1];
  if (!browser && !system) return null;
  return {
    name: browser && system ? `${browser} on ${system}` : browser || system,
    phone:
      /Mobi|iPhone|Android(?!.*Tablet)/.test(ua) && !/iPad/.test(ua)
        ? true
        : /^(iOS|iPhone|Android)$/.test(system),
  };
};
