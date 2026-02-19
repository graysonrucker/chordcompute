import VoicingCard from "./VoicingCard";

export default function VoicingResults({ results, loading, error }) {
  if (loading) return <div className="mt-6 text-slate-300">Generating…</div>;
  if (error) return <div className="mt-6 text-red-300">{error}</div>;
  if (!results) return null;

  const voicings = Array.isArray(results.voicings) ? results.voicings : [];

  return (
    <div className="mt-6">
      <div className="text-slate-300">
        Found{" "}
        <span className="text-slate-100 font-semibold">{results.totalFound}</span>{" "}
        (showing {voicings.length})
        {results.truncatedBecauseComboCap ? (
          <span className="text-amber-300"> — truncated</span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {voicings
          .filter((v) => Array.isArray(v.notes) && v.notes.length)
          .map((v, i) => (
            <VoicingCard key={i} voicing={v} index={i} />
          ))}
      </div>
    </div>
  );
}