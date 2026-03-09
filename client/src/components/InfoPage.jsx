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

        <h2 className="mt-8 text-lg font-semibold text-slate-100">
          How it works
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

        <h2 className="mt-8 text-lg font-semibold text-slate-100">
          Tips
        </h2>
        <ul className="mt-3 text-slate-300 leading-relaxed space-y-2" style={{ listStyleType: "disc", paddingLeft: "20px" }}>
          <li>Use the ＋/− controls on either side of the piano to expand the range before generating.</li>
          <li>Toggle between sharps (♯) and flats (♭) using the button below the keyboard.</li>
          <li>The chord name is detected automatically when three or more notes are selected.</li>
        </ul>
      </div>
    </div>
  );
}