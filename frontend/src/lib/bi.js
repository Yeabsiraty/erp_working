import { getEthLang } from "./ethiopian.js";

/** bi("አማርኛ", "English") — አሁን ባለው ቋንቋ ያለውን ይመልሳል */
export const bi = (am, en) => (getEthLang() === "en" ? en : am);