import * as React from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";

type ApiItem = {
    videoId: string;
    title: string;
    durationSec: number;
    views: number | null;
    publishedAt: string | null;
};

type ApiResponse = {
    playlistId: string;
    playlistTitle: string | null;
    channelTitle: string | null;
    totalVideos: number;
    totalDurationSec: number;
    items: ApiItem[];
};

const qc = new QueryClient();

function parsePlaylistId(input: string) {
    // Accept playlist URL or raw ID
    try {
        const u = new URL(input);
        return u.searchParams.get("list") || input.trim();
    } catch {
        return input.trim();
    }
}

function formatDuration(totalSec: number) {
    const sec = Math.max(0, Math.floor(totalSec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}

function Dashboard() {
    const [text, setText] = React.useState("");
    const [playlistId, setPlaylistId] = React.useState<string | null>(null);
    const [speed, setSpeed] = React.useState(1);

    const q = useQuery({
        queryKey: ["playlist", playlistId],
        enabled: !!playlistId,
        queryFn: async (): Promise<ApiResponse> => {
            const r = await fetch(`/api/playlist?list=${encodeURIComponent(playlistId!)}`);
            if (!r.ok) throw new Error(await r.text());
            return r.json();
        },
        staleTime: 1000 * 60 * 10, // 10 min
    });

    const columns = React.useMemo<ColumnDef<ApiItem>[]>(
        () => [
            { header: "#", cell: (ctx) => ctx.row.index + 1 },
            { header: "Title", accessorKey: "title" },
            {
                header: "Duration",
                accessorKey: "durationSec",
                cell: (ctx) => formatDuration(ctx.getValue<number>()),
            },
            {
                header: "Views",
                accessorKey: "views",
                cell: (ctx) => {
                    const v = ctx.getValue<number | null>();
                    return v == null ? "—" : v.toLocaleString();
                },
            },
            {
                header: "Published",
                accessorKey: "publishedAt",
                cell: (ctx) => {
                    const d = ctx.getValue<string | null>();
                    return d ? new Date(d).toLocaleDateString() : "—";
                },
            },
        ],
        []
    );

    const table = useReactTable({
        data: q.data?.items ?? [],
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    const total = q.data?.totalDurationSec ?? 0;
    const atSpeed = speed > 0 ? total / speed : total;

    return (
        <div className="space-y-4">
            <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(e) => {
                    e.preventDefault();
                    const id = parsePlaylistId(text);
                    setPlaylistId(id || null);
                }}
            >
                <input
                    className="w-full rounded border px-3 py-2"
                    placeholder="Paste playlist URL or ID (…?list=PLxxxx)"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                />
                <button className="rounded border px-3 py-2">Analyze</button>
            </form>

            <div className="flex items-center gap-3">
                <label className="text-sm">Speed</label>
                <select
                    className="rounded border px-2 py-1"
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                >
                    {[0.5, 1, 1.25, 1.5, 1.75, 2].map((v) => (
                        <option key={v} value={v}>
                            {v}x
                        </option>
                    ))}
                </select>
            </div>

            {q.isFetching && <div className="text-sm opacity-80">Loading…</div>}
            {q.error && (
                <pre className="rounded border p-3 text-sm overflow-auto">
                    {String(q.error)}
                </pre>
            )}

            {q.data && (
                <div className="rounded border p-3">
                    <div className="font-semibold">
                        {q.data.playlistTitle ?? q.data.playlistId}
                    </div>
                    <div className="text-sm opacity-80">
                        {q.data.channelTitle ? `Channel: ${q.data.channelTitle} • ` : ""}
                        Videos: {q.data.totalVideos}
                    </div>
                    <div className="mt-2 text-sm">
                        Total: <b>{formatDuration(total)}</b> • At {speed}x:{" "}
                        <b>{formatDuration(atSpeed)}</b>
                    </div>
                </div>
            )}

            <div className="overflow-auto rounded border">
                <table className="min-w-300 w-full text-sm">
                    <thead className="border-b">
                        {table.getHeaderGroups().map((hg) => (
                            <tr key={hg.id}>
                                {hg.headers.map((h) => (
                                    <th key={h.id} className="text-left p-2">
                                        {flexRender(h.column.columnDef.header, h.getContext())}
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                    <tbody>
                        {table.getRowModel().rows.map((r) => (
                            <tr key={r.id} className="border-b">
                                {r.getVisibleCells().map((c) => (
                                    <td key={c.id} className="p-2 align-top">
                                        {flexRender(c.column.columnDef.cell, c.getContext())}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {!table.getRowModel().rows.length && (
                            <tr>
                                <td className="p-3 opacity-70" colSpan={columns.length}>
                                    No data yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function App() {
    return (
        <QueryClientProvider client={qc}>
            <Dashboard />
        </QueryClientProvider>
    );
}