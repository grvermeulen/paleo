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
