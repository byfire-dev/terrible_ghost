export function weaponArt(weapon) {
  const colors = ["#fff7a6", "#9fe6ff", "#b8ff9f", "#72b9ff", "#ff8a3d", "#7ee9ff", "#5cc7ff", "#f0c453", "#76f7ff"];
  const glow = weapon.color || colors[Math.min(colors.length - 1, weapon.level - 1)];
  const hot = weapon.level >= 8 ? "#fff1a8" : "#fff7d1";
  const body = weapon.level >= 7 ? "#17233a" : weapon.level >= 4 ? "#202d43" : "#303845";
  const metal = weapon.level >= 6 ? "#d8edf4" : "#aeb8bc";
  const grip = "#0a0f15";
  const tier = Math.min(1, weapon.level / 24);
  const auraOpacity = 0.22 + tier * 0.32;
  const shapes = {
    pistol: `<rect x="35" y="50" width="66" height="19" rx="5" fill="url(#b)" stroke="${glow}" stroke-width="3"/><rect x="96" y="54" width="40" height="7" rx="2" fill="${metal}"/><rect x="128" y="52" width="21" height="11" rx="2" fill="${glow}"/><path d="M64 68 L83 68 L76 96 L54 96 Z" fill="${grip}" stroke="${glow}" stroke-width="2"/><rect x="51" y="44" width="34" height="6" rx="2" fill="${metal}"/><circle cx="90" cy="72" r="5" fill="${hot}"/>`,
    rifle: `<path d="M16 59 L45 43 H70 V76 H41 L16 68 Z" fill="${grip}" stroke="${glow}" stroke-width="2"/><rect x="55" y="47" width="89" height="24" rx="5" fill="url(#b)" stroke="${glow}" stroke-width="3"/><rect x="123" y="52" width="49" height="8" rx="2" fill="${metal}"/><rect x="82" y="35" width="41" height="8" rx="2" fill="${metal}"/><path d="M89 69 H110 L103 97 H80 Z" fill="${grip}" stroke="${glow}" stroke-width="1.5"/><rect x="64" y="74" width="40" height="8" fill="#070b0e"/><path d="M145 56 L172 49 L151 64 Z" fill="${hot}" opacity=".72"/>`,
    crossbow: `<rect x="34" y="55" width="96" height="13" rx="5" fill="url(#b)" stroke="${glow}" stroke-width="3"/><path d="M88 20 C41 30 39 91 88 100 M88 20 C137 30 139 91 88 100" fill="none" stroke="${metal}" stroke-width="6"/><path d="M37 62 H167" stroke="${glow}" stroke-width="3"/><path d="M148 62 L120 49 V75 Z" fill="${hot}"/><path d="M74 68 L96 68 L89 96 H65 Z" fill="${grip}" stroke="${glow}" stroke-width="1.6"/>`,
    shotgun: `<path d="M16 60 L49 45 H78 V76 H43 L16 69 Z" fill="${grip}" stroke="${glow}" stroke-width="2"/><rect x="61" y="48" width="75" height="26" rx="6" fill="url(#b)" stroke="${glow}" stroke-width="3"/><rect x="103" y="47" width="67" height="7" rx="3" fill="${metal}"/><rect x="103" y="63" width="67" height="7" rx="3" fill="${metal}"/><path d="M80 71 H103 L96 98 H73 Z" fill="${grip}" stroke="${glow}" stroke-width="1.5"/><path d="M137 58 L172 46 L150 72 Z" fill="${hot}" opacity=".62"/>`,
    flame: `<rect x="27" y="50" width="97" height="26" rx="8" fill="url(#b)" stroke="${glow}" stroke-width="3"/><rect x="113" y="54" width="36" height="13" rx="4" fill="${metal}"/><path d="M143 61 C153 30 178 45 162 74 C156 60 151 83 137 71 C145 66 140 64 143 61 Z" fill="${glow}"/><path d="M154 59 C163 42 174 54 164 70 C162 60 157 73 151 67 Z" fill="${hot}"/><circle cx="82" cy="63" r="11" fill="#ffcf7a"/><path d="M67 72 H90 L83 98 H61 Z" fill="${grip}" stroke="${glow}" stroke-width="1.6"/>`,
    ice: `<rect x="27" y="50" width="98" height="26" rx="6" fill="url(#b)" stroke="${glow}" stroke-width="3"/><path d="M120 63 L146 34 L168 63 L146 93 Z" fill="${glow}" opacity=".82"/><path d="M139 63 H174 M151 49 L168 32 M151 77 L168 94" stroke="#e8fbff" stroke-width="4" stroke-linecap="round"/><path d="M67 72 H90 L83 98 H61 Z" fill="${grip}" stroke="${glow}" stroke-width="1.6"/>`,
    laser: `<path d="M16 59 L43 44 H68 V76 H39 L16 68 Z" fill="${grip}" stroke="${glow}" stroke-width="2"/><rect x="53" y="47" width="75" height="27" rx="6" fill="url(#b)" stroke="${glow}" stroke-width="3"/><circle cx="111" cy="60" r="15" fill="${glow}" opacity=".9"/><circle cx="111" cy="60" r="7" fill="${hot}"/><rect x="124" y="55" width="50" height="9" rx="3" fill="${metal}"/><rect x="73" y="36" width="44" height="8" rx="2" fill="${metal}"/><path d="M77 70 H100 L93 98 H71 Z" fill="${grip}" stroke="${glow}" stroke-width="1.5"/>`,
    cannon: `<path d="M16 64 L50 43 H84 V84 H45 L16 73 Z" fill="${grip}" stroke="${glow}" stroke-width="2"/><rect x="71" y="42" width="94" height="37" rx="11" fill="url(#b)" stroke="${glow}" stroke-width="4"/><rect x="123" y="50" width="47" height="19" rx="7" fill="${metal}"/><circle cx="63" cy="63" r="14" fill="${glow}"/><circle cx="63" cy="63" r="7" fill="${hot}"/><path d="M89 78 H114 L106 101 H81 Z" fill="${grip}" stroke="${glow}" stroke-width="1.8"/>`,
    storm: `<path d="M16 59 L46 42 H76 V79 H41 L16 70 Z" fill="${grip}" stroke="${glow}" stroke-width="2"/><rect x="59" y="46" width="79" height="30" rx="8" fill="url(#b)" stroke="${glow}" stroke-width="3"/><rect x="127" y="53" width="44" height="11" rx="4" fill="${metal}"/><path d="M116 60 C128 31 158 32 168 54 C151 54 156 74 132 78 C139 65 124 69 116 60 Z" fill="${glow}" opacity=".95"/><path d="M91 37 L77 61 H100 L84 89" fill="none" stroke="#eef6ee" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  };
  const shape = shapes[weapon.type] || shapes.pistol;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 110">
      <defs>
        <filter id="g"><feGaussianBlur stdDeviation="5"/></filter>
        <filter id="s" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="${glow}" flood-opacity=".7"/>
          <feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#000000" flood-opacity=".55"/>
        </filter>
        <linearGradient id="b" x1="0" x2="1">
          <stop offset="0" stop-color="${body}"/>
          <stop offset="1" stop-color="#0f141b"/>
        </linearGradient>
        <radialGradient id="a" cx="74%" cy="54%" r="60%">
          <stop offset="0" stop-color="${hot}" stop-opacity=".9"/>
          <stop offset=".35" stop-color="${glow}" stop-opacity=".48"/>
          <stop offset="1" stop-color="${glow}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="180" height="110" rx="12" fill="#050a0d"/>
      <rect width="180" height="110" rx="12" fill="url(#a)" opacity="${auraOpacity}"/>
      <path d="M15 60 L119 31 L172 50 L129 82 L34 81 Z" fill="${glow}" opacity=".3" filter="url(#g)"/>
      <path d="M12 28 C54 20 97 18 162 29 M19 91 C67 79 115 85 169 72" fill="none" stroke="${glow}" stroke-width="1.4" opacity=".32"/>
      <g filter="url(#s)">${shape}</g>
      <path d="M130 54 L178 43 L143 68 Z" fill="${hot}" opacity=".3" filter="url(#g)"/>
      <text x="16" y="27" fill="${glow}" font-size="20" font-weight="900" font-family="Arial">LV.${weapon.level}</text>
      <text x="164" y="98" fill="${hot}" font-size="12" font-weight="900" text-anchor="end" font-family="Arial">DMG ${weapon.damage}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function ammoArt(level) {
  const glow = ["#f0c453", "#5cc7ff", "#7ee9ff", "#8effc1", "#ff8a3d"][level % 5];
  const hot = level >= 8 ? "#fff1a8" : "#fff7d1";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 110">
      <defs>
        <filter id="g"><feGaussianBlur stdDeviation="5"/></filter>
        <filter id="s" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="${glow}" flood-opacity=".7"/>
          <feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#000000" flood-opacity=".55"/>
        </filter>
        <linearGradient id="c" x1="0" x2="1">
          <stop offset="0" stop-color="${hot}"/>
          <stop offset=".55" stop-color="#f0c453"/>
          <stop offset="1" stop-color="#9b5c20"/>
        </linearGradient>
        <radialGradient id="a" cx="68%" cy="54%" r="68%">
          <stop offset="0" stop-color="${hot}" stop-opacity=".82"/>
          <stop offset=".36" stop-color="${glow}" stop-opacity=".5"/>
          <stop offset="1" stop-color="${glow}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="180" height="110" rx="12" fill="#050a0d"/>
      <rect width="180" height="110" rx="12" fill="url(#a)" opacity=".72"/>
      <path d="M24 73 C56 21 126 20 158 72" fill="none" stroke="${glow}" stroke-width="18" opacity=".24" filter="url(#g)"/>
      <path d="M18 82 L168 30 M28 95 L155 55 M34 26 L165 74" stroke="${glow}" stroke-width="1.3" opacity=".26"/>
      <g filter="url(#s)">
        <rect x="34" y="47" width="27" height="43" rx="6" fill="url(#c)" stroke="${glow}" stroke-width="2"/>
        <rect x="72" y="33" width="29" height="58" rx="6" fill="url(#c)" stroke="${glow}" stroke-width="2"/>
        <rect x="111" y="43" width="27" height="48" rx="6" fill="url(#c)" stroke="${glow}" stroke-width="2"/>
        <path d="M47.5 27 L34 48 H62 Z M86.5 13 L72 34 H101 Z M124.5 23 L111 44 H138 Z" fill="#eef6ee"/>
        <path d="M52 50 H58 M90 37 H97 M129 47 H135" stroke="#fff7d1" stroke-width="3" stroke-linecap="round"/>
      </g>
      <path d="M105 51 L174 30 L126 70 Z" fill="${hot}" opacity=".3" filter="url(#g)"/>
      <text x="16" y="27" fill="${glow}" font-size="20" font-weight="900" font-family="Arial">AMMO ${level}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
