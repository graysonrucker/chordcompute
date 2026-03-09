export default function InfoPage() {
  return (
    <div className="w-full px-2 sm:px-4 md:px-6 py-10">
      <div style={{ maxWidth: "640px" }}>
        <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">
          About <span className="text-cyan-400">ChordCompute</span>
        </h1>

        <p className="mt-4 text-slate-300 leading-relaxed">
          ChordCompute generates voicings for a given set of pitch classes across
          a keyboard range. Select notes on the piano, choose your range, and hit
          Generate to explore how those notes can be voiced.
        </p>

        {/* ── Generation ─────────────────────────────── */}

        <h2 className="mt-8 text-lg font-semibold text-slate-100">
          How generation works
        </h2>
        <p className="mt-3 text-slate-300 leading-relaxed">
          The engine distributes your selected pitch classes across the MIDI range
          you specify, subject to one key constraint: the multiplicity of each
          pitch class is preserved. That is, every generated voicing contains
          exactly as many instances of each pitch class as you selected.
        </p>
        <p className="mt-3 text-slate-300 leading-relaxed">
          For example, if you select a C major triad (C, E, G — one of each),
          every returned voicing will contain exactly one C, one E, and one G,
          placed at various octaves within the range. If you were to select two
          C's, an E, and a G, the voicings would each contain exactly two C's,
          one E, and one G.
        </p>
        <p className="mt-3 text-slate-300 leading-relaxed">
          Results are paged so you can browse through large sets of voicings
          without lag. Voicing cards are automatically shifted to center around
          the middle of the keyboard for readability.
        </p>

        {/* ── Piano interaction ──────────────────────── */}

        <h2 className="mt-8 text-lg font-semibold text-slate-100">
          Piano interaction
        </h2>
        <p className="mt-3 text-slate-300 leading-relaxed">
          Click individual keys to toggle notes on and off. You can also click
          and drag across the keyboard to select multiple notes in a single
          gesture — like a glissando. The base keyboard spans two octaves
          (C3–B4) and can be expanded in either direction using the ＋/−
          controls on each side.
        </p>

        {/* ── Chord detection ────────────────────────── */}

        <h2 className="mt-8 text-lg font-semibold text-slate-100">
          Chord detection
        </h2>
        <p className="mt-3 text-slate-300 leading-relaxed">
          ChordCompute detects and displays a chord name automatically as you
          select notes.  A single note displays its name and octave (e.g. C4).
          Two notes display the interval between them (e.g. minor 3rd: C → E♭).
          Three or more notes are identified using a heuristic algorithm that
          tries every pitch class as a potential root, matches against a library
          of chord templates, and scores each interpretation — the name with the
          fewest extensions wins. By default, the lowest selected note is assumed as the root of the chord,
          when this setting is disabled, the winner is displayed as the current chord's name.
        </p>
        <p className="mt-3 text-slate-400 text-sm leading-relaxed" style={{ borderLeft: "2px solid rgba(6,182,212,0.4)", paddingLeft: "12px" }}>
          Chord naming and the detection algorithm are still under active development. Some unusual or slightly inaccurate
          results are to be expected, particularly with heavily extended or
          altered chords. If a name looks off, the chord template drawer will
          always display the exact name you intended.
        </p>

        {/* ── Chord templates ────────────────────────── */}

        <h2 className="mt-8 text-lg font-semibold text-slate-100">
          Chord templates
        </h2>
        <p className="mt-3 text-slate-300 leading-relaxed">
          The Template button opens a drawer where you can build a chord by
          selecting a root note, quality (major, minor, diminished, augmented,
          sus2, sus4), seventh type, extensions (9th, 11th, 13th), alterations
          (♭5, ♯5, ♭9, ♯9, ♯11, ♭13), and omissions (no3, no5). Clicking
          "Apply to Piano" places the chord on the keyboard in canonical tertian
          voicing.
        </p>

        {/* ── Playback ───────────────────────────────── */}

        <h2 className="mt-8 text-lg font-semibold text-slate-100">
          Playback
        </h2>
        <p className="mt-3 text-slate-300 leading-relaxed">
          Press the Play button to hear the currently selected notes as an
          arpeggio — notes are sounded from bottom to top, then sustained
          together. Each voicing card also has its own play button so you can
          audition individual voicings directly.
        </p>
        <p className="mt-3 text-slate-300 leading-relaxed">
          By default, playback uses Salamander Grand Piano samples. You can
          switch to a synthesizer sound in the Settings menu (gear icon). Piano
          samples are loaded on startup; a brief loading indicator appears until
          they're ready.
        </p>

        {/* ── Settings ───────────────────────────────── */}

        <h2 className="mt-8 text-lg font-semibold text-slate-100">
          Settings
        </h2>
        <p className="mt-3 text-slate-300 leading-relaxed">
          Open the settings drawer via the gear icon in the top-right corner.
          Available options:
        </p>
        <ul className="mt-3 text-slate-300 leading-relaxed space-y-2" style={{ listStyleType: "disc", paddingLeft: "20px" }}>
          <li>
            <strong className="text-slate-200">Playback sound</strong> — choose
            between Piano (Salamander Grand samples) and Synth.
          </li>
          <li>
            <strong className="text-slate-200">Assume bottom note as root</strong> — when
            enabled, chord detection only considers the lowest selected note as
            the root rather than trying all pitch classes. Enabled by default.
          </li>
        </ul>

        {/* ── Things to know ─────────────────────────── */}

        <h2 className="mt-8 text-lg font-semibold text-slate-100">
          Things to know
        </h2>
        <ul className="mt-3 text-slate-300 leading-relaxed space-y-3" style={{ listStyleType: "disc", paddingLeft: "20px" }}>
          <li>
            The active range of the interactive piano is the range that returned
            voicings will fall within. Wider ranges increase total voicings
            dramatically — and generation times along with them.
          </li>
          <li>
            Voicing count grows combinatorially. A simple triad over two octaves
            might produce a handful of results, but the same triad over five
            octaves can yield thousands. Adding even one more pitch class
            multiplies the count further.  With all 
            pitch classes selected, approximately 28 billion voicings can be
            generated. At these scales, generation is computationally expensive
            and may take significant time or be halted by the server to protect
            resources — keeping the range narrow and the pitch class count
            reasonable will produce results much faster.
          </li>
          <li>
            Voicing cards are display-shifted to center on the keyboard for
            readability. The octave numbers shown on a card may differ from what
            you selected, but the intervals between notes are always preserved.
          </li>
          <li>
            Chord templates place notes in tertian stacking from the root, thirds stacked upward. 
            This is just one canonical starting voicing for that
            chord.
          </li>
          <li>
            When "assume bottom note as root" is enabled, the detected chord name
            can change just by reordering the same set of pitch classes. The same
            notes with C on the bottom versus E on the bottom may produce
            different names.
          </li>
        </ul>
      </div>
    </div>
  );
}