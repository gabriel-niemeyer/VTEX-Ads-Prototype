import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const RECENT_KEY = 'aiw-comment-emoji-recent';

export type EmojiCategoryId =
  | 'recent'
  | 'smileys'
  | 'nature'
  | 'food'
  | 'activity'
  | 'travel'
  | 'objects'
  | 'symbols'
  | 'flags';

type CategoryDef = {
  id: EmojiCategoryId;
  label: string;
  icon: string;
  emojis: string[];
};

const CAT_SMILEYS: string[] = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '☺️', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
  '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄',
];

const CAT_NATURE: string[] = [
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦤', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔',
  '🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃', '🍄', '🐚', '🌾', '💐', '🌸', '💮', '🪷', '🏵️', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷', '🪻', '⚘️', '🌱', '🪴', '🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃',
];

const CAT_FOOD: string[] = [
  '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏', '🍐', '🍑', '🍒', '🍓', '🫐', '🥝', '🍅', '🫒', '🥥', '🥑', '🍆', '🥔', '🥕', '🌽', '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥜', '🫘', '🌰', '🍞', '🥐', '🥖', '🫓', '🥨', '🥯', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫔', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🍼', '🥛', '☕', '🫖', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🥤', '🧋', '🧃', '🧉', '🧊',
];

const CAT_ACTIVITY: string[] = [
  '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🪂', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺', '⛹️', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚴', '🚵', '🎪', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩',
];

const CAT_TRAVEL: string[] = [
  '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '🪝', '⛽', '🚧', '🚦', '🚥', '🛑', '🚏', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🕍', '🛕',
];

const CAT_OBJECTS: string[] = [
  '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🪠', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪥', '🪒', '🧴', '🧷', '🧹', '🪣', '🧽', '🪮', '🪥', '🪒', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🪆', '🖼️', '🪞', '🪟', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🪄', '🪅', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🏷️', '🪧', '📪', '📫', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒️', '🗓️', '📆', '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '📁', '📂', '🗂️', '🗞️', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇️', '📐', '📏', '🧮', '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓',
];

const CAT_SYMBOLS: string[] = [
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '♾️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '🔚', '🔙', '🔛', '🔝', '🔜', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛',
];

const CAT_FLAGS: string[] = [
  '🏳️', '🏴', '🏁', '🚩', '🏳️‍🌈', '🏳️‍⚧️', '🇺🇳', '🇦🇫', '🇦🇱', '🇩🇿', '🇦🇸', '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼', '🇦🇺', '🇦🇹', '🇦🇿', '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪', '🇧🇿', '🇧🇯', '🇧🇲', '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇻🇬', '🇧🇳', '🇧🇬', '🇧🇫', '🇧🇮', '🇨🇻', '🇰🇭', '🇨🇲', '🇨🇦', '🇰🇾', '🇨🇫', '🇹🇩', '🇨🇱', '🇨🇳', '🇨🇴', '🇰🇲', '🇨🇬', '🇨🇩', '🇨🇰', '🇨🇷', '🇭🇷', '🇨🇺', '🇨🇼', '🇨🇾', '🇨🇿', '🇨🇮', '🇩🇰', '🇩🇯', '🇩🇲', '🇩🇴', '🇪🇨', '🇪🇬', '🇸🇻', '🇬🇶', '🇪🇷', '🇪🇪', '🇸🇿', '🇪🇹', '🇪🇺', '🇫🇰', '🇫🇴', '🇫🇯', '🇫🇮', '🇫🇷', '🇬🇫', '🇵🇫', '🇹🇫', '🇬🇦', '🇬🇲', '🇬🇪', '🇩🇪', '🇬🇭', '🇬🇮', '🇬🇷', '🇬🇱', '🇬🇩', '🇬🇵', '🇬🇺', '🇬🇹', '🇬🇬', '🇬🇳', '🇬🇼', '🇬🇾', '🇭🇹', '🇭🇳', '🇭🇰', '🇭🇺', '🇮🇸', '🇮🇳', '🇮🇩', '🇮🇷', '🇮🇶', '🇮🇪', '🇮🇲', '🇮🇱', '🇮🇹', '🇯🇲', '🇯🇵', '🇯🇪', '🇯🇴', '🇰🇿', '🇰🇪', '🇰🇮', '🇽🇰', '🇰🇼', '🇰🇬', '🇱🇦', '🇱🇻', '🇱🇧', '🇱🇸', '🇱🇷', '🇱🇾', '🇱🇮', '🇱🇹', '🇱🇺', '🇲🇴', '🇲🇬', '🇲🇼', '🇲🇾', '🇲🇻', '🇲🇱', '🇲🇹', '🇲🇭', '🇲🇶', '🇲🇷', '🇲🇺', '🇾🇹', '🇲🇽', '🇫🇲', '🇲🇩', '🇲🇨', '🇲🇳', '🇲🇪', '🇲🇸', '🇲🇦', '🇲🇿', '🇲🇲', '🇳🇦', '🇳🇷', '🇳🇵', '🇳🇱', '🇳🇨', '🇳🇿', '🇳🇮', '🇳🇪', '🇳🇬', '🇳🇺', '🇳🇫', '🇰🇵', '🇲🇰', '🇲🇵', '🇳🇴', '🇴🇲', '🇵🇰', '🇵🇼', '🇵🇸', '🇵🇦', '🇵🇬', '🇵🇾', '🇵🇪', '🇵🇭', '🇵🇳', '🇵🇱', '🇵🇹', '🇵🇷', '🇶🇦', '🇷🇪', '🇷🇴', '🇷🇺', '🇷🇼', '🇧🇱', '🇸🇭', '🇰🇳', '🇱🇨', '🇲🇫', '🇵🇲', '🇻🇨', '🇼🇸', '🇸🇲', '🇸🇹', '🇸🇦', '🇸🇳', '🇷🇸', '🇸🇨', '🇸🇱', '🇸🇬', '🇸🇽', '🇸🇰', '🇸🇮', '🇸🇧', '🇸🇴', '🇿🇦', '🇬🇸', '🇰🇷', '🇸🇸', '🇪🇸', '🇱🇰', '🇸🇩', '🇸🇷', '🇸🇯', '🇸🇪', '🇨🇭', '🇸🇾', '🇹🇼', '🇹🇯', '🇹🇿', '🇹🇭', '🇹🇱', '🇹🇬', '🇹🇰', '🇹🇴', '🇹🇹', '🇹🇳', '🇹🇷', '🇹🇲', '🇹🇨', '🇹🇻', '🇻🇮', '🇺🇬', '🇺🇦', '🇦🇪', '🇬🇧', '🇺🇸', '🇺🇾', '🇺🇿', '🇻🇺', '🇻🇦', '🇻🇪', '🇻🇳', '🇼🇫', '🇪🇭', '🇾🇪', '🇿🇲', '🇿🇼', '🏴‍☠️',
];

const ALL_EMOJIS: string[] = [
  ...CAT_SMILEYS,
  ...CAT_NATURE,
  ...CAT_FOOD,
  ...CAT_ACTIVITY,
  ...CAT_TRAVEL,
  ...CAT_OBJECTS,
  ...CAT_SYMBOLS,
  ...CAT_FLAGS,
];

const CATEGORIES: CategoryDef[] = [
  { id: 'recent', label: 'Recentes', icon: 'schedule', emojis: [] },
  { id: 'smileys', label: 'Rostos e pessoas', icon: 'sentiment_satisfied', emojis: CAT_SMILEYS },
  { id: 'nature', label: 'Animais e natureza', icon: 'pets', emojis: CAT_NATURE },
  { id: 'food', label: 'Comida', icon: 'restaurant', emojis: CAT_FOOD },
  { id: 'activity', label: 'Atividades', icon: 'sports_soccer', emojis: CAT_ACTIVITY },
  { id: 'travel', label: 'Viagens', icon: 'flight', emojis: CAT_TRAVEL },
  { id: 'objects', label: 'Objetos', icon: 'inventory_2', emojis: CAT_OBJECTS },
  { id: 'symbols', label: 'Símbolos', icon: 'star', emojis: CAT_SYMBOLS },
  { id: 'flags', label: 'Bandeiras', icon: 'flag', emojis: CAT_FLAGS },
];

function loadRecent(): string[] {
  try {
    const raw = sessionStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is string => typeof e === 'string').slice(0, 32);
  } catch {
    return [];
  }
}

function saveRecent(list: string[]) {
  try {
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 32)));
  } catch {
    /* ignore */
  }
}

function pushRecent(emoji: string) {
  const prev = loadRecent();
  const next = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 32);
  saveRecent(next);
  return next;
}

const SHORTCODE_MAP: Record<string, string> = {
  '👍': ':thumbsup:',
  '👎': ':thumbsdown:',
  '😉': ':wink:',
  '😀': ':smile:',
  '😂': ':joy:',
  '❤️': ':heart:',
  '🔥': ':fire:',
  '✨': ':sparkles:',
  '🎉': ':tada:',
  '👋': ':wave:',
  '🙏': ':pray:',
  '😊': ':blush:',
  '🤔': ':thinking:',
  '😍': ':heart_eyes:',
  '😭': ':sob:',
  '💯': ':100:',
};

function shortcodeFor(emoji: string): string {
  const base = emoji.replace(/\uFE0F/g, '');
  return SHORTCODE_MAP[emoji] ?? SHORTCODE_MAP[base] ?? '';
}

export type EmojiPickerAnchor = { left: number; top: number; width: number; height: number };

type EmojiPickerPopoverProps = {
  open: boolean;
  anchor: EmojiPickerAnchor | null;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  /** z-index acima de menus da thread */
  zIndex?: number;
};

const PICKER_W = 352;
const PICKER_MAX_H = 420;

export const EmojiPickerPopover: React.FC<EmojiPickerPopoverProps> = ({
  open,
  anchor,
  onClose,
  onSelect,
  zIndex = 10090,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<EmojiCategoryId>('recent');
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>(() => loadRecent());
  const [hovered, setHovered] = useState<string | null>(null);
  const [skinIdx, setSkinIdx] = useState(0);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setHovered(null);
      return;
    }
    setRecent(loadRecent());
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const placement = useMemo(() => {
    if (!anchor) return { top: 80, left: 80 };
    const spaceBelow = window.innerHeight - anchor.top - anchor.height - 8;
    const flip = spaceBelow < PICKER_MAX_H && anchor.top > PICKER_MAX_H;
    const left = Math.min(Math.max(8, anchor.left + anchor.width - PICKER_W), window.innerWidth - PICKER_W - 8);
    const top = flip
      ? Math.max(8, anchor.top - PICKER_MAX_H - 8)
      : Math.min(anchor.top + anchor.height + 8, window.innerHeight - PICKER_MAX_H - 8);
    return { top, left };
  }, [anchor]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return ALL_EMOJIS.filter((e) => {
      const sc = shortcodeFor(e).toLowerCase();
      return sc.includes(q);
    });
  }, [query]);

  const tabEmojis = useMemo(() => {
    if (filtered) return filtered;
    if (tab === 'recent') return recent.length ? recent : loadRecent();
    const cat = CATEGORIES.find((c) => c.id === tab);
    return cat?.emojis ?? [];
  }, [tab, recent, filtered]);

  const DEFAULT_FREQ = ['👍', '😊', '😉', '❤️', '🎉', '🔥', '👀', '✨', '🙏'];

  const pick = useCallback(
    (emoji: string) => {
      pushRecent(emoji);
      setRecent(loadRecent());
      onSelect(emoji);
      onClose();
    },
    [onSelect, onClose]
  );

  const previewEmoji = hovered ?? (tabEmojis[0] ?? '😀');
  const previewShort = shortcodeFor(previewEmoji) || '—';

  const skinTones = ['#FFCC22', '#F3C6A5', '#E7B08E', '#D49A6A', '#A67C52', '#6B4F44'];

  if (!open || !anchor) return null;

  return createPortal(
    <div
      ref={rootRef}
      data-comment-thread-portal=""
      role="dialog"
      aria-label="Seletor de emoji"
      className="flex flex-col rounded-2xl border border-[#e2e2e2] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.14)] overflow-hidden"
      style={{
        position: 'fixed',
        zIndex,
        width: PICKER_W,
        maxHeight: PICKER_MAX_H,
        top: placement.top,
        left: placement.left,
      }}
    >
      {/* Categorias */}
      <div className="shrink-0 flex items-center justify-around gap-0.5 px-1 pt-2 pb-0 border-b border-[#f0f0f0]">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setTab(c.id);
              setQuery('');
            }}
            className={`relative flex flex-1 min-w-0 flex-col items-center justify-center py-2 rounded-t-lg transition-colors ${
              tab === c.id && !filtered ? 'text-[#2563eb]' : 'text-[#888] hover:text-[#444]'
            }`}
            title={c.label}
            aria-label={c.label}
            aria-pressed={tab === c.id && !filtered}
          >
            <span className="material-symbols-outlined text-[22px]">{c.icon}</span>
            {tab === c.id && !filtered ? (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[#2563eb]" />
            ) : null}
          </button>
        ))}
      </div>

      {/* Busca */}
      <div className="shrink-0 px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 rounded-lg border-2 border-[#2563eb] bg-white px-2.5 py-1.5 shadow-sm">
          <span className="material-symbols-outlined text-[20px] text-[#888]">search</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar"
            className="min-w-0 flex-1 border-none bg-transparent text-[14px] text-[#1f1f1f] outline-none placeholder:text-[#aaa]"
          />
        </div>
      </div>

      {/* Lista */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 custom-emoji-scroll">
        {filtered ? (
          filtered.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[#999]">Nenhum emoji encontrado.</p>
          ) : (
            <div className="grid grid-cols-9 gap-0.5">
              {filtered.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[22px] leading-none transition-colors hover:bg-[#f0f0f0]"
                  onMouseEnter={() => setHovered(e)}
                  onClick={() => pick(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          )
        ) : tab === 'recent' ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#888] mb-2">Frequentemente usados</p>
            <div className="grid grid-cols-9 gap-0.5 mb-3">
              {(recent.length > 0 ? recent.slice(0, 18) : DEFAULT_FREQ).map((e) => (
                <button
                  key={`freq-${e}`}
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[22px] leading-none transition-colors hover:bg-[#f0f0f0]"
                  onMouseEnter={() => setHovered(e)}
                  onClick={() => pick(e)}
                >
                  {e}
                </button>
              ))}
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#888] mb-2">Rostos e pessoas</p>
            <div className="grid grid-cols-9 gap-0.5">
              {CAT_SMILEYS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[22px] leading-none transition-colors hover:bg-[#f0f0f0]"
                  onMouseEnter={() => setHovered(e)}
                  onClick={() => pick(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#888] mb-2">
              {CATEGORIES.find((c) => c.id === tab)?.label}
            </p>
            <div className="grid grid-cols-9 gap-0.5">
              {tabEmojis.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[22px] leading-none transition-colors hover:bg-[#f0f0f0]"
                  onMouseEnter={() => setHovered(e)}
                  onClick={() => pick(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Rodapé */}
      <div className="shrink-0 flex items-center gap-3 border-t border-[#f0f0f0] bg-white px-3 py-2">
        <span className="text-[28px] leading-none">{previewEmoji}</span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-[#999]">{previewShort}</span>
        <div className="flex items-center gap-1">
          {skinTones.map((bg, i) => (
            <button
              key={bg}
              type="button"
              title="Tom de pele"
              onClick={() => setSkinIdx(i)}
              className={`size-6 shrink-0 rounded-full border border-[#e5e5e5] ${skinIdx === i ? 'ring-2 ring-[#2563eb] ring-offset-1' : ''}`}
              style={{ background: bg }}
            />
          ))}
        </div>
      </div>
      <style>{`
        .custom-emoji-scroll::-webkit-scrollbar { width: 8px; }
        .custom-emoji-scroll::-webkit-scrollbar-thumb { background: #d4d4d4; border-radius: 9999px; }
      `}</style>
    </div>,
    document.body
  );
};
