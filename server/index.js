Remove-Item -Recurse -Force server\.git -ErrorAction SilentlyContinue
import 'dotenv/config'
import http from 'http'
import crypto from 'crypto'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import { Server } from 'socket.io'

const Poll = mongoose.model('Poll', new mongoose.Schema({
  code: { type: String, unique: true, index: true },
  question: { type: String, required: true, maxlength: 140 },
  options: [{ _id: false, text: { type: String, maxlength: 60 }, votes: { type: Number, default: 0 } }],
  closed: { type: Boolean, default: false },
  hostKey: String,
  voters: [String],
}, { timestamps: true }))

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const newCode = () => Array.from({ length: 5 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('')
const pub = p => ({ code: p.code, question: p.question, closed: p.closed, total: p.voters.length,
  options: p.options.map(o => ({ text: o.text, votes: o.votes })) })

const app = express()
const server = http.createServer(app)
const io = new Server(server)
io.on('connection', s => s.on('join', c => s.join(String(c).toUpperCase())))
app.use(cors(), express.json())
const wrap = fn => (req, res) => fn(req, res).catch(e => res.status(400).json({ error: e.message }))

app.post('/api/polls', wrap(async (req, res) => {
  const question = String(req.body.question || '').trim()
  const options = (req.body.options || []).map(t => String(t).trim()).filter(Boolean)
  if (!question) throw new Error('Add a question.')
  if (options.length < 2 || options.length > 6) throw new Error('Add between 2 and 6 options.')
  const hostKey = crypto.randomUUID()
  for (let i = 0; i < 5; i++) {            // retry on the rare code collision
    try {
      const p = await Poll.create({ code: newCode(), question, hostKey, options: options.map(text => ({ text })) })
      return res.json({ code: p.code, hostKey })
    } catch (e) { if (e.code !== 11000) throw e }
  }
  throw new Error('Could not create poll. Try again.')
}))

app.get('/api/polls/:code', wrap(async (req, res) => {
  const p = await Poll.findOne({ code: req.params.code.toUpperCase() })
  if (!p) throw new Error('No poll with that code.')
  res.json(pub(p))
}))

// Atomic vote: the filter itself rejects closed polls and repeat voters, so races can't double-count.
app.post('/api/polls/:code/vote', wrap(async (req, res) => {
  const i = Number(req.body.option), voterId = String(req.body.voterId || '')
  if (!Number.isInteger(i) || i < 0 || i > 5 || !voterId) throw new Error('Invalid vote.')
  const p = await Poll.findOneAndUpdate(
    { code: req.params.code.toUpperCase(), closed: false, voters: { $ne: voterId }, [`options.${i}`]: { $exists: true } },
    { $inc: { [`options.${i}.votes`]: 1 }, $push: { voters: voterId } }, { new: true })
  if (!p) throw new Error('Voting is closed, or you already voted.')
  io.to(p.code).emit('poll', pub(p))
  res.json(pub(p))
}))

app.post('/api/polls/:code/close', wrap(async (req, res) => {
  const p = await Poll.findOneAndUpdate({ code: req.params.code.toUpperCase(), hostKey: req.body.hostKey }, { closed: true }, { new: true })
  if (!p) throw new Error('Only the host can close this poll.')
  io.to(p.code).emit('poll', pub(p))
  res.json(pub(p))
}))

await mongoose.connect(process.env.MONGO_URI)
server.listen(process.env.PORT || 5000, () => console.log('API + sockets ready'))
