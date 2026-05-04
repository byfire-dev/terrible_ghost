const SCENES = [
  { name: "雾绿森林", ground: "#102018", treeDark: "#1c3829", treeLight: "#274933", trunk: "#102416", light: "rgba(230, 232, 202, 0.06)", weather: "fog", accent: "#d8ead1" },
  { name: "冷月松林", ground: "#101c22", treeDark: "#1d3440", treeLight: "#2b5360", trunk: "#0b2028", light: "rgba(180, 220, 255, 0.07)", weather: "rain", accent: "#9bd6ff" },
  { name: "赤叶荒林", ground: "#211610", treeDark: "#3a2419", treeLight: "#6b2d20", trunk: "#1a0f0a", light: "rgba(255, 180, 120, 0.07)", weather: "embers", accent: "#ff9a5c" },
  { name: "紫雾密林", ground: "#181526", treeDark: "#2a2448", treeLight: "#44336f", trunk: "#100d20", light: "rgba(210, 170, 255, 0.07)", weather: "fog", accent: "#d5a9ff" },
  { name: "灰烬林地", ground: "#1c1d1a", treeDark: "#303229", treeLight: "#4a4c40", trunk: "#11120f", light: "rgba(230, 230, 210, 0.05)", weather: "ash", accent: "#d9d7c6" },
  { name: "蓝苔湿地", ground: "#0d2220", treeDark: "#173b38", treeLight: "#22615a", trunk: "#09201d", light: "rgba(160, 255, 240, 0.06)", weather: "fog", accent: "#78ffe8" },
  { name: "金雾林", ground: "#1f1b0f", treeDark: "#3a3518", treeLight: "#625821", trunk: "#161305", light: "rgba(255, 224, 120, 0.07)", weather: "embers", accent: "#ffe071" },
  { name: "黑杉谷", ground: "#0c1110", treeDark: "#15201d", treeLight: "#26332d", trunk: "#070b0a", light: "rgba(200, 230, 210, 0.045)", weather: "rain", accent: "#b8d3c8" },
  { name: "霜白林", ground: "#182020", treeDark: "#324042", treeLight: "#607276", trunk: "#101718", light: "rgba(235, 255, 255, 0.08)", weather: "snow", accent: "#e8ffff" },
  { name: "毒沼森林", ground: "#101c12", treeDark: "#24351c", treeLight: "#4c6b28", trunk: "#0b1608", light: "rgba(190, 255, 120, 0.06)", weather: "toxic", accent: "#c1ff5f" },
  { name: "暗红林", ground: "#1f1114", treeDark: "#371b23", treeLight: "#5a2230", trunk: "#13080b", light: "rgba(255, 130, 150, 0.06)", weather: "redmoon", accent: "#ff6575" },
  { name: "星光林", ground: "#101827", treeDark: "#1d2a42", treeLight: "#314d7a", trunk: "#0b1220", light: "rgba(170, 210, 255, 0.08)", weather: "snow", accent: "#b7d8ff" },
];

export function sceneForDay(day) {
  const normalizedDay = Math.max(1, Math.min(50, day));
  const index = Math.abs(Math.floor(Math.sin(normalizedDay * 91.73) * 10000)) % SCENES.length;
  return SCENES[index];
}
