export function weaponArt(weapon) {
  const colors = ["#d7d2c2", "#9fe6ff", "#b8ff9f", "#72b9ff", "#ff8a3d", "#7ee9ff", "#5cc7ff", "#f0c453", "#76f7ff"];
  const glow = weapon.color || colors[Math.min(colors.length - 1, weapon.level - 1)];
  const body = weapon.level >= 4 ? "#23304a" : "#343941";
  const metal = "#9aa2a7";
  const grip = "#171b22";
  const shapes = {
    pistol: `<rect x="38" y="50" width="62" height="20" rx="5" fill="url(#b)" stroke="${glow}" stroke-width="3"/><rect x="94" y="54" width="38" height="8" rx="2" fill="${metal}"/><path d="M64 68 L80 68 L74 93 L54 93 Z" fill="${grip}" stroke="${glow}" stroke-width="2"/><rect x="52" y="45" width="30" height="6" rx="2" fill="${metal}"/><circle cx="90" cy="72" r="5" fill="${glow}"/>`,
    rifle: `<path d="M18 58 L44 45 H68 V74 H42 L18 67 Z" fill="${grip}"/><rect x="56" y="48" width="84" height="22" rx="4" fill="url(#b)" stroke="${glow}" stroke-width="3"/><rect x="124" y="53" width="46" height="8" rx="2" fill="${metal}"/><rect x="82" y="37" width="38" height="7" rx="2" fill="${metal}"/><path d="M88 69 H107 L101 94 H82 Z" fill="${grip}"/><rect x="64" y="74" width="38" height="8" fill="#101417"/>`,
    crossbow: `<rect x="36" y="56" width="92" height="12" rx="4" fill="url(#b)" stroke="${glow}" stroke-width="3"/><path d="M88 23 C44 31 43 89 88 98 M88 23 C134 31 135 89 88 98" fill="none" stroke="${metal}" stroke-width="6"/><path d="M38 62 H164" stroke="${glow}" stroke-width="3"/><path d="M144 62 L122 51 V73 Z" fill="${glow}"/><path d="M74 67 L94 67 L88 92 H66 Z" fill="${grip}"/>`,
    shotgun: `<path d="M18 59 L48 46 H76 V74 H44 L18 68 Z" fill="${grip}"/><rect x="62" y="49" width="72" height="24" rx="5" fill="url(#b)" stroke="${glow}" stroke-width="3"/><rect x="104" y="48" width="64" height="7" rx="3" fill="${metal}"/><rect x="104" y="62" width="64" height="7" rx="3" fill="${metal}"/><path d="M79 70 H100 L94 94 H74 Z" fill="${grip}"/>`,
    flame: `<rect x="28" y="51" width="94" height="24" rx="7" fill="url(#b)" stroke="${glow}" stroke-width="3"/><rect x="113" y="55" width="34" height="12" rx="4" fill="${metal}"/><path d="M143 61 C153 34 176 48 160 73 C156 60 150 80 138 70 C144 65 141 64 143 61 Z" fill="${glow}"/><circle cx="83" cy="63" r="10" fill="#ffcf7a"/><path d="M67 72 H88 L82 94 H62 Z" fill="${grip}"/>`,
    ice: `<rect x="28" y="51" width="96" height="24" rx="5" fill="url(#b)" stroke="${glow}" stroke-width="3"/><path d="M121 63 L146 36 L166 63 L146 90 Z" fill="${glow}" opacity=".78"/><path d="M139 63 H172 M151 49 L166 35 M151 77 L166 91" stroke="#e8fbff" stroke-width="4" stroke-linecap="round"/><path d="M67 72 H88 L82 94 H62 Z" fill="${grip}"/>`,
    laser: `<path d="M18 59 L42 46 H66 V74 H40 L18 68 Z" fill="${grip}"/><rect x="54" y="48" width="72" height="25" rx="5" fill="url(#b)" stroke="${glow}" stroke-width="3"/><circle cx="112" cy="60" r="14" fill="${glow}" opacity=".85"/><rect x="124" y="56" width="47" height="8" rx="3" fill="${metal}"/><rect x="74" y="37" width="42" height="7" rx="2" fill="${metal}"/><path d="M77 70 H98 L92 94 H72 Z" fill="${grip}"/>`,
    cannon: `<path d="M18 63 L50 45 H82 V82 H46 L18 72 Z" fill="${grip}"/><rect x="72" y="43" width="92" height="35" rx="10" fill="url(#b)" stroke="${glow}" stroke-width="4"/><rect x="124" y="51" width="45" height="18" rx="6" fill="${metal}"/><circle cx="63" cy="63" r="13" fill="${glow}"/><path d="M88 78 H112 L105 98 H82 Z" fill="${grip}"/>`,
    storm: `<path d="M18 59 L46 43 H74 V78 H42 L18 70 Z" fill="${grip}"/><rect x="60" y="47" width="76" height="28" rx="7" fill="url(#b)" stroke="${glow}" stroke-width="3"/><rect x="126" y="54" width="42" height="10" rx="4" fill="${metal}"/><path d="M116 60 C128 34 156 34 166 54 C150 54 154 72 132 76 C138 64 124 68 116 60 Z" fill="${glow}" opacity=".9"/><path d="M91 39 L78 61 H99 L84 86" fill="none" stroke="#eef6ee" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  };
  const shape = shapes[weapon.type] || shapes.pistol;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 110">
      <defs>
        <filter id="g"><feGaussianBlur stdDeviation="5"/></filter>
        <linearGradient id="b" x1="0" x2="1">
          <stop offset="0" stop-color="${body}"/>
          <stop offset="1" stop-color="#0f141b"/>
        </linearGradient>
      </defs>
      <rect width="180" height="110" rx="12" fill="#0b1114"/>
      <path d="M18 58 L128 34 L166 54 L130 80 L36 78 Z" fill="${glow}" opacity=".28" filter="url(#g)"/>
      ${shape}
      <text x="18" y="28" fill="${glow}" font-size="20" font-weight="900" font-family="Arial">LV.${weapon.level}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function ammoArt(level) {
  const glow = ["#f0c453", "#5cc7ff", "#7ee9ff", "#8effc1", "#ff8a3d"][level % 5];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 110">
      <defs>
        <filter id="g"><feGaussianBlur stdDeviation="5"/></filter>
        <linearGradient id="c" x1="0" x2="1">
          <stop offset="0" stop-color="#f6d36a"/>
          <stop offset="1" stop-color="#9b5c20"/>
        </linearGradient>
      </defs>
      <rect width="180" height="110" rx="12" fill="#0b1114"/>
      <path d="M28 70 C58 26 124 24 154 70" fill="none" stroke="${glow}" stroke-width="16" opacity=".22" filter="url(#g)"/>
      <rect x="35" y="46" width="26" height="42" rx="5" fill="url(#c)" stroke="${glow}" stroke-width="2"/>
      <rect x="71" y="34" width="26" height="54" rx="5" fill="url(#c)" stroke="${glow}" stroke-width="2"/>
      <rect x="107" y="42" width="26" height="46" rx="5" fill="url(#c)" stroke="${glow}" stroke-width="2"/>
      <path d="M48 28 L36 47 H60 Z M84 16 L72 35 H96 Z M120 24 L108 43 H132 Z" fill="#d8e8e1"/>
      <text x="18" y="28" fill="${glow}" font-size="20" font-weight="900" font-family="Arial">AMMO ${level}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
