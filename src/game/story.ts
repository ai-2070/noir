import { CLUES, useGame, type Line } from "./store";

// Cole's narration has no speaker tag; other speakers are named.
const V = "VERA";

export const INTRO: Line[] = [
  { text: "October, 1947. Rain on the glass like it owed somebody money." },
  { text: "Eddie Larkin walked out of this office six nights ago with forty grand that wasn't his. Nobody's seen him since." },
  { text: "The cops say he skipped town. The cops say a lot of things." },
  { text: "Larkin left in a hurry. Hurried men leave things behind. Time to look." },
];

/** One-line inspections. */
const FLAVOR: Record<string, Line[]> = {
  lamp: [{ text: "Green glass shade. Throws just enough light to make the shadows look deliberate." }],
  typewriter: [{ text: "Half a report still in the roller. \"Subject was observed—\" and then nothing. Story of this case." }],
  whiskey: [{ text: "Rye. The bottle's honest about what it is. That makes one of us in here." }],
  phone: [{ text: "Quiet. Even the phone's not talking tonight." }],
  files: [{ text: "Forty years of other people's worst days, filed alphabetically. Larkin's drawer is empty. Somebody cleaned it out." }],
  coatrack: [{ text: "My spare hat. Larkin's scarf. A man doesn't leave his scarf in October unless he's leaving in a hurry — or being hurried." }],
  window: [{ text: "The city, wet and neon. The Hotel Marquis sign has been fighting for its life since the war. It's losing." }],
  window2: [{ text: "Across the street, the Marquis bar is still open. It's always still open." }],
  bookshelf: [{ text: "Law books nobody reads, and a Hammett paperback somebody reads too much." }],
  pinboard: [{ text: "Red string, black pins, a city's worth of maybes. Larkin pinned a new face up there last week and took it down again." }],
  cat: [
    { text: "Ink. Came with the lease. Has opinions about everybody and shares none of them." },
    { text: "He opens one eye. Closes it. Fair enough." },
  ],
  radio: [{ text: "Dorsey, turned low. Turn it up and the neighbours complain. Turn it off and I'd have to think." }],
  door: [{ text: "The hall to the elevator. The elevator's been out since VJ Day. The stairs are the only honest way down." }],
  cooler: [{ text: "The jug glugs like it's got something to confess." }],
  bench: [{ text: "Where clients sit to tell me lies. The upholstery has heard them all." }],
  plant: [{ text: "A fern Vera keeps alive out of pure spite." }],
  umbrella: [{ text: "Somebody's umbrella. It's been here longer than the fern. Nobody's that honest." }],
  trays: [{ text: "Developer, stop bath, fixer. The air smells like vinegar and secrets." }],
  enlarger: [{ text: "Larkin's enlarger. He could pull a face out of a shadow better than anybody I knew." }],
  safelight: [{ text: "Red light. Everything looks like a crime scene in here. Sometimes it is." }],
  sink: [{ text: "A stained sink and a rag that's seen better decades." }],
  shelves: [{ text: "Film, paper, boxes of Larkin's negatives. Every box labelled except the one I'd want." }],
};


function clueCount() {
  return useGame.getState().clues.length;
}

export function interact(id: string) {
  const g = useGame.getState();
  const has = (c: string) => g.clues.includes(c as never);

  switch (id) {
    case "matchbook":
      if (has("matchbook")) return g.say([{ text: "Just ash now. The matchbook's in my pocket." }]);
      return g.say(
        [
          { text: "Larkin's ashtray. Three butts, one still warm enough to remember." },
          { text: "And under it, a matchbook from the Blue Orchid. Two matches gone." },
          { text: "Inside the flap, in pencil: \"Thurs — back room — 2 AM.\" Larkin never smoked." },
        ],
        () => g.addClue("matchbook"),
      );

    case "calendar":
      if (has("calendar")) return g.say([{ text: "October. The fourteenth still circled in red, hard enough to tear the paper." }]);
      return g.say(
        [
          { text: "A girlie calendar from the tire shop on Ninth. October, 1947." },
          { text: "The fourteenth is circled in red ink. Three times. Larkin's hand." },
          { text: "10 · 14 · 47. People pick the numbers that keep them up at night." },
        ],
        () => g.addClue("calendar"),
      );

    case "safe":
      if (has("ledger")) return g.say([{ text: "Empty now, except for petty cash and a smell like old money." }]);
      if (!has("calendar"))
        return g.say([
          { text: "A Mosler, combination dial. Larkin set it. I never asked him what to." },
          { text: "Nobody tells you which questions matter until later." },
        ]);
      return g.say(
        [
          { text: "Ten. Fourteen. Forty-seven. The tumblers fall like they'd been waiting for me." },
          { text: "Under the petty cash, a torn ledger page. Payments to \"R.M.\" every Friday. Big ones. Getting bigger." },
        ],
        () => g.addClue("ledger"),
      );

    case "photo":
      if (has("photo")) return g.say([{ text: "The rest of the roll is rain and parked cars. Larkin knew which one counted." }]);
      return g.say(
        [
          { text: "Larkin's last roll, pegged up to dry. Rain. A parked Packard. Rain again." },
          { text: "Then this: the Blue Orchid's awning. Two men shaking hands. One of them I'd know in the dark." },
          { text: "Councilman Ray Maddox. R.M. Well, well." },
        ],
        () => g.addClue("photo"),
      );

    case "vera": {
      const n = clueCount();
      if (n === 0 && !g.flags.metVera) {
        return g.say(
          [
            { who: V, text: "You look like a man who slept in his coat." },
            { text: "I look like a man who didn't sleep." },
            { who: V, text: "Larkin's things are where he left them. His last roll's still hanging in the darkroom. I didn't have the stomach." },
          ],
          () => g.setFlag("metVera"),
        );
      }
      if (n < CLUES.length) {
        const hint = !has("calendar")
          ? "He set the safe himself. Said he'd never forget the combination. He scribbled on that calendar all month."
          : !has("photo")
            ? "If you want to know what Larkin was looking at, look at what he was developing."
            : !has("matchbook")
              ? "He came in Tuesday smelling like somebody else's cigarettes. Check his ashtray."
              : "The safe, Cole. Whatever he was scared of, he locked it up.";
        return g.say([{ who: V, text: `${n} out of ${CLUES.length}, by the look on your face.` }, { who: V, text: hint }]);
      }
      return g.say([
        { who: V, text: "You've got that look. The one that costs me a week of worrying." },
        { who: V, text: "Go on. And Cole — wear the good hat." },
      ]);
    }

    default: {
      const lines = FLAVOR[id];
      if (lines) g.say(lines);
    }
  }
}

/** Walking down the stairs. Returns true if the case is ready to close. */
export function tryLeave(onBlocked: () => void) {
  const g = useGame.getState();
  if (g.clues.length < CLUES.length) {
    g.say(
      [{ text: `Not yet. Something in this office still has something to say. (${g.clues.length}/${CLUES.length})` }],
      onBlocked,
    );
    return false;
  }
  g.say(
    [
      { text: "A matchbook. A date. A ledger page. A handshake under an awning." },
      { text: "Maddox, the Blue Orchid, Thursday at two. It's Thursday. It's one-fifteen." },
      { text: "I put on my hat and went down into the rain." },
    ],
    () => g.finish(),
  );
  return true;
}
