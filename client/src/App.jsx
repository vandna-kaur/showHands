import { useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'

async function api(path, method = 'GET', body) {
  const r = await fetch('/api' + path, { method, body: body && JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || 'Something went wrong.')
  return d
}

function Home() {
  const [q, setQ] = useState('')
  const [opts, setOpts] = useState(['', ''])
  const [join, setJoin] = useState('')
  const [err, setErr] = useState('')
  const setOpt = (i, v) => setOpts(opts.map((o, j) => (j === i ? v : o)))

  const create = async e => {
    e.preventDefault(); setErr('')
    try {
      const d = await api('/polls', 'POST', { question: q, options: opts })
      localStorage.setItem('host:' + d.code, d.hostKey)
      location.hash = '/p/' + d.code
    } catch (x) { setErr(x.message) }
  }
  const go = e => { e.preventDefault(); if (join.trim()) location.hash = '/p/' + join.trim().toUpperCase() }

  return (
    <main className="home">
      <h1>Raise<br />your<br />hands.</h1>
      <div className="stack">
        <form onSubmit={go} className="join">
          <input value={join} onChange={e => setJoin(e.target.value)} placeholder="Have a code? Type it" maxLength={5} aria-label="Poll code" />
          <button className="solid">Join poll</button>
        </form>
        <form onSubmit={create} className="make">
          <h2>Ask the room</h2>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="What do you want to ask?" maxLength={140} required />
          {opts.map((o, i) => (
            <input key={i} value={o} onChange={e => setOpt(i, e.target.value)} placeholder={`Option ${i + 1}`} maxLength={60} />
          ))}
          {opts.length < 6 && <button type="button" className="ghost" onClick={() => setOpts([...opts, ''])}>Add another option</button>}
          {err && <p className="err" role="alert">{err}</p>}
          <button className="solid">Start poll</button>
        </form>
      </div>
    </main>
  )
}

function PollView({ code }) {
  const [p, setP] = useState(null)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  const [voted, setVoted] = useState(localStorage.getItem('voted:' + code))
  const hostKey = localStorage.getItem('host:' + code)
  const voterId = useMemo(() => {
    let v = localStorage.getItem('voter')
    if (!v) { v = crypto.randomUUID(); localStorage.setItem('voter', v) }
    return v
  }, [])

  useEffect(() => {
    api('/polls/' + code).then(setP).catch(e => setErr(e.message))
    const s = io()
    s.on('connect', () => s.emit('join', code))
    s.on('poll', setP)
    return () => s.disconnect()
  }, [code])

  const vote = async i => {
    try { await api(`/polls/${code}/vote`, 'POST', { option: i, voterId }); localStorage.setItem('voted:' + code, i); setVoted(String(i)) }
    catch (x) { setErr(x.message) }
  }
  const close = () => api(`/polls/${code}/close`, 'POST', { hostKey }).catch(x => setErr(x.message))
  const copy = async () => { await navigator.clipboard.writeText(location.href); setCopied(true); setTimeout(() => setCopied(false), 1500) }

  if (!p) return <main className="poll"><p>{err || 'Loading poll…'}</p><a href="#/">Back home</a></main>
  const show = voted !== null || p.closed
  const max = Math.max(...p.options.map(o => o.votes))

  return (
    <main className="poll">
      <a href="#/" className="back">Showhands</a>
      <p className="code" aria-label={'Poll code ' + code}>{code}</p>
      <h1>{p.question}</h1>
      <div className="opts">
        {p.options.map((o, i) => {
          const pct = p.total ? Math.round((o.votes / p.total) * 100) : 0
          return (
            <button key={i} disabled={show} onClick={() => vote(i)}
              className={'opt' + (show && max > 0 && o.votes === max ? ' lead' : '') + (String(i) === voted ? ' mine' : '')}
              style={{ '--p': show ? pct + '%' : '0%' }}>
              <span>{o.text}{String(i) === voted && ' (your vote)'}</span>
              {show && <b>{pct}%</b>}
            </button>
          )
        })}
      </div>
      <p className="meta">{p.total} {p.total === 1 ? 'vote' : 'votes'} so far{p.closed && ' · voting closed'}</p>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="actions">
        <button className="ghost" onClick={copy}>{copied ? 'Link copied' : 'Copy invite link'}</button>
        {hostKey && !p.closed && <button className="solid" onClick={close}>Close voting</button>}
      </div>
    </main>
  )
}

export default function App() {
  const [h, setH] = useState(location.hash)
  useEffect(() => { const f = () => setH(location.hash); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  const m = h.match(/^#\/p\/([A-Za-z0-9]+)/)
  return m ? <PollView key={m[1]} code={m[1].toUpperCase()} /> : <Home />
}
