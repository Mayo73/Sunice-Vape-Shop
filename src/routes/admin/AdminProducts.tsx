import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase, productImageUrl } from '../../lib/supabase'
import { formatPrice } from '../../lib/format'
import { errorMessage } from '../../lib/errors'
import { prepareImage } from '../../lib/image'
import { ErrorNote, Spinner } from '../../components/Shell'
import { BoxIcon, CloseIcon, PlusIcon, TrashIcon } from '../../components/Icons'
import type { Product } from '../../lib/types'

interface Draft {
  id: string | null
  name: string
  description: string
  price: string
  is_active: boolean
  image_path: string | null
  /** Chosen but not yet uploaded; upload happens on save. */
  file: File | null
  preview: string | null
}

const emptyDraft = (): Draft => ({
  id: null,
  name: '',
  description: '',
  price: '',
  is_active: true,
  image_path: null,
  file: null,
  preview: null,
})

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (err) {
      setError(errorMessage(err, 'Could not load items.'))
      return
    }
    setError(null)
    setProducts((data ?? []) as Product[])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Object URLs for the local preview have to be handed back.
  useEffect(() => {
    const url = draft?.preview
    return () => {
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
    }
  }, [draft?.preview])

  const pickFile = (file: File | undefined) => {
    if (!file || !draft) return
    if (draft.preview?.startsWith('blob:')) URL.revokeObjectURL(draft.preview)
    setDraft({ ...draft, file, preview: URL.createObjectURL(file) })
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return

    const cents = Math.round(Number(draft.price.replace(',', '.')) * 100)
    if (!Number.isFinite(cents) || cents < 0) {
      setError('Enter a price like 12.50')
      return
    }

    setSaving(true)
    setError(null)

    try {
      let imagePath = draft.image_path

      if (draft.file) {
        const { blob, extension, contentType } = await prepareImage(draft.file)
        const path = `${crypto.randomUUID()}.${extension}`
        const { error: upErr } = await supabase.storage
          .from('product-images')
          .upload(path, blob, { contentType, cacheControl: '31536000' })
        if (upErr) throw upErr

        const previous = draft.image_path
        imagePath = path
        // Replacing a picture should not leave the old file behind.
        if (previous) await supabase.storage.from('product-images').remove([previous])
      }

      const row = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        price_cents: cents,
        is_active: draft.is_active,
        image_path: imagePath,
      }

      const { error: err } = draft.id
        ? await supabase.from('products').update(row).eq('id', draft.id)
        : await supabase.from('products').insert(row)
      if (err) throw err

      setDraft(null)
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Could not save this item.'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (product: Product) => {
    if (!confirm(`Delete "${product.name}"? Past orders keep their record of it.`)) return

    setBusyId(product.id)
    setError(null)
    try {
      const { error: err } = await supabase.from('products').delete().eq('id', product.id)
      if (err) throw err
      if (product.image_path) {
        await supabase.storage.from('product-images').remove([product.image_path])
      }
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Could not delete this item.'))
    } finally {
      setBusyId(null)
    }
  }

  const toggleActive = async (product: Product) => {
    setBusyId(product.id)
    const { error: err } = await supabase
      .from('products')
      .update({ is_active: !product.is_active })
      .eq('id', product.id)
    if (err) setError(errorMessage(err))
    await load()
    setBusyId(null)
  }

  if (draft) {
    const preview = draft.preview ?? productImageUrl(draft.image_path)
    return (
      <form onSubmit={(e) => void save(e)}>
        <div className="row" style={{ marginBottom: 14 }}>
          <h2 className="h2" style={{ margin: 0 }}>
            {draft.id ? 'Edit item' : 'New item'}
          </h2>
          <button type="button" className="topbar__back" onClick={() => setDraft(null)} aria-label="Cancel">
            <CloseIcon />
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: 12 }}>
            <ErrorNote>{error}</ErrorNote>
          </div>
        )}

        <label className="thumbpick" style={{ marginBottom: 14 }}>
          {preview ? <img src={preview} alt="" /> : <span>Tap to add a picture</span>}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
        </label>

        <label className="field">
          <span className="field__label">Name</span>
          <input
            className="input"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            maxLength={120}
            required
          />
        </label>

        <label className="field">
          <span className="field__label">Price in euro</span>
          <input
            className="input"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            inputMode="decimal"
            placeholder="12.50"
            required
          />
        </label>

        <label className="field">
          <span className="field__label">Description</span>
          <textarea
            className="textarea"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            maxLength={2000}
          />
        </label>

        <label className="switch panel">
          <span>
            <strong>Visible in the shop</strong>
            <br />
            <span className="tiny muted">Hidden items cannot be ordered.</span>
          </span>
          <input
            type="checkbox"
            checked={draft.is_active}
            onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
          />
          <span className="switch__track" />
        </label>

        <div className="actionbar">
          <button type="submit" className="btn btn--primary" disabled={saving}>
            {saving ? (
              <>
                <Spinner /> Saving
              </>
            ) : (
              'Save item'
            )}
          </button>
        </div>
      </form>
    )
  }

  return (
    <>
      {error && (
        <div style={{ marginBottom: 12 }}>
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      <button
        type="button"
        className="btn btn--primary"
        onClick={() => setDraft(emptyDraft())}
        style={{ marginBottom: 16 }}
      >
        <PlusIcon /> New item
      </button>

      {products === null ? (
        <div className="empty">
          <Spinner />
        </div>
      ) : products.length === 0 ? (
        <div className="empty">
          <div className="empty__mark">
            <BoxIcon size={44} />
          </div>
          <p style={{ margin: 0 }}>No items yet.</p>
        </div>
      ) : (
        <div className="stack">
          {products.map((product) => {
            const image = productImageUrl(product.image_path)
            return (
              <div className="panel" key={product.id}>
                <div className="line" style={{ padding: 0 }}>
                  {image ? (
                    <img className="line__thumb" src={image} alt="" loading="lazy" />
                  ) : (
                    <span className="line__thumb" style={{ display: 'grid', placeItems: 'center' }}>
                      <BoxIcon size={20} />
                    </span>
                  )}
                  <div className="line__main">
                    <div className="line__name">{product.name}</div>
                    <div className="tiny muted">
                      {formatPrice(product.price_cents)}
                      {!product.is_active && ' · hidden'}
                    </div>
                  </div>
                </div>

                <div className="btnrow" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={busyId === product.id}
                    onClick={() => void toggleActive(product)}
                  >
                    {product.is_active ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() =>
                      setDraft({
                        id: product.id,
                        name: product.name,
                        description: product.description,
                        price: (product.price_cents / 100).toFixed(2),
                        is_active: product.is_active,
                        image_path: product.image_path,
                        file: null,
                        preview: null,
                      })
                    }
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    style={{ flex: '0 0 auto' }}
                    disabled={busyId === product.id}
                    onClick={() => void remove(product)}
                    aria-label={`Delete ${product.name}`}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
