export function ProposalCard({ proposal }: { proposal: any }) {
  return (
    <div className="rounded-lg border border-graph-line bg-white p-4">
      <h4 className="font-medium text-sm text-lake-deep mb-2">Proposition</h4>
      <div className="space-y-1 text-xs text-pencil">
        {proposal.operations?.map((op: any, i: number) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-lake-deep" />
            {op.type}: {op.label || op.name}
          </div>
        ))}
      </div>
    </div>
  )
}
