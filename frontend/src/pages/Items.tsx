// Example CRUD page. Copy it for your own resource and swap the Item type and '/items' path.
import { useEffect, useState, type FormEvent } from 'react'
import { Button, Card, ErrorText, Input } from '../components/ui'
import { api } from '../lib/api'
import type { Item } from '../lib/types'

export default function Items() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  const fail = (err: unknown) => setError(err instanceof Error ? err.message : 'Request failed')

  useEffect(() => {
    api.get<Item[]>('/items').then(setItems).catch(fail)
  }, [])

  const add = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    try {
      const item = await api.post<Item>('/items', { title: title.trim() })
      setItems((current) => [item, ...(current ?? [])])
      setTitle('')
    } catch (err) {
      fail(err)
    }
  }

  const toggle = async (item: Item) => {
    try {
      const updated = await api.patch<Item>(`/items/${item.id}`, { done: !item.done })
      setItems((current) => current!.map((it) => (it.id === updated.id ? updated : it)))
    } catch (err) {
      fail(err)
    }
  }

  const remove = async (item: Item) => {
    try {
      await api.delete(`/items/${item.id}`)
      setItems((current) => current!.filter((it) => it.id !== item.id))
    } catch (err) {
      fail(err)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Items</h1>
      <form onSubmit={add} className="flex gap-2">
        <Input placeholder="Add an item…" value={title} onChange={(event) => setTitle(event.target.value)} />
        <Button type="submit">Add</Button>
      </form>
      <ErrorText>{error}</ErrorText>
      {items === null ? (
        <p className="text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-slate-500">Nothing here yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <Card className="flex items-center gap-3 py-3">
                <input type="checkbox" checked={item.done} onChange={() => toggle(item)} className="size-4" />
                <span className={`flex-1 ${item.done ? 'text-slate-400 line-through' : ''}`}>{item.title}</span>
                <Button variant="danger" onClick={() => remove(item)}>
                  Delete
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
