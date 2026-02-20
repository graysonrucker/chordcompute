import VoicingCard from "./VoicingCard";

export default function VoicingsResults({ results }) {
  if (!results) return null;

  const voicings = (results.voicings || [])
    .filter((v) => Array.isArray(v.notes) && v.notes.length);

  return (
    <div className="mt-6">
      <div className="text-slate-300">
        Found{" "}
        <span className="text-slate-100 font-semibold">
          {results.totalFound}
        </span>{" "}
        voicings (showing {results.voicings.length})
        {results.truncatedBecauseComboCap && (
          <span className="text-amber-300"> — truncated</span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {voicings.map((v, i) => (
          <VoicingCard key={i} voicing={v} index={i} />
        ))}
      </div>
    </div>
  );
}