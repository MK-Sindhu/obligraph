import { Anton } from "next/font/google";

/** Heavy condensed display face, used only for the big title on illustration plates. */
export const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});
