import { useEffect, useState } from 'react'
import {
  FileText, Sheet, Image as ImageIcon, File,
  ChevronDown, ChevronRight, FolderOpen, Folder,
  Download, ExternalLink, Lock,
} from 'lucide-react'
import { useIsAdmin } from '../store/useAuthStore'

interface FileEntry { name: string; size: number }
type ArchiveTree = Record<string, FileEntry[]>

const EXT_GROUPS = {
  pdf:    ['.pdf'],
  image:  ['.jpg', '.jpeg', '.png', '.gif'],
  excel:  ['.xls', '.xlsx', '.xlsm', '.xlk'],
  word:   ['.doc', '.docx'],
  text:   ['.txt'],
}

function extOf(name: string) {
  return name.slice(name.lastIndexOf('.')).toLowerCase()
}

function isViewable(name: string) {
  const ext = extOf(name)
  return [...EXT_GROUPS.pdf, ...EXT_GROUPS.image, ...EXT_GROUPS.text].includes(ext)
}

function FileIcon({ name }: { name: string }) {
  const ext = extOf(name)
  if (EXT_GROUPS.pdf.includes(ext))
    return <FileText size={14} className="text-red-500 shrink-0" />
  if (EXT_GROUPS.excel.includes(ext))
    return <Sheet size={14} className="text-green-600 shrink-0" />
  if (EXT_GROUPS.word.includes(ext))
    return <FileText size={14} className="text-blue-600 shrink-0" />
  if (EXT_GROUPS.image.includes(ext))
    return <ImageIcon size={14} className="text-purple-500 shrink-0" />
  return <File size={14} className="text-gray-400 shrink-0" />
}

function ExtBadge({ name }: { name: string }) {
  const ext = extOf(name).replace('.', '').toUpperCase()
  const colors: Record<string, string> = {
    PDF:  'bg-red-100 text-red-700',
    XLS:  'bg-green-100 text-green-700',
    XLSX: 'bg-green-100 text-green-700',
    XLSM: 'bg-green-100 text-green-700',
    XLK:  'bg-green-100 text-green-700',
    DOC:  'bg-blue-100 text-blue-700',
    DOCX: 'bg-blue-100 text-blue-700',
    JPG:  'bg-purple-100 text-purple-700',
    JPEG: 'bg-purple-100 text-purple-700',
    PNG:  'bg-purple-100 text-purple-700',
    GIF:  'bg-purple-100 text-purple-700',
    TXT:  'bg-gray-100 text-gray-600',
    MSG:  'bg-orange-100 text-orange-700',
  }
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colors[ext] ?? 'bg-gray-100 text-gray-500'}`}>
      {ext}
    </span>
  )
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileUrl(year: string, name: string) {
  return `/api/history-file/${year}/${encodeURIComponent(name)}`
}

// ── Year section ──────────────────────────────────────────────────────────────

function YearSection({
  year, files, defaultOpen, filter,
}: {
  year: string
  files: FileEntry[]
  defaultOpen: boolean
  filter: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  const filtered = filter
    ? files.filter(f => f.name.toLowerCase().includes(filter.toLowerCase()))
    : files

  if (filter && filtered.length === 0) return null

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-masters-light hover:bg-masters-green/10 transition-colors text-left"
      >
        {open
          ? <FolderOpen size={15} className="text-masters-gold shrink-0" />
          : <Folder    size={15} className="text-masters-gold shrink-0" />}
        <span className="font-serif font-bold text-masters-dark text-sm">{year}</span>
        <span className="text-xs text-gray-400 ml-1">
          {filtered.length} {filtered.length === 1 ? 'file' : 'files'}
          {filter && files.length !== filtered.length && ` (of ${files.length})`}
        </span>
        <span className="ml-auto">
          {open ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
        </span>
      </button>

      {open && (
        <ul className="divide-y divide-gray-100">
          {filtered.map(f => (
            <li key={f.name} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 group">
              <FileIcon name={f.name} />
              <span className="flex-1 text-xs text-gray-700 font-medium truncate" title={f.name}>
                {f.name}
              </span>
              <span className="text-[10px] text-gray-400 tabular-nums shrink-0">{fmtSize(f.size)}</span>
              <ExtBadge name={f.name} />
              {isViewable(f.name) ? (
                <a
                  href={fileUrl(year, f.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in browser"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-masters-green hover:text-masters-dark"
                >
                  <ExternalLink size={13} />
                </a>
              ) : (
                <a
                  href={fileUrl(year, f.name)}
                  download={f.name}
                  title="Download"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-masters-green hover:text-masters-dark"
                >
                  <Download size={13} />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FileArchive() {
  const isAdmin = useIsAdmin()
  const [tree,    setTree]    = useState<ArchiveTree | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [filter,  setFilter]  = useState('')
  const [allOpen, setAllOpen] = useState(false)
  const [key,     setKey]     = useState(0)

  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/history-files')
      .then(r => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json() as Promise<ArchiveTree>
      })
      .then(setTree)
      .catch(e => setError(String(e)))
  }, [isAdmin])

  function toggleAll(open: boolean) {
    setAllOpen(open)
    setKey(k => k + 1)
  }

  const years      = tree ? Object.keys(tree).sort().reverse() : []
  const totalFiles = tree ? Object.values(tree).reduce((s, f) => s + f.length, 0) : 0

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-serif font-bold text-masters-dark">Archive</h1>
        <div className="card text-center py-12">
          <Lock size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-semibold">Admin access required</p>
          <p className="text-sm text-gray-400 mt-1">Sign in as admin to view the archive.</p>
        </div>
      </div>
    )
  }

  if (error) {
    const isNotFound = error.includes('404') || error.includes('Not Found')
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-serif font-bold text-masters-dark">Archive</h1>
        <div className="card text-center py-12">
          <p className="text-red-500 font-semibold">Could not load archive</p>
          {isNotFound ? (
            <p className="text-sm text-gray-400 mt-2">
              The archive is only available when running locally.<br />
              Run <code className="bg-gray-100 px-1 rounded">npm run dev</code> from the <code className="bg-gray-100 px-1 rounded">jugger-app/</code> directory.
            </p>
          ) : (
            <p className="text-sm text-gray-400 mt-1">Error: {error}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-masters-dark">Archive</h1>
          {tree && (
            <p className="text-sm text-gray-500 mt-0.5">
              {totalFiles} files across {years.length} years — from JuggerHistory
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost text-xs" onClick={() => toggleAll(true)}>Expand all</button>
          <button className="btn-ghost text-xs" onClick={() => toggleAll(false)}>Collapse all</button>
        </div>
      </div>

      {/* Search */}
      <input
        className="input"
        placeholder="Filter files by name…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><FileText size={12} className="text-red-500" /> PDF — opens in browser</span>
        <span className="flex items-center gap-1"><FileText size={12} className="text-blue-600" /> Word — downloads</span>
        <span className="flex items-center gap-1"><Sheet size={12} className="text-green-600" /> Excel — downloads</span>
        <span className="flex items-center gap-1"><ImageIcon size={12} className="text-purple-500" /> Images — opens in browser</span>
      </div>

      {!tree ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-11 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {years.map(year => (
            <YearSection
              key={`${year}-${key}`}
              year={year}
              files={tree[year]}
              defaultOpen={allOpen || year === years[0]}
              filter={filter}
            />
          ))}
        </div>
      )}
    </div>
  )
}
