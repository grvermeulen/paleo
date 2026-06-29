import { describe, it, expect } from "vitest";
import {
  reduce,
  createLobbyState,
  optionStatus,
  weaponStrength,
  makeInstances,
  dealDecks,
  isDayOver,
  type GameState,
} from "./engine";
import { getCard } from "./paleo/cards";

/** Build a started game with explicit per-player decks (deterministic). */
function startGame(decks: string[][]): GameState {
  let s = createLobbyState();
  s = {
    ...s,
    players: decks.map((_, i) => ({
      id: `p${i}`,
      name: `P${i}`,
      deck: [],
      active: null,
    })),
  };
  return reduce(s, { type: "START", decks });
}

describe("setup", () => {
  it("START deals decks and enters day 1", () => {
    const s = startGame([["vlakte#0", "rivier#1"], ["hert#2"]]);
    expect(s.status).toBe("playing");
    expect(s.phase).toBe("day");
    expect(s.day).toBe(1);
    expect(s.players[0].deck).toEqual(["vlakte#0", "rivier#1"]);
    expect(s.players[1].deck).toEqual(["hert#2"]);
    // first-light starting kit
    expect(s.stock).toMatchObject({ wood: 2, flint: 2, food: 3, ideas: 0 });
    expect(s.tribe).toBe(2);
    expect(s.paintingGoal).toBe(5);
    expect(s.skullLimit).toBe(5);
  });

  it("makeInstances are unique; dealDecks splits evenly", () => {
    const inst = makeInstances(["a", "a", "b"]);
    expect(new Set(inst).size).toBe(3);
    const decks = dealDecks(["a#0", "b#1", "c#2", "d#3"], 2, () => 0);
    expect(decks.length).toBe(2);
    expect(decks[0].length + decks[1].length).toBe(4);
  });
});

describe("gathering & crafting", () => {
  it("gathers wood", () => {
    let s = startGame([["vlakte#0", "rivier#1"]]);
    s = reduce(s, { type: "PICK", playerId: "p0", cardId: "vlakte#0" });
    expect(s.players[0].active).toBe("vlakte#0");
    s = reduce(s, { type: "RESOLVE", playerId: "p0", optionIndex: 0 });
    expect(s.stock.wood).toBe(4);
    expect(s.players[0].active).toBeNull();
  });

  it("crafting a tool needs an idea, then grants the tool", () => {
    let s = startGame([["maak-speer#0", "vlakte#1"]]);
    s = reduce(s, { type: "PICK", playerId: "p0", cardId: "maak-speer#0" });
    const card = getCard("maak-speer");
    // ideas == 0 → not playable yet
    expect(optionStatus(s, card, card.options[0]).playable).toBe(false);
    s = { ...s, stock: { ...s.stock, ideas: 1 } };
    expect(optionStatus(s, card, card.options[0]).playable).toBe(true);
    s = reduce(s, { type: "RESOLVE", playerId: "p0", optionIndex: 0 });
    expect(s.tools).toContain("speer");
    expect(weaponStrength(s)).toBe(2);
    expect(s.stock).toMatchObject({ wood: 1, flint: 1, ideas: 0 });
  });

  it("hides a craft option once the tool is owned", () => {
    let s = startGame([["maak-knots#0"]]);
    s = { ...s, tools: ["knots"] };
    const card = getCard("maak-knots");
    expect(optionStatus(s, card, card.options[0]).playable).toBe(false);
  });
});

describe("hunting / fights", () => {
  it("a fight with too little strength wounds the tribe (skulls)", () => {
    let s = startGame([["hert#0", "vlakte#1"]]);
    s = reduce(s, { type: "PICK", playerId: "p0", cardId: "hert#0" });
    s = reduce(s, { type: "RESOLVE", playerId: "p0", optionIndex: 0 });
    expect(s.skulls).toBe(2); // fight 2 vs strength 0
    expect(s.stock.food).toBe(3); // no reward on a failed hunt
  });

  it("a fight with enough strength succeeds and rewards", () => {
    let s = startGame([["hert#0", "vlakte#1"]]);
    s = { ...s, tools: ["speer"] };
    s = reduce(s, { type: "PICK", playerId: "p0", cardId: "hert#0" });
    s = reduce(s, { type: "RESOLVE", playerId: "p0", optionIndex: 0 });
    expect(s.skulls).toBe(0);
    expect(s.stock.food).toBe(6); // +3
  });
});

describe("hunting mini-game (RESOLVE_HUNT)", () => {
  // The mini-game decides win/lose on the phone; the reducer trusts the outcome.
  it("a carried win grants the reward even with no weapons (skill overrides)", () => {
    let s = startGame([["hert#0", "vlakte#1"]]);
    s = reduce(s, { type: "PICK", playerId: "p0", cardId: "hert#0" });
    expect(weaponStrength(s)).toBe(0); // would lose the deterministic check
    s = reduce(s, { type: "RESOLVE_HUNT", playerId: "p0", optionIndex: 0, outcome: "win" });
    expect(s.skulls).toBe(0);
    expect(s.stock.food).toBe(6); // +3 reward
    expect(s.players[0].active).toBeNull();
    expect(s.lastEvent?.kind).toBe("hunt");
  });

  it("a mammoth win paints the wall (extra card keeps it in the day phase)", () => {
    let s = startGame([["mammoet#0", "vlakte#1"]]); // tribe 2 meets the gate
    s = reduce(s, { type: "PICK", playerId: "p0", cardId: "mammoet#0" });
    s = reduce(s, { type: "RESOLVE_HUNT", playerId: "p0", optionIndex: 0, outcome: "win" });
    expect(s.painting).toBe(1); // +1 painting
    expect(s.stock.food).toBe(7); // +4 food
    expect(s.lastEvent?.kind).toBe("paint");
    expect(s.phase).toBe("day"); // vlakte#1 still in deck → no night yet
  });

  it("a winning hunt that fills the wall finishes the game", () => {
    let s = startGame([["mammoet#0"]]);
    s = { ...s, painting: 4 }; // one piece from victory
    s = reduce(s, { type: "PICK", playerId: "p0", cardId: "mammoet#0" });
    s = reduce(s, { type: "RESOLVE_HUNT", playerId: "p0", optionIndex: 0, outcome: "win" });
    expect(s.painting).toBe(5);
    expect(s.phase).toBe("won");
    expect(s.status).toBe("finished");
  });

  it("a carried loss adds skulls equal to the strength deficit", () => {
    let s = startGame([["zwijn#0", "vlakte#1"]]); // fight 3, extra card avoids night
    s = reduce(s, { type: "PICK", playerId: "p0", cardId: "zwijn#0" });
    s = reduce(s, { type: "RESOLVE_HUNT", playerId: "p0", optionIndex: 0, outcome: "lose" });
    expect(s.skulls).toBe(3); // max(1, 3 - 0)
    expect(s.stock.food).toBe(3); // no reward
    expect(s.lastEvent?.kind).toBe("fail");
  });

  it("a fumbled-but-strong hunt still costs at least one skull (the floor)", () => {
    let s = startGame([["hert#0", "vlakte#1"]]); // fight 2
    s = { ...s, tools: ["speer"] }; // strength 2 >= 2 → raw deficit would be 0
    s = reduce(s, { type: "PICK", playerId: "p0", cardId: "hert#0" });
    s = reduce(s, { type: "RESOLVE_HUNT", playerId: "p0", optionIndex: 0, outcome: "lose" });
    expect(s.skulls).toBe(1); // max(1, 2 - 2)
  });

  it("is idempotent: re-applying after the card is consumed is a no-op", () => {
    let s = startGame([["hert#0", "vlakte#1"]]);
    s = reduce(s, { type: "PICK", playerId: "p0", cardId: "hert#0" });
    const once = reduce(s, { type: "RESOLVE_HUNT", playerId: "p0", optionIndex: 0, outcome: "win" });
    const twice = reduce(once, { type: "RESOLVE_HUNT", playerId: "p0", optionIndex: 0, outcome: "win" });
    expect(twice).toBe(once);
  });

  it("guards an illegal outcome and a non-fight option", () => {
    let s = startGame([["hert#0"]]);
    s = reduce(s, { type: "PICK", playerId: "p0", cardId: "hert#0" });
    // @ts-expect-error — exercising the runtime guard against a bad outcome
    expect(reduce(s, { type: "RESOLVE_HUNT", playerId: "p0", optionIndex: 0, outcome: "draw" })).toBe(s);

    let g = startGame([["vlakte#0"]]); // a gather card has no fight option
    g = reduce(g, { type: "PICK", playerId: "p0", cardId: "vlakte#0" });
    expect(reduce(g, { type: "RESOLVE_HUNT", playerId: "p0", optionIndex: 0, outcome: "win" })).toBe(g);
  });
});

describe("painting & win", () => {
  it("painting needs a torch", () => {
    let s = startGame([["rotswand#0"]]);
    s = reduce(s, { type: "PICK", playerId: "p0", cardId: "rotswand#0" });
    const card = getCard("rotswand");
    const st = optionStatus(s, card, card.options[0]);
    expect(st.playable).toBe(false);
    expect(st.reason.toLowerCase()).toContain("fakkel");
  });

  it("reaching the painting goal wins the game", () => {
    let s = startGame([["rotswand#0"]]);
    s = { ...s, painting: 4, tools: ["fakkel"], stock: { ...s.stock, flint: 2 } };
    s = reduce(s, { type: "PICK", playerId: "p0", cardId: "rotswand#0" });
    s = reduce(s, { type: "RESOLVE", playerId: "p0", optionIndex: 0 });
    expect(s.painting).toBe(5);
    expect(s.phase).toBe("won");
    expect(s.status).toBe("finished");
  });
});

describe("danger & loss", () => {
  it("giving up a danger card costs a skull and can end the game", () => {
    let s = startGame([["wolven#0"]]);
    s = { ...s, skulls: 4 };
    s = reduce(s, { type: "PICK", playerId: "p0", cardId: "wolven#0" });
    s = reduce(s, { type: "GIVE_UP", playerId: "p0" });
    expect(s.skulls).toBe(5);
    expect(s.phase).toBe("lost");
    expect(s.status).toBe("finished");
  });
});

describe("night cycle", () => {
  it("feeds the tribe and advances to night when decks empty", () => {
    let s = startGame([["vlakte#0"]]);
    s = reduce(s, { type: "PICK", playerId: "p0", cardId: "vlakte#0" });
    s = reduce(s, { type: "RESOLVE", playerId: "p0", optionIndex: 0 }); // wood, no food
    expect(s.phase).toBe("night");
    expect(s.stock.food).toBe(1); // 3 - tribe(2)
    expect(s.skulls).toBe(0);
    // new day deals fresh decks
    s = reduce(s, { type: "ADVANCE_NIGHT", decks: [["vlakte#0"]] });
    expect(s.phase).toBe("day");
    expect(s.day).toBe(2);
    expect(s.players[0].deck).toEqual(["vlakte#0"]);
  });

  it("underfeeding the tribe causes skulls", () => {
    let s = startGame([["vlakte#0"]]);
    s = { ...s, stock: { ...s.stock, food: 1 } };
    s = reduce(s, { type: "PICK", playerId: "p0", cardId: "vlakte#0" });
    s = reduce(s, { type: "RESOLVE", playerId: "p0", optionIndex: 0 });
    expect(s.skulls).toBe(1); // tribe 2, only 1 food
    expect(s.stock.food).toBe(0);
  });

  it("night cards are set aside and resolved at night", () => {
    let s = startGame([["kampvuur#0"]]);
    s = reduce(s, { type: "PICK", playerId: "p0", cardId: "kampvuur#0" });
    // set aside, no active, deck empty → night
    expect(s.phase).toBe("night");
    expect(s.stock.ideas).toBe(1); // kampvuur grants an idea at night
  });
});

describe("guards & idempotency", () => {
  it("RESOLVE without an active card is a no-op", () => {
    const s = startGame([["vlakte#0"]]);
    expect(reduce(s, { type: "RESOLVE", playerId: "p0", optionIndex: 0 })).toBe(s);
  });

  it("a second PICK while holding a card is ignored", () => {
    let s = startGame([["vlakte#0", "rivier#1"]]);
    s = reduce(s, { type: "PICK", playerId: "p0", cardId: "vlakte#0" });
    const again = reduce(s, { type: "PICK", playerId: "p0", cardId: "rivier#1" });
    expect(again).toBe(s);
  });

  it("isDayOver only when all decks empty and no active card", () => {
    let s = startGame([["vlakte#0"], ["rivier#1"]]);
    expect(isDayOver(s)).toBe(false);
    s = reduce(s, { type: "PICK", playerId: "p0", cardId: "vlakte#0" });
    expect(isDayOver(s)).toBe(false);
  });
});
