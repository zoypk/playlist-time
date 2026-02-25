import autoprefixer from "autoprefixer";
import tailwindcss from "@tailwindcss/postcss";

export default {
  plugins: [
    tailwindcss({
      from: undefined,
    }),
    autoprefixer(),
  ],
};
