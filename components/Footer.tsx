"use client";

import { OPENROUTER_AI_LINK } from "@/lib/constant";

export default function Footer() {
  return (
    <footer className="flex items-center justify-center py-4">
      <a
        href={OPENROUTER_AI_LINK}
        target="_blank"
        className="text-center text-sm text-[#555]"
      >
        Powered by{" "}
        <span className="font-semibold text-blue-600">OpenRouter</span>
      </a>
    </footer>
  );
}
