"use client";

import { motion } from "framer-motion";
import {
  type Card,
  type CardOption,
  type Cost,
  type Reward,
  type Requirement,
  TOOLS,
} from "@/lib/paleo/cards";
import { type GameState, optionStatus } from "@/lib/engine";
import { HINT_META, RES_META, TRIBE, PAINTING } from "@/lib/paleo/display";

function Chips({ items, sign }: { items: string[]; sign?: "+" | "-" | "" }) {
  if (items.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {items.map((t, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-0.5 rounded-md bg-white/70 px-1.5 py-0.5 text-sm font-bold"
        >
          {sign}
          {t}
        </span>
      ))}
    </span>
  );
}

function costChips(cost?: Cost): string[] {
  if (!cost) return [];
  const out: string[] = [];
  if (cost.wood) out.push(`${cost.wood}${RES_META.wood.emoji}`);
  if (cost.flint) out.push(`${cost.flint}${RES_META.flint.emoji}`);
  if (cost.food) out.push(`${cost.food}${RES_META.food.emoji}`);
  if (cost.ideas) out.push(`${cost.ideas}${RES_META.ideas.emoji}`);
  return out;
}

function rewardChips(reward?: Reward): string[] {
  if (!reward) return [];
  const out: string[] = [];
  if (reward.wood) out.push(`${reward.wood}${RES_META.wood.emoji}`);
  if (reward.flint) out.push(`${reward.flint}${RES_META.flint.emoji}`);
  if (reward.food) out.push(`${reward.food}${RES_META.food.emoji}`);
  if (reward.ideas) out.push(`${reward.ideas}${RES_META.ideas.emoji}`);
  if (reward.tribe) out.push(`${reward.tribe}${TRIBE}`);
  if (reward.painting) out.push(`${reward.painting}${PAINTING}`);
  if (reward.tools) for (const t of reward.tools) out.push(`${TOOLS[t].emoji}${TOOLS[t].name}`);
  return out;
}

function reqChips(req?: Requirement): string[] {
  if (!req) return [];
  const out: string[] = [];
  if (req.tools) for (const t of req.tools) out.push(`${TOOLS[t].emoji}`);
  if (req.people) out.push(`${req.people}${TRIBE}`);
  return out;
}

/**
 * A revealed card with its options. Interactive on the active player's phone
 * (resolve / give up); read-only when shown on the host board.
 */
export default function CardView({
  card,
  state,
  onResolve,
  onGiveUp,
  interactive = false,
}: {
  card: Card;
  state: GameState;
  onResolve?: (optionIndex: number) => void;
  onGiveUp?: () => void;
  interactive?: boolean;
}) {
  const meta = HINT_META[card.hint];
  return (
    <motion.div
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      data-testid="card-view"
      className="card-pop w-full max-w-md overflow-hidden p-0"
    >
      <div
        className="flex items-center gap-2 px-4 py-2 text-white"
        style={{ backgroundColor: meta.color }}
      >
        <span className="text-2xl" aria-hidden>
          {meta.emoji}
        </span>
        <h3 className="text-stroke text-xl font-extrabold">{card.title}</h3>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm font-semibold italic text-[var(--color-stone-700)]">
          {card.text}
        </p>

        <div className="flex flex-col gap-2">
          {card.options.map((opt: CardOption, i) => {
            const st = optionStatus(state, card, opt);
            const fight = opt.fight != null;
            return (
              <button
                key={i}
                data-testid="option"
                data-playable={st.playable ? "1" : "0"}
                disabled={!interactive || !st.playable}
                onClick={() => onResolve?.(i)}
                className={`flex w-full flex-col gap-1 rounded-2xl border-4 border-[var(--color-ink)] px-3 py-2 text-left transition ${
                  st.playable
                    ? "bg-[var(--color-clay-100)] active:translate-y-1"
                    : "cursor-not-allowed bg-[var(--color-stone-300)]/30 opacity-70"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-extrabold">{opt.label}</span>
                  {fight && (
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-sm font-extrabold text-white ${
                        st.fightWinnable ? "bg-[var(--color-moss-500)]" : "bg-[var(--color-ember)]"
                      }`}
                    >
                      ⚔️ {opt.fight}
                    </span>
                  )}
                </span>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  {reqChips(opt.requires).length > 0 && (
                    <span className="text-[var(--color-stone-700)]">
                      nodig <Chips items={reqChips(opt.requires)} sign="" />
                    </span>
                  )}
                  {costChips(opt.cost).length > 0 && (
                    <span className="text-[var(--color-ember-dark)]">
                      <Chips items={costChips(opt.cost)} sign="-" />
                    </span>
                  )}
                  {rewardChips(opt.reward).length > 0 && (
                    <span className="text-[var(--color-moss-600)]">
                      <Chips items={rewardChips(opt.reward)} sign="+" />
                    </span>
                  )}
                </span>
                {interactive && !st.playable && st.reason && (
                  <span className="text-xs font-bold text-[var(--color-ember-dark)]">
                    {st.reason}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {interactive && onGiveUp && (
          <button
            onClick={onGiveUp}
            className="self-end text-sm font-bold text-[var(--color-stone-700)] underline"
          >
            {card.giveUpSkulls ? `Laat lopen (${card.giveUpSkulls} 💀)` : "Sla over"}
          </button>
        )}
      </div>
    </motion.div>
  );
}
